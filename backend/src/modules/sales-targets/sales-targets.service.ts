import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateSalesTargetInput,
  SalesTargetFilterQueryParams,
  SalesTargetProductInput,
  UpdateSalesTargetInput,
} from './sales-targets.schemas.js';
import { SalesTargetProductSummary, SalesTargetSummary } from './sales-targets.types.js';
import { PersonType, Prisma, ProductCategory, Uom, UserRole } from '@prisma/client';
import { JwtPayload } from '../../plugins/auth.plugin.js';

const CANDY_UOMS: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX];
const CIGARETTE_UOMS: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET, Uom.POCKET];

export class SalesTargetsService {
  /**
   * Helper to normalize any date input to a strict UTC midnight Date (YYYY-MM-DD)
   * to avoid timezone shifts when persisting to PostgreSQL @db.Date.
   */
  public static normalizeTargetDate(dateInput: string | Date): Date {
    let dateStr: string;
    if (typeof dateInput === 'string') {
      dateStr = dateInput.trim().split('T')[0];
    } else {
      dateStr = dateInput.toISOString().split('T')[0];
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      throw AppError.badRequest(`Invalid target date format "${dateStr}". Expected YYYY-MM-DD.`);
    }

    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      throw AppError.badRequest(`Invalid target date "${dateStr}".`);
    }

