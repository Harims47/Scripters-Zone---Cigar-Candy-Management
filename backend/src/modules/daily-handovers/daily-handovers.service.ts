import {
  PrismaClient,
  PersonType,
  UserRole,
  Uom,
  ProductCategory,
  Prisma,
  LedgerTransactionType,
  LedgerDirection,
  LedgerReferenceType,
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UnitConversionService } from '../products/unit-conversion.service.js';
import {
  HandoverRecipientType,
  HandoverStatus,
  CreateDailyHandoverInput,
  UpdateDailyHandoverInput,
  RecordCollectionInput,
  DailyHandoverFilters,
  CalculatedHandoverItem,
  CalculatedEmptyPacket,
  CalculatedCoupon,
  CalculatedHandoverTotals,
} from './daily-handovers.types.js';

const CANDY_UOMS: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX];
const CIGARETTE_UOMS: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET];

export class DailyHandoversService {
  /**
   * Resolve a salesman user's personId.
   */
  static async getSalesmanPersonId(currentUser: { userId: string; role: string; personId?: string }): Promise<string | null> {
    if (currentUser.personId) return currentUser.personId;
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { personId: true },
    });
    return user?.personId || null;
  }

  /**
   * Parse a YYYY-MM-DD string into a UTC Date object.
   */
  static parseHandoverDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      throw AppError.badRequest(`Invalid handoverDate format "${dateStr}". Expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Format a Date into YYYY-MM-DD.
   */
  static formatHandoverDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate all item, benefit, and handover totals authoritatively on the server.
   */
  static async calculateTotals(
    items: CreateDailyHandoverInput['items'],
    emptyPackets: CreateDailyHandoverInput['emptyPackets'] = [],
    coupons: CreateDailyHandoverInput['coupons'] = [],
    cashCollectedInput = 0,
    gpayCollectedInput = 0,
    isCollectionProvided = false,
    desiredStatus?: HandoverStatus,
    client: Prisma.TransactionClient | PrismaClient = prisma
  ): Promise<{
    calculatedItems: CalculatedHandoverItem[];
    calculatedEmptyPackets: CalculatedEmptyPacket[];
    calculatedCoupons: CalculatedCoupon[];
    totals: CalculatedHandoverTotals;
  }> {
    // 1. Validate unique product IDs
    const seenProductIds = new Set<string>();
    for (const item of items) {
      if (seenProductIds.has(item.productId)) {
        throw AppError.badRequest('Duplicate product in handover item list. Each product must appear only once.');
      }
      seenProductIds.add(item.productId);
    }

    // 2. Fetch products
    const productIds = items.map((i) => i.productId);
    const products = await client.product.findMany({
      where: { id: { in: productIds } },
      include: { uomConversions: true },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      throw AppError.badRequest(`Products not found: ${missingIds.join(', ')}`);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Process and calculate items
    const calculatedItems: CalculatedHandoverItem[] = [];
    let grossSales = 0;
    let totalItemDiscount = 0;
    let freeItemValue = 0;

    for (const item of items) {
      const product = productMap.get(item.productId)!;
      if (!product.active) {
        throw AppError.badRequest(`Cannot add inactive product "${product.name}" to handover`);
      }

      // Canonical UOM validation
      if (item.uom === 'POCKET') {
        throw AppError.badRequest('POCKET is a legacy unit. Use canonical PACKET for API operations.');
      }
      if (!Object.values(Uom).includes(item.uom as Uom)) {
        throw AppError.badRequest(`Invalid UOM "${item.uom}". Canonical UOMs are: JAR, HANGER, BOX, CASE, M, PACKET.`);
      }
      const canonicalUom = item.uom as Uom;

      if (product.category === ProductCategory.CANDY && !CANDY_UOMS.includes(canonicalUom)) {
        throw AppError.badRequest(
          `Invalid UOM "${canonicalUom}" for CANDY product "${product.name}". Allowed UOMs: ${CANDY_UOMS.join(', ')}`
        );
      }

      if (product.category === ProductCategory.CIGARETTE && !CIGARETTE_UOMS.includes(canonicalUom)) {
        throw AppError.badRequest(
          `Invalid UOM "${canonicalUom}" for CIGARETTE product "${product.name}". Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`
        );
      }

      // Quantity validations
      if (item.openingQuantity < 0) {
        throw AppError.badRequest(`Opening quantity cannot be negative for product "${product.name}"`);
      }
      if (item.closingQuantity < 0) {
        throw AppError.badRequest(`Closing quantity cannot be negative for product "${product.name}"`);
      }
      if (item.closingQuantity > item.openingQuantity) {
        throw AppError.badRequest(
          `Closing quantity (${item.closingQuantity}) cannot exceed opening quantity (${item.openingQuantity}) for product "${product.name}"`
        );
      }

      const salesQuantity = Math.round((item.openingQuantity - item.closingQuantity) * 100) / 100;
      const freeQuantity = item.freeQuantity || 0;
      if (freeQuantity < 0) {
        throw AppError.badRequest(`Free quantity cannot be negative for product "${product.name}"`);
      }
      if (freeQuantity > salesQuantity) {
        throw AppError.badRequest(
          `Free quantity (${freeQuantity}) cannot exceed sales quantity (${salesQuantity}) for product "${product.name}"`
        );
      }

      const chargeableQuantity = Math.round((salesQuantity - freeQuantity) * 100) / 100;
      const rate = product.salesRate.toNumber();
      const grossAmount = Math.round(chargeableQuantity * rate * 100) / 100;
      const itemFreeValue = Math.round(freeQuantity * rate * 100) / 100;

      const discount = item.discount || 0;
      if (discount < 0) {
        throw AppError.badRequest(`Discount cannot be negative for product "${product.name}"`);
      }
      if (discount > grossAmount) {
        throw AppError.badRequest(
          `Item discount (₹${discount}) cannot exceed gross amount (₹${grossAmount}) for product "${product.name}"`
        );
      }

      const netAmount = Math.round((grossAmount - discount) * 100) / 100;

      // Base sales quantity calculation
      let baseSalesQuantity = salesQuantity;
      if (canonicalUom !== product.baseUom) {
        const conversion = await UnitConversionService.convertQuantity({
          productId: product.id,
          quantity: salesQuantity,
          fromUom: canonicalUom,
          toUom: product.baseUom,
        });
        baseSalesQuantity = conversion.convertedQuantity;
      }

      grossSales += grossAmount;
      totalItemDiscount += discount;
      freeItemValue += itemFreeValue;

      calculatedItems.push({
        productId: item.productId,
        uom: canonicalUom,
        openingQuantity: item.openingQuantity,
        closingQuantity: item.closingQuantity,
        salesQuantity,
        freeQuantity,
        chargeableQuantity,
        rate,
        grossAmount,
        freeItemValue: itemFreeValue,
        discount,
        netAmount,
        baseSalesQuantity,
      });
    }

    grossSales = Math.round(grossSales * 100) / 100;
    totalItemDiscount = Math.round(totalItemDiscount * 100) / 100;
    const netSales = Math.round((grossSales - totalItemDiscount) * 100) / 100;

    // 4. Empty Packet validation & calculation
    const calculatedEmptyPackets: CalculatedEmptyPacket[] = [];
    let emptyPacketBenefit = 0;

    for (const ep of emptyPackets) {
      if (ep.quantity <= 0) {
        throw AppError.badRequest('Empty packet quantity must be greater than zero');
      }
      if (ep.actualAmount < 0) {
        throw AppError.badRequest('Empty packet amount cannot be negative');
      }
      if (ep.productId) {
        const epProduct = await client.product.findUnique({ where: { id: ep.productId } });
        if (!epProduct) {
          throw AppError.badRequest(`Empty packet product ID "${ep.productId}" not found`);
        }
      }
      emptyPacketBenefit += ep.actualAmount;
      calculatedEmptyPackets.push({
        productId: ep.productId,
        quantity: ep.quantity,
        actualAmount: ep.actualAmount,
      });
    }
    emptyPacketBenefit = Math.round(emptyPacketBenefit * 100) / 100;

    // 5. Coupon validation & calculation
    const calculatedCoupons: CalculatedCoupon[] = [];
    let couponBenefit = 0;

    for (const c of coupons) {
      if (c.denomination <= 0) {
        throw AppError.badRequest('Coupon denomination must be greater than zero');
      }
      if (c.quantity <= 0) {
        throw AppError.badRequest('Coupon quantity must be greater than zero');
      }
      if (c.productId) {
        const cProduct = await client.product.findUnique({ where: { id: c.productId } });
        if (!cProduct) {
          throw AppError.badRequest(`Coupon product ID "${c.productId}" not found`);
        }
      }
      const amount = Math.round(c.denomination * c.quantity * 100) / 100;
      couponBenefit += amount;
      calculatedCoupons.push({
        productId: c.productId,
        denomination: c.denomination,
        quantity: c.quantity,
        amount,
      });
    }
    couponBenefit = Math.round(couponBenefit * 100) / 100;

    // 6. Expected Handover Calculation
    const totalBenefits = Math.round((emptyPacketBenefit + couponBenefit) * 100) / 100;
    if (totalBenefits > netSales) {
      throw AppError.badRequest(
        `Benefits (Empty Packet ₹${emptyPacketBenefit} + Coupon ₹${couponBenefit} = ₹${totalBenefits}) exceed Net Sales (₹${netSales})`
      );
    }

    const expectedHandover = Math.round((netSales - totalBenefits) * 100) / 100;

    // 7. Collection Calculation
    if (cashCollectedInput < 0) {
      throw AppError.badRequest('Cash collected cannot be negative');
    }
    if (gpayCollectedInput < 0) {
      throw AppError.badRequest('GPay collected cannot be negative');
    }

    let cashCollected = Math.round(cashCollectedInput * 100) / 100;
    let gpayCollected = Math.round(gpayCollectedInput * 100) / 100;
    let collectionTotal = Math.round((cashCollected + gpayCollected) * 100) / 100;
    let outstanding = 0;
    let excess = 0;
    let status: HandoverStatus = desiredStatus || HandoverStatus.DRAFT;

    if (isCollectionProvided) {
      if (collectionTotal < expectedHandover) {
        outstanding = Math.round((expectedHandover - collectionTotal) * 100) / 100;
        excess = 0;
        status = HandoverStatus.SHORT;
      } else if (collectionTotal === expectedHandover) {
        outstanding = 0;
        excess = 0;
        status = HandoverStatus.SETTLED;
      } else {
        outstanding = 0;
        excess = Math.round((collectionTotal - expectedHandover) * 100) / 100;
        status = HandoverStatus.EXCESS;
      }
    } else {
      // If collection was not recorded yet
      if (status !== HandoverStatus.SUBMITTED && status !== HandoverStatus.DRAFT) {
        status = HandoverStatus.DRAFT;
      }
      outstanding = expectedHandover;
      excess = 0;
      cashCollected = 0;
      gpayCollected = 0;
      collectionTotal = 0;
    }

    return {
      calculatedItems,
      calculatedEmptyPackets,
      calculatedCoupons,
      totals: {
        grossSales,
        totalItemDiscount,
        netSales,
        freeItemValue,
        emptyPacketBenefit,
        couponBenefit,
        expectedHandover,
        cashCollected,
        gpayCollected,
        collectionTotal,
        outstanding,
        excess,
        status,
      },
    };
  }

  /**
   * Create a Daily Handover document.
   */
  static async createDailyHandover(
    input: CreateDailyHandoverInput,
    currentUser: { userId: string; role: string; personId?: string }
  ) {
    const handoverDate = this.parseHandoverDate(input.handoverDate);

    // 1. Recipient Validation
    if (input.recipientType === HandoverRecipientType.SALESMAN) {
      if (!input.salesmanId) {
        throw AppError.badRequest('salesmanId is required when recipientType is SALESMAN');
      }
      if (input.dealerId) {
        throw AppError.badRequest('dealerId must not be provided when recipientType is SALESMAN');
      }

      // Salesman role security
      if (currentUser.role === UserRole.SALESMAN) {
        const userPersonId = await this.getSalesmanPersonId(currentUser);
        if (!userPersonId || userPersonId !== input.salesmanId) {
          throw AppError.forbidden('Salesman cannot create a daily handover for another person');
        }
      }

      const salesman = await prisma.person.findUnique({
        where: { id: input.salesmanId },
        include: { user: true },
      });

      if (!salesman) {
        throw AppError.notFound(`Salesman with ID "${input.salesmanId}" not found`);
      }
      if (salesman.type === PersonType.DEALER) {
        throw AppError.badRequest('Dealer cannot be a salesman recipient');
      }
      if (salesman.type === PersonType.STAFF) {
        throw AppError.badRequest('Staff cannot be a salesman recipient');
      }
      if (salesman.type !== PersonType.SALESMAN) {
        throw AppError.badRequest(`Recipient must be a Salesman. Found ${salesman.type}`);
      }
      if (!salesman.active) {
        throw AppError.badRequest(`Cannot create handover for inactive salesman "${salesman.name}"`);
      }
      if (salesman.user) {
        if (salesman.user.role === UserRole.ADMIN) {
          throw AppError.badRequest('Admin cannot be a salesman recipient');
        }
        if (!salesman.user.isActive) {
          throw AppError.badRequest(`Cannot create handover for deactivated salesman "${salesman.name}"`);
        }
      }

      // Section 50: Duplicate Salesman Handover Protection
      const existing = await prisma.dailyHandover.findUnique({
        where: {
          salesmanId_handoverDate: {
            salesmanId: input.salesmanId,
            handoverDate,
          },
        },
      });

      if (existing) {
        throw AppError.conflict(
          `A daily handover already exists for salesman "${salesman.name}" on ${input.handoverDate}`
        );
      }
    } else if (input.recipientType === HandoverRecipientType.DEALER) {
      if (currentUser.role === UserRole.SALESMAN) {
        throw AppError.forbidden('Salesman cannot create Dealer handovers');
      }
      if (!input.dealerId) {
        throw AppError.badRequest('dealerId is required when recipientType is DEALER');
      }
      if (input.salesmanId) {
        throw AppError.badRequest('salesmanId must not be provided when recipientType is DEALER');
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
        throw AppError.badRequest(`Cannot create handover for inactive dealer "${dealer.name}"`);
      }
    } else {
      throw AppError.badRequest(`Invalid recipientType "${input.recipientType}"`);
    }

    // 2. Determine initial status and collection state
    const isCollectionProvided =
      currentUser.role === UserRole.ADMIN &&
      (input.cashCollected !== undefined || input.gpayCollected !== undefined);

    let initialStatus = input.status || HandoverStatus.DRAFT;
    if (currentUser.role === UserRole.SALESMAN) {
      // Salesman cannot create already-settled or reviewed handovers
      if (initialStatus !== HandoverStatus.DRAFT && initialStatus !== HandoverStatus.SUBMITTED) {
        initialStatus = HandoverStatus.DRAFT;
      }
    }

    // 3. Run atomic transaction
    return prisma.$transaction(async (tx) => {
      const { calculatedItems, calculatedEmptyPackets, calculatedCoupons, totals } =
        await this.calculateTotals(
          input.items,
          input.emptyPackets || [],
          input.coupons || [],
          input.cashCollected || 0,
          input.gpayCollected || 0,
          isCollectionProvided,
          initialStatus,
          tx
        );

      const handover = await tx.dailyHandover.create({
        data: {
          recipientType: input.recipientType,
          salesmanId: input.recipientType === HandoverRecipientType.SALESMAN ? input.salesmanId : null,
          dealerId: input.recipientType === HandoverRecipientType.DEALER ? input.dealerId : null,
          handoverDate,
          status: totals.status,
          customerName: input.customerName || null,
          customerPhone: input.customerPhone || null,
          grossSales: totals.grossSales,
          totalItemDiscount: totals.totalItemDiscount,
          netSales: totals.netSales,
          freeItemValue: totals.freeItemValue,
          emptyPacketBenefit: totals.emptyPacketBenefit,
          couponBenefit: totals.couponBenefit,
          expectedHandover: totals.expectedHandover,
          cashCollected: totals.cashCollected,
          gpayCollected: totals.gpayCollected,
          collectionTotal: totals.collectionTotal,
          outstanding: totals.outstanding,
          excess: totals.excess,
          submittedBy: currentUser.userId,
          submittedAt: totals.status === HandoverStatus.SUBMITTED ? new Date() : null,
          reviewedBy: isCollectionProvided ? currentUser.userId : null,
          reviewedAt: isCollectionProvided ? new Date() : null,
          notes: input.notes || null,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              uom: item.uom,
              openingQuantity: item.openingQuantity,
              closingQuantity: item.closingQuantity,
              salesQuantity: item.salesQuantity,
              freeQuantity: item.freeQuantity,
              chargeableQuantity: item.chargeableQuantity,
              rate: item.rate,
              grossAmount: item.grossAmount,
              freeItemValue: item.freeItemValue,
              discount: item.discount,
              netAmount: item.netAmount,
              baseSalesQuantity: item.baseSalesQuantity,
            })),
          },
          emptyPackets: {
            create: calculatedEmptyPackets.map((ep) => ({
              productId: ep.productId || null,
              quantity: ep.quantity,
              actualAmount: ep.actualAmount,
            })),
          },
          coupons: {
            create: calculatedCoupons.map((c) => ({
              productId: c.productId || null,
              denomination: c.denomination,
              quantity: c.quantity,
              amount: c.amount,
            })),
          },
        },
        include: {
          salesman: { select: { id: true, name: true, phone: true } },
          dealer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, brand: true, salesRate: true },
              },
            },
          },
          emptyPackets: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          coupons: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Phase 2I: If salesman handover created already short, record ledger debit
      if (
        input.recipientType === HandoverRecipientType.SALESMAN &&
        totals.status === HandoverStatus.SHORT &&
        totals.outstanding > 0 &&
        input.salesmanId
      ) {
        await tx.salesmanLedgerTransaction.create({
          data: {
            salesmanId: input.salesmanId,
            transactionDate: handoverDate,
            type: LedgerTransactionType.HANDOVER_SHORT,
            direction: LedgerDirection.DEBIT,
            amount: totals.outstanding,
            referenceType: LedgerReferenceType.DAILY_HANDOVER,
            referenceId: handover.id,
            dailyHandoverId: handover.id,
            notes: `Shortage from daily handover on ${input.handoverDate}`,
            createdBy: currentUser.userId,
          },
        });
      }

      return handover;
    });
  }

  /**
   * Update a Daily Handover (Draft only).
   */
  static async updateDailyHandover(
    id: string,
    input: UpdateDailyHandoverInput,
    currentUser: { userId: string; role: string; personId?: string }
  ) {
    const existing = await prisma.dailyHandover.findUnique({
      where: { id },
      include: {
        items: true,
        emptyPackets: true,
        coupons: true,
      },
    });

    if (!existing) {
      throw AppError.notFound(`Daily handover with ID "${id}" not found`);
    }

    // Role check
    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (existing.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot update another person\'s daily handover');
      }
    }

    // Immutability: only DRAFT handovers can be updated
    if (existing.status !== HandoverStatus.DRAFT) {
      throw AppError.badRequest(
        `Cannot update handover with status "${existing.status}". Only DRAFT handovers can be modified.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // If items, emptyPackets, or coupons are being replaced:
      const itemsToProcess = input.items || existing.items.map((i) => ({
        productId: i.productId,
        uom: i.uom,
        openingQuantity: Number(i.openingQuantity),
        closingQuantity: Number(i.closingQuantity),
        freeQuantity: Number(i.freeQuantity),
        discount: Number(i.discount),
      }));

      const emptyPacketsToProcess =
        input.emptyPackets !== undefined
          ? input.emptyPackets
          : existing.emptyPackets.map((ep) => ({
              productId: ep.productId || undefined,
              quantity: Number(ep.quantity),
              actualAmount: Number(ep.actualAmount),
            }));

      const couponsToProcess =
        input.coupons !== undefined
          ? input.coupons
          : existing.coupons.map((c) => ({
              productId: c.productId || undefined,
              denomination: Number(c.denomination),
              quantity: Number(c.quantity),
            }));

      const { calculatedItems, calculatedEmptyPackets, calculatedCoupons, totals } =
        await this.calculateTotals(
          itemsToProcess,
          emptyPacketsToProcess,
          couponsToProcess,
          Number(existing.cashCollected),
          Number(existing.gpayCollected),
          false,
          existing.status,
          tx
        );

      // Delete existing sub-records if replacing
      if (input.items) {
        await tx.dailyHandoverItem.deleteMany({ where: { handoverId: id } });
      }
      if (input.emptyPackets !== undefined) {
        await tx.dailyHandoverEmptyPacket.deleteMany({ where: { handoverId: id } });
      }
      if (input.coupons !== undefined) {
        await tx.dailyHandoverCoupon.deleteMany({ where: { handoverId: id } });
      }

      const updated = await tx.dailyHandover.update({
        where: { id },
        data: {
          customerName: input.customerName !== undefined ? input.customerName : existing.customerName,
          customerPhone: input.customerPhone !== undefined ? input.customerPhone : existing.customerPhone,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          grossSales: totals.grossSales,
          totalItemDiscount: totals.totalItemDiscount,
          netSales: totals.netSales,
          freeItemValue: totals.freeItemValue,
          emptyPacketBenefit: totals.emptyPacketBenefit,
          couponBenefit: totals.couponBenefit,
          expectedHandover: totals.expectedHandover,
          outstanding: totals.outstanding,
          excess: totals.excess,
          ...(input.items
            ? {
                items: {
                  create: calculatedItems.map((item) => ({
                    productId: item.productId,
                    uom: item.uom,
                    openingQuantity: item.openingQuantity,
                    closingQuantity: item.closingQuantity,
                    salesQuantity: item.salesQuantity,
                    freeQuantity: item.freeQuantity,
                    chargeableQuantity: item.chargeableQuantity,
                    rate: item.rate,
                    grossAmount: item.grossAmount,
                    freeItemValue: item.freeItemValue,
                    discount: item.discount,
                    netAmount: item.netAmount,
                    baseSalesQuantity: item.baseSalesQuantity,
                  })),
                },
              }
            : {}),
          ...(input.emptyPackets !== undefined
            ? {
                emptyPackets: {
                  create: calculatedEmptyPackets.map((ep) => ({
                    productId: ep.productId || null,
                    quantity: ep.quantity,
                    actualAmount: ep.actualAmount,
                  })),
                },
              }
            : {}),
          ...(input.coupons !== undefined
            ? {
                coupons: {
                  create: calculatedCoupons.map((c) => ({
                    productId: c.productId || null,
                    denomination: c.denomination,
                    quantity: c.quantity,
                    amount: c.amount,
                  })),
                },
              }
            : {}),
        },
        include: {
          salesman: { select: { id: true, name: true, phone: true } },
          dealer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, brand: true, salesRate: true },
              },
            },
          },
          emptyPackets: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          coupons: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Submit a Daily Handover (Salesman or Admin). Transitions status to SUBMITTED.
   */
  static async submitDailyHandover(
    id: string,
    currentUser: { userId: string; role: string; personId?: string }
  ) {
    const existing = await prisma.dailyHandover.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound(`Daily handover with ID "${id}" not found`);
    }

    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (existing.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot submit another person\'s daily handover');
      }
    }

    if (existing.status !== HandoverStatus.DRAFT) {
      throw AppError.badRequest(
        `Cannot submit handover with status "${existing.status}". Only DRAFT handovers can be submitted.`
      );
    }

    const updated = await prisma.dailyHandover.update({
      where: { id },
      data: {
        status: HandoverStatus.SUBMITTED,
        submittedBy: currentUser.userId,
        submittedAt: new Date(),
      },
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
        dealer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, category: true, brand: true, salesRate: true },
            },
          },
        },
        emptyPackets: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        coupons: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return updated;
  }

  /**
   * Admin-only: Record Cash and GPay collection and finalize review.
   */
  static async recordCollection(
    id: string,
    input: RecordCollectionInput,
    currentUser: { userId: string; role: string }
  ) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can record and finalize handover collection');
    }

    const existing = await prisma.dailyHandover.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound(`Daily handover with ID "${id}" not found`);
    }

    // Cannot modify settled handover if already finalized
    if (
      existing.status === HandoverStatus.SETTLED ||
      existing.status === HandoverStatus.SHORT ||
      existing.status === HandoverStatus.EXCESS
    ) {
      throw AppError.badRequest(
        `Daily handover is already finalized with status "${existing.status}". Historical collections are immutable.`
      );
    }

    if (input.cashCollected < 0) {
      throw AppError.badRequest('Cash collected cannot be negative');
    }
    if (input.gpayCollected < 0) {
      throw AppError.badRequest('GPay collected cannot be negative');
    }

    const expectedHandover = Number(existing.expectedHandover);
    const collectionTotal = input.cashCollected + input.gpayCollected;
    let outstanding = 0;
    let excess = 0;
    let status: HandoverStatus = HandoverStatus.SETTLED;

    if (collectionTotal < expectedHandover) {
      outstanding = expectedHandover - collectionTotal;
      excess = 0;
      status = HandoverStatus.SHORT;
    } else if (collectionTotal === expectedHandover) {
      outstanding = 0;
      excess = 0;
      status = HandoverStatus.SETTLED;
    } else {
      outstanding = 0;
      excess = collectionTotal - expectedHandover;
      status = HandoverStatus.EXCESS;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.dailyHandover.update({
        where: { id },
        data: {
          cashCollected: input.cashCollected,
          gpayCollected: input.gpayCollected,
          collectionTotal,
          outstanding,
          excess,
          status,
          reviewedBy: currentUser.userId,
          reviewedAt: new Date(),
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
        include: {
          salesman: { select: { id: true, name: true, phone: true } },
          dealer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, brand: true, salesRate: true },
              },
            },
          },
          emptyPackets: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          coupons: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Phase 2I: If salesman handover and short, create ledger entry
      if (
        existing.recipientType === HandoverRecipientType.SALESMAN &&
        status === HandoverStatus.SHORT &&
        outstanding > 0 &&
        existing.salesmanId
      ) {
        await tx.salesmanLedgerTransaction.upsert({
          where: {
            dailyHandoverId_type: {
              dailyHandoverId: existing.id,
              type: LedgerTransactionType.HANDOVER_SHORT,
            },
          },
          create: {
            salesmanId: existing.salesmanId,
            transactionDate: existing.handoverDate,
            type: LedgerTransactionType.HANDOVER_SHORT,
            direction: LedgerDirection.DEBIT,
            amount: outstanding,
            referenceType: LedgerReferenceType.DAILY_HANDOVER,
            referenceId: existing.id,
            dailyHandoverId: existing.id,
            notes: `Shortage from daily handover on ${this.formatHandoverDate(existing.handoverDate)}`,
            createdBy: currentUser.userId,
          },
          update: {},
        });
      }

      return updated;
    });
  }

  /**
   * Get a single Daily Handover by ID.
   */
  static async getDailyHandoverById(
    id: string,
    currentUser: { userId: string; role: string; personId?: string }
  ) {
    const handover = await prisma.dailyHandover.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
        dealer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, category: true, brand: true, salesRate: true },
            },
          },
        },
        emptyPackets: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        coupons: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!handover) {
      throw AppError.notFound(`Daily handover with ID "${id}" not found`);
    }

    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (handover.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot access another person\'s daily handover');
      }
    }

    return handover;
  }

  /**
   * List Daily Handovers with filtering.
   */
  static async listDailyHandovers(
    filters: DailyHandoverFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ) {
    const where: Prisma.DailyHandoverWhereInput = {};

    // Role-based scope enforcement
    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (!userPersonId) {
        throw AppError.forbidden('Salesman user profile is not linked to a Person record');
      }
      if (filters.salesmanId && filters.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot query daily handovers for other salesmen');
      }
      where.salesmanId = userPersonId;
    } else {
      // Admin filters
      if (filters.salesmanId) {
        where.salesmanId = filters.salesmanId;
      }
      if (filters.dealerId) {
        where.dealerId = filters.dealerId;
      }
      if (filters.recipientType) {
        where.recipientType = filters.recipientType;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.handoverDate) {
      where.handoverDate = this.parseHandoverDate(filters.handoverDate);
    } else if (filters.startDate || filters.endDate) {
      where.handoverDate = {};
      if (filters.startDate) {
        where.handoverDate.gte = this.parseHandoverDate(filters.startDate);
      }
      if (filters.endDate) {
        where.handoverDate.lte = this.parseHandoverDate(filters.endDate);
      }
    }

    if (filters.productId) {
      where.items = {
        some: { productId: filters.productId },
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, handovers] = await Promise.all([
      prisma.dailyHandover.count({ where }),
      prisma.dailyHandover.findMany({
        where,
        skip,
        take: limit,
        orderBy: { handoverDate: 'desc' },
        include: {
          salesman: { select: { id: true, name: true, phone: true } },
          dealer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, brand: true, salesRate: true },
              },
            },
          },
          emptyPackets: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          coupons: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: handovers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
