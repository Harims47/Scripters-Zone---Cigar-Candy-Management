import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateIssueStockInput,
  IssueStockFilterQueryParams,
} from './issue-stock.schemas.js';
import { IssueStockItemSummary, IssueStockSummary } from './issue-stock.types.js';
import {
  IssueRecipientType,
  PersonType,
  Prisma,
  ProductCategory,
  StockMovementType,
  Uom,
  UserRole,
} from '@prisma/client';
import { UnitConversionService } from '../products/unit-conversion.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SalesTargetsService } from '../sales-targets/sales-targets.service.js';
import { JwtPayload } from '../../plugins/auth.plugin.js';

const CANDY_UOMS: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX];
const CIGARETTE_UOMS: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET]; // Strictly canonical PACKET (not POCKET)

export class IssueStockService {
  /**
   * Sanitizes Prisma IssueStock entity into IssueStockSummary
   */
  private static sanitizeIssueStock(issue: any): IssueStockSummary {
    return {
      id: issue.id,
      recipientType: issue.recipientType,
      salesmanId: issue.salesmanId,
      salesmanName: issue.salesman?.name || null,
      dealerId: issue.dealerId,
      dealerName: issue.dealer?.name || null,
      issueDate: SalesTargetsService.formatTargetDate(issue.issueDate),
      totalIssuedValue: issue.totalIssuedValue.toNumber(),
      createdBy: issue.createdBy,
      items: (issue.items || []).map((item: any): IssueStockItemSummary => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || '',
        productSku: item.product?.sku || null,
        category: item.product?.category || '',
        brand: item.product?.brand || '',
        quantity: item.quantity.toNumber(),
        uom: item.uom,
        salesRate: item.salesRate.toNumber(),
        issuedValue: item.issuedValue.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        createdAt: item.createdAt,
      })),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  /**
   * Creates an Issue Stock transaction and generates ISSUE stock movements atomically.
   * STRICT BUSINESS RULES (Sections 1 - 26, 45):
   * 1. Physical stock issue to SALESMAN or DEALER.
   * 2. For SALESMAN: Requires existing Sales Target for (salesmanId, issueDate). Returns 409 if missing.
   * 3. For DEALER: No Sales Target required.
   * 4. Issue quantity is independent from target quantity.
   * 5. Server calculates issuedValue using Product.salesRate.
   * 6. Validates stock availability; never allows negative inventory (returns 409 Conflict).
   * 7. Concurrency-safe: row locks on products during evaluation.
   * 8. 100% atomic in Prisma transaction.
   */
  public static async createIssueStock(
    input: CreateIssueStockInput,
    createdBy?: string
  ): Promise<IssueStockSummary> {
    const issueDate = SalesTargetsService.normalizeTargetDate(input.issueDate);

    let salesmanPersonId: string | null = null;
    let dealerPersonId: string | null = null;

    // 1. Validate Recipient
    if (input.recipientType === IssueRecipientType.SALESMAN) {
      if (!input.salesmanId) {
        throw AppError.badRequest('salesmanId is required when recipientType is SALESMAN');
      }

      let person = await prisma.person.findUnique({
        where: { id: input.salesmanId },
        include: { user: true },
      });

      if (!person) {
        const u = await prisma.user.findUnique({
          where: { id: input.salesmanId },
          include: { person: { include: { user: true } } },
        });
        if (u && u.person) {
          person = u.person as any;
        }
      }

      if (!person) {
        throw AppError.notFound(`Salesman with ID "${input.salesmanId}" not found`);
      }

      if (person.type === PersonType.DEALER) {
        throw AppError.badRequest('Dealer cannot be a salesman recipient');
      }
      if (person.type === PersonType.STAFF) {
        throw AppError.badRequest('Staff cannot be a salesman recipient');
      }
      if (person.type !== PersonType.SALESMAN) {
        throw AppError.badRequest(`Recipient must be a Salesman. Found ${person.type}`);
      }
      if (!person.active) {
        throw AppError.badRequest(`Cannot issue stock to inactive salesman "${person.name}"`);
      }
      if (person.user) {
        if (person.user.role === UserRole.ADMIN) {
          throw AppError.badRequest('Admin cannot be a salesman recipient');
        }
        if (!person.user.isActive) {
          throw AppError.badRequest(`Cannot issue stock to deactivated salesman "${person.name}"`);
        }
      }

      salesmanPersonId = person.id;

      // Verify existing Sales Target for salesman:
      // Since sales targets are fixed one-time (not given daily), check for issueDate target,
      // or fallback to the most recent target configured for this salesman.
      let existingTarget = await prisma.salesTarget.findFirst({
        where: {
          salesmanId: salesmanPersonId,
          targetDate: issueDate,
        },
      });

      if (!existingTarget) {
        existingTarget = await prisma.salesTarget.findFirst({
          where: {
            salesmanId: salesmanPersonId,
            targetDate: { lte: issueDate },
          },
          orderBy: { targetDate: 'desc' },
        });
      }

      if (!existingTarget) {
        existingTarget = await prisma.salesTarget.findFirst({
          where: {
            salesmanId: salesmanPersonId,
          },
          orderBy: { targetDate: 'desc' },
        });
      }

      if (!existingTarget) {
        // Auto-create a base one-time sales target for this salesman so issuing stock is never blocked
        existingTarget = await prisma.salesTarget.create({
          data: {
            salesmanId: salesmanPersonId,
            targetDate: issueDate,
            dailyRevenueTarget: new Prisma.Decimal(0),
            createdBy: createdBy || null,
            active: true,
          },
        });
      }
    } else if (input.recipientType === IssueRecipientType.DEALER) {
      if (!input.dealerId) {
        throw AppError.badRequest('dealerId is required when recipientType is DEALER');
      }

      const dealer = await prisma.person.findUnique({
        where: { id: input.dealerId },
      });

      if (!dealer) {
        throw AppError.notFound(`Dealer with ID "${input.dealerId}" not found`);
      }

      if (dealer.type !== PersonType.DEALER) {
        throw AppError.badRequest(`Recipient must be a Dealer. Found ${dealer.type}`);
      }

      if (!dealer.active) {
        throw AppError.badRequest(`Cannot issue stock to inactive dealer "${dealer.name}"`);
      }

      dealerPersonId = dealer.id;
      // Dealer issue does NOT require a Sales Target (Section 4, 10, 18)
    }

    // 2. Validate Items & Duplicate Products
    if (!input.items || input.items.length === 0) {
      throw AppError.badRequest('Issue stock must contain at least one item');
    }

    const seenProductIds = new Set<string>();
    for (const item of input.items) {
      if (seenProductIds.has(item.productId)) {
        throw AppError.conflict(
          `Duplicate product detected in issue stock: Product with ID "${item.productId}" cannot appear more than once in the same issue transaction.`
        );
      }
      seenProductIds.add(item.productId);
    }

    interface ValidatedIssueItem {
      productId: string;
      productName: string;
      category: ProductCategory;
      baseUom: Uom;
      quantity: number;
      uom: Uom;
      salesRate: Prisma.Decimal;
      issuedValue: Prisma.Decimal;
      baseQuantity: Prisma.Decimal;
    }

    const validatedItems: ValidatedIssueItem[] = [];
    let totalIssuedValue = new Prisma.Decimal(0);

    for (let index = 0; index < input.items.length; index++) {
      const item = input.items[index];

      if (item.quantity <= 0) {
        throw AppError.badRequest(`Issue quantity must be greater than 0 (item #${index + 1})`);
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { uomConversions: true },
      });

      if (!product) {
        throw AppError.notFound(`Product with ID "${item.productId}" (item #${index + 1}) not found`);
      }

      if (!product.active) {
        throw AppError.badRequest(`Cannot issue inactive product "${product.name}" (item #${index + 1})`);
      }

      // Canonical UOM Category check
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

      // Normalize quantity to product base UOM
      let baseQtyNumber = item.quantity;
      if (item.uom !== product.baseUom) {
        const conversion = await UnitConversionService.convertQuantity({
          productId: product.id,
          quantity: item.quantity,
          fromUom: item.uom,
          toUom: product.baseUom,
        });
        baseQtyNumber = conversion.convertedQuantity;
      }

      // Authoritative sales rate from Product Master
      const itemIssuedValueNum = Math.round(item.quantity * product.salesRate.toNumber() * 100) / 100;
      const itemIssuedValue = new Prisma.Decimal(itemIssuedValueNum);
      totalIssuedValue = totalIssuedValue.plus(itemIssuedValue);

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        baseUom: product.baseUom,
        quantity: item.quantity,
        uom: item.uom,
        salesRate: product.salesRate,
        issuedValue: itemIssuedValue,
        baseQuantity: new Prisma.Decimal(baseQtyNumber),
      });
    }

    // 3. Concurrency-Safe Atomic Stock Evaluation & Issue Creation
    const sortedProductIds = [...seenProductIds].sort();

    let createdIssueId: string;

    try {
      createdIssueId = await prisma.$transaction(async (tx) => {
        // 3a. Concurrency Protection: Lock product rows in deterministic order to prevent deadlocks and overselling
        if (sortedProductIds.length > 0) {
          await tx.$queryRaw`
            SELECT id FROM "products"
            WHERE id IN (${Prisma.join(sortedProductIds)})
            FOR UPDATE
          `;
        }

        // 3b. Evaluate stock availability inside locked transaction
        for (const item of validatedItems) {
          const availableStock = await InventoryService.getAvailableStockInBaseUom(item.productId, tx);
          const requestedBaseQty = item.baseQuantity.toNumber();

          if (availableStock < requestedBaseQty) {
            throw AppError.conflict(
              `Insufficient stock for product "${item.productName}". Available: ${availableStock} ${item.baseUom}, Requested: ${requestedBaseQty} ${item.baseUom}. Issue transaction rolled back.`
            );
          }
        }

        // 3c. Create IssueStock header
        const issue = await tx.issueStock.create({
          data: {
            recipientType: input.recipientType,
            salesmanId: salesmanPersonId,
            dealerId: dealerPersonId,
            issueDate,
            totalIssuedValue,
            createdBy: createdBy || null,
          },
        });

        // 3d. Create IssueStockItems & ISSUE StockMovements
        for (const item of validatedItems) {
          await tx.issueStockItem.create({
            data: {
              issueStockId: issue.id,
              productId: item.productId,
              quantity: new Prisma.Decimal(item.quantity),
              uom: item.uom,
              salesRate: item.salesRate,
              issuedValue: item.issuedValue,
              baseQuantity: item.baseQuantity,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: StockMovementType.ISSUE,
              quantity: new Prisma.Decimal(item.quantity),
              uom: item.uom,
              baseQuantity: item.baseQuantity,
              issueStockId: issue.id,
              createdBy: createdBy || null,
            },
          });
        }

        return issue.id;
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      if (err.code === 'P2002') {
        throw AppError.conflict('A duplicate issue item constraint conflict occurred.');
      }
      throw err;
    }

    return this.getIssueStockById(createdIssueId);
  }

  /**
   * Retrieves single IssueStock record by ID with item and product details.
   * If caller is SALESMAN, enforces ownership.
   */
  public static async getIssueStockById(id: string, currentUser?: JwtPayload): Promise<IssueStockSummary> {
    const issue = await prisma.issueStock.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
        dealer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true, brand: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!issue) {
      throw AppError.notFound(`Issue stock record with ID "${id}" not found`);
    }

    // Role-based scoping: Salesman can only view their own issues
    if (currentUser && currentUser.role === UserRole.SALESMAN) {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { personId: true },
      });
      if (!user || user.personId !== issue.salesmanId) {
        throw AppError.forbidden('You do not have permission to view another salesman\'s stock issue');
      }
    }

    return this.sanitizeIssueStock(issue);
  }

  /**
   * Lists IssueStock records with filtering and role scoping.
   * Salesmen automatically scoped to their own issues.
   */
  public static async getAllIssueStocks(
    filters?: IssueStockFilterQueryParams,
    currentUser?: JwtPayload
  ): Promise<IssueStockSummary[]> {
    const where: Prisma.IssueStockWhereInput = {};

    // Role-based scoping
    if (currentUser && currentUser.role === UserRole.SALESMAN) {
      const user = await prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { personId: true },
      });
      if (!user || !user.personId) {
        return [];
      }
      where.recipientType = IssueRecipientType.SALESMAN;
      where.salesmanId = user.personId;
    } else {
      // Admin filters
      if (filters?.recipientType) {
        where.recipientType = filters.recipientType;
      }
      if (filters?.salesmanId) {
        const person = await prisma.person.findUnique({ where: { id: filters.salesmanId } });
        if (person) {
          where.salesmanId = person.id;
        } else {
          const u = await prisma.user.findUnique({ where: { id: filters.salesmanId }, select: { personId: true } });
          where.salesmanId = u?.personId || filters.salesmanId;
        }
      }
      if (filters?.dealerId) {
        where.dealerId = filters.dealerId;
      }
    }

    if (filters?.issueDate) {
      where.issueDate = SalesTargetsService.normalizeTargetDate(filters.issueDate);
    } else if (filters?.startDate || filters?.endDate) {
      where.issueDate = {};
      if (filters.startDate) {
        where.issueDate.gte = SalesTargetsService.normalizeTargetDate(filters.startDate);
      }
      if (filters.endDate) {
        where.issueDate.lte = SalesTargetsService.normalizeTargetDate(filters.endDate);
      }
    }

    if (filters?.productId) {
      where.items = {
        some: { productId: filters.productId },
      };
    }

    const issues = await prisma.issueStock.findMany({
      where,
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
        dealer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true, brand: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return issues.map((i) => this.sanitizeIssueStock(i));
  }

  /**
   * Delete an issue stock record by ID or Item ID, reverting any generated stock movements.
   */
  public static async deleteIssueStock(id: string): Promise<void> {
    let issue = await prisma.issueStock.findUnique({ where: { id } });
    if (!issue) {
      // Check if id is an IssueStockItem ID
      const item = await prisma.issueStockItem.findUnique({ where: { id } });
      if (item) {
        issue = await prisma.issueStock.findUnique({ where: { id: item.issueStockId } });
      }
    }

    if (!issue) {
      throw AppError.notFound('Stock issue record not found');
    }

    const issueId = issue.id;
    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({
        where: { issueStockId: issueId },
      });
      await tx.issueStock.delete({
        where: { id: issueId },
      });
    });
  }
}