    // Explicit UTC date without timezone offsets
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Formats database Date object to clean YYYY-MM-DD string
   */
  public static formatTargetDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Sanitizes Prisma SalesTarget entity into clean SalesTargetSummary
   */
  private static sanitizeTarget(target: any): SalesTargetSummary {
    return {
      id: target.id,
      salesmanId: target.salesmanId,
      salesmanName: target.salesman?.name || '',
      targetDate: this.formatTargetDate(target.targetDate),
      dailyRevenueTarget: target.dailyRevenueTarget.toNumber(),
      active: target.active,
      createdBy: target.createdBy,
      productTargets: (target.productTargets || []).map((pt: any): SalesTargetProductSummary => ({
        id: pt.id,
        productId: pt.productId,
        productName: pt.product?.name || '',
        productSku: pt.product?.sku || null,
        category: pt.product?.category || '',
        brand: pt.product?.brand || '',
        targetQuantity: pt.targetQuantity.toNumber(),
        uom: pt.uom,
        createdAt: pt.createdAt,
        updatedAt: pt.updatedAt,
      })),
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  /**
   * Authoritative validation of Salesman identity.
   * STRICT BUSINESS RULES (Section 4, 15):
   * 1. Only SALESMAN can have Sales Targets.
   * 2. Dealers, Staff, and Admins CANNOT have sales targets.
   * 3. Target owner must be active.
   */
  private static async validateSalesman(salesmanId: string) {
    // Check if ID directly matches Person
    let person = await prisma.person.findUnique({
      where: { id: salesmanId },
      include: { user: true },
    });

    // If not found directly, check if a User was passed
    if (!person) {
      const user = await prisma.user.findUnique({
        where: { id: salesmanId },
        include: { person: { include: { user: true } } },
      });
      if (user && user.person) {
        person = user.person as any;
      }
    }

    if (!person) {
      throw AppError.notFound(`Salesman with ID "${salesmanId}" not found`);
    }

    // Role / Entity type checks
    if (person.type === PersonType.DEALER) {
      throw AppError.badRequest('Dealers cannot have sales targets. Only Salesmen can have sales targets.');
    }

    if (person.type === PersonType.STAFF) {
      throw AppError.badRequest('Staff cannot have sales targets. Only Salesmen can have sales targets.');
    }

    if (person.type !== PersonType.SALESMAN) {
      throw AppError.badRequest(`Target owner must be a Salesman. Entity "${person.name}" is a ${person.type}.`);
    }

    if (!person.active) {
      throw AppError.badRequest(`Cannot assign sales target to inactive salesman "${person.name}".`);
    }

    if (person.user) {
      if (person.user.role === UserRole.ADMIN) {
        throw AppError.badRequest('Admin cannot be target owner. Only Salesmen can have sales targets.');
      }
      if (!person.user.isActive) {
        throw AppError.badRequest(`Cannot assign sales target to deactivated salesman "${person.name}".`);
      }
    }

    return person;
  }

  /**
   * Validates product targets list (checks for duplicates, active products, UOM compatibility, quantity > 0)
   */
  private static async validateProductTargets(productTargets: SalesTargetProductInput[]) {
    if (!productTargets || productTargets.length === 0) {
      return [];
    }

    // Check for duplicate products in request
    const seenProductIds = new Set<string>();
    for (const item of productTargets) {
      if (seenProductIds.has(item.productId)) {
        throw AppError.conflict(
          `Duplicate product target detected: Product with ID "${item.productId}" cannot appear more than once in the same target.`
        );
      }
      seenProductIds.add(item.productId);
    }

    const validatedItems: {
      productId: string;
      targetQuantity: Prisma.Decimal;
      uom: Uom;
    }[] = [];

    for (let index = 0; index < productTargets.length; index++) {
      const item = productTargets[index];

      if (item.targetQuantity <= 0) {
        throw AppError.badRequest(`Target quantity must be greater than 0 (item #${index + 1}).`);
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw AppError.notFound(`Product with ID "${item.productId}" (item #${index + 1}) not found.`);
      }

      if (!product.active) {
        throw AppError.badRequest(
          `Cannot assign target for inactive product "${product.name}" (item #${index + 1}).`
        );
      }

      // Category UOM compatibility
      if (product.category === ProductCategory.CANDY && !CANDY_UOMS.includes(item.uom)) {
        throw AppError.badRequest(
          `Invalid UOM "${item.uom}" for CANDY product "${product.name}". Allowed UOMs: ${CANDY_UOMS.join(', ')}`
        );
      }

      if (product.category === ProductCategory.CIGARETTE && !CIGARETTE_UOMS.includes(item.uom)) {
        throw AppError.badRequest(
          `Invalid UOM "${item.uom}" for CIGARETTE product "${product.name}". Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`
        );
      }

      validatedItems.push({
        productId: product.id,
        targetQuantity: new Prisma.Decimal(item.targetQuantity),
        uom: item.uom,
      });
    }

    return validatedItems;
  }

  /**
   * Creates a new Sales Target for a Salesman and Date (ADMIN only)
   * Enforces 1 target per salesman per business date.
   */
  public static async createSalesTarget(
    input: CreateSalesTargetInput,
    createdBy?: string
  ): Promise<SalesTargetSummary> {
    const salesman = await this.validateSalesman(input.salesmanId);
    const targetDate = this.normalizeTargetDate(input.targetDate);

    if (input.dailyRevenueTarget < 0) {
      throw AppError.badRequest('Daily revenue target cannot be negative.');
    }

    // 1. Uniqueness check: ONE target per salesman per business date
    const existing = await prisma.salesTarget.findUnique({
      where: {
        salesmanId_targetDate: {
          salesmanId: salesman.id,
          targetDate,
        },
      },
    });

    if (existing) {
      throw AppError.conflict(
        `Sales target already exists for salesman "${salesman.name}" on ${this.formatTargetDate(targetDate)}.`
      );
    }

    // 2. Validate product targets
    const validatedProductTargets = await this.validateProductTargets(input.productTargets || []);

    // 3. Atomic transaction
    let createdTargetId: string;
    try {
      createdTargetId = await prisma.$transaction(async (tx) => {
        const target = await tx.salesTarget.create({
          data: {
            salesmanId: salesman.id,
            targetDate,
            dailyRevenueTarget: new Prisma.Decimal(input.dailyRevenueTarget),
            active: true,
            createdBy: createdBy || null,
          },
        });

        if (validatedProductTargets.length > 0) {
          for (const pt of validatedProductTargets) {
            await tx.salesTargetProduct.create({
              data: {
                salesTargetId: target.id,
                productId: pt.productId,
                targetQuantity: pt.targetQuantity,
                uom: pt.uom,
              },
            });
          }
        }

        return target.id;
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw AppError.conflict(
          `A conflict occurred while creating sales target for salesman "${salesman.name}". Duplicate entry detected.`
        );
      }
      throw err;
    }

    return this.getSalesTargetById(createdTargetId);
  }

  /**
   * Retrieves single Sales Target by ID
   */
  public static async getSalesTargetById(id: string, currentUser?: JwtPayload): Promise<SalesTargetSummary> {
    const target = await prisma.salesTarget.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
        productTargets: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true, brand: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!target) {
      throw AppError.notFound(`Sales target with ID "${id}" not found.`);
    }

    // If caller is SALESMAN, verify target belongs to them
    if (currentUser && currentUser.role === UserRole.SALESMAN) {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { personId: true },
      });
      if (!user || user.personId !== target.salesmanId) {
        throw AppError.forbidden('You do not have permission to view another salesman\'s target.');
      }
    }

    return this.sanitizeTarget(target);
  }

  /**
   * Lists Sales Targets with filtering and role scoping.
   * If currentUser is SALESMAN, strictly scoped to their own targets.
   */
  public static async getAllSalesTargets(
    filters?: SalesTargetFilterQueryParams,
    currentUser?: JwtPayload
  ): Promise<SalesTargetSummary[]> {
    const where: Prisma.SalesTargetWhereInput = {};

    // Role-based scoping: Salesman sees only their own targets
    if (currentUser && currentUser.role === UserRole.SALESMAN) {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { personId: true },
      });
      if (!user || !user.personId) {
        return [];
      }
      where.salesmanId = user.personId;
    } else if (filters?.salesmanId) {
      // Admin filter by salesman
      // Check if user ID or person ID passed
      const person = await prisma.person.findUnique({ where: { id: filters.salesmanId } });
      if (person) {
        where.salesmanId = person.id;
      } else {
        const u = await prisma.user.findUnique({ where: { id: filters.salesmanId }, select: { personId: true } });
        where.salesmanId = u?.personId || filters.salesmanId;
      }
    }

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.targetDate) {
      where.targetDate = this.normalizeTargetDate(filters.targetDate);
    } else if (filters?.startDate || filters?.endDate) {
      where.targetDate = {};
      if (filters.startDate) {
        where.targetDate.gte = this.normalizeTargetDate(filters.startDate);
      }
      if (filters.endDate) {
        where.targetDate.lte = this.normalizeTargetDate(filters.endDate);
      }
    }

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        salesman: { select: { id: true, name: true } },
        productTargets: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true, brand: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { targetDate: 'desc' },
    });

    return targets.map((t) => this.sanitizeTarget(t));
  }

  /**
   * Retrieves targets for the logged in salesman
   */
  public static async getMySalesTargets(
    userId: string,
    targetDate?: string
  ): Promise<SalesTargetSummary[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personId: true },
    });

    if (!user || !user.personId) {
      return [];
    }

    return this.getAllSalesTargets(
      { salesmanId: user.personId, targetDate },
      { userId, role: UserRole.SALESMAN }
    );
  }

  /**
   * Updates an existing Sales Target safely (ADMIN only).
   * Reconciles product target rows atomically.
   */
  public static async updateSalesTarget(
    id: string,
    input: UpdateSalesTargetInput
  ): Promise<SalesTargetSummary> {
    const existing = await prisma.salesTarget.findUnique({
      where: { id },
      include: { salesman: true, productTargets: true },
    });

    if (!existing) {
      throw AppError.notFound(`Sales target with ID "${id}" not found.`);
    }

    let targetDate = existing.targetDate;
    if (input.targetDate) {
      targetDate = this.normalizeTargetDate(input.targetDate);
      if (targetDate.getTime() !== existing.targetDate.getTime()) {
        const collision = await prisma.salesTarget.findUnique({
          where: {
            salesmanId_targetDate: {
              salesmanId: existing.salesmanId,
              targetDate,
            },
          },
        });
        if (collision && collision.id !== id) {
          throw AppError.conflict(
            `Another sales target already exists for salesman "${existing.salesman.name}" on ${this.formatTargetDate(targetDate)}.`
          );
        }
      }
    }

    if (input.dailyRevenueTarget !== undefined && input.dailyRevenueTarget < 0) {
      throw AppError.badRequest('Daily revenue target cannot be negative.');
    }

    // Validate product targets if provided
    let validatedProductTargets: {
      productId: string;
      targetQuantity: Prisma.Decimal;
      uom: Uom;
    }[] | null = null;

    if (input.productTargets !== undefined) {
      validatedProductTargets = await this.validateProductTargets(input.productTargets);
    }

    // Atomic update
    try {
      await prisma.$transaction(async (tx) => {
        await tx.salesTarget.update({
          where: { id },
          data: {
            ...(input.dailyRevenueTarget !== undefined
              ? { dailyRevenueTarget: new Prisma.Decimal(input.dailyRevenueTarget) }
              : {}),
            ...(input.targetDate ? { targetDate } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        });

        if (validatedProductTargets !== null) {
          // Reconcile: delete old child records and insert new ones
          await tx.salesTargetProduct.deleteMany({
            where: { salesTargetId: id },
          });

          for (const pt of validatedProductTargets) {
            await tx.salesTargetProduct.create({
              data: {
                salesTargetId: id,
                productId: pt.productId,
                targetQuantity: pt.targetQuantity,
                uom: pt.uom,
              },
            });
          }
        }
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw AppError.conflict(
          'Duplicate product target detected during update: A product can only be specified once in a sales target.'
        );
      }
      throw err;
    }

    return this.getSalesTargetById(id);
  }

  /**
   * Activates or deactivates a Sales Target (ADMIN only)
   */
  public static async updateSalesTargetStatus(id: string, active: boolean): Promise<SalesTargetSummary> {
    const existing = await prisma.salesTarget.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Sales target with ID "${id}" not found.`);
    }

    await prisma.salesTarget.update({
      where: { id },
      data: { active },
    });

    return this.getSalesTargetById(id);
  }
}
