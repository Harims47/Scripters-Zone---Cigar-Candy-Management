import { Prisma, HandoverStatus, HandoverRecipientType, UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  SalesLedgerFilters,
  SalesLedgerSummaryFilters,
  SalesLedgerKpis,
  SalesLedgerListResponse,
  SalesLedgerRow,
  SalesLedgerItemRow,
} from './sales-ledger.types.js';

export class SalesLedgerService {
  /**
   * Finalized/eligible financial statuses for Daily Handover.
   * DRAFT handovers are strictly excluded from finalized sales reporting.
   */
  public static readonly ELIGIBLE_STATUSES: HandoverStatus[] = [
    HandoverStatus.SUBMITTED,
    HandoverStatus.REVIEWED,
    HandoverStatus.SETTLED,
    HandoverStatus.SHORT,
    HandoverStatus.EXCESS,
  ];

  /**
   * Helper: Parse YYYY-MM-DD string to UTC Date.
   */
  public static parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /**
   * Helper: Format Date to YYYY-MM-DD.
   */
  public static formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Resolve personId for salesman user.
   */
  private static async resolveSalesmanPersonId(currentUser: { userId: string; role: string; personId?: string }): Promise<string> {
    if (currentUser.personId) return currentUser.personId;
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { personId: true },
    });
    if (!user?.personId) {
      throw AppError.forbidden('Salesman user profile is not associated with a person record');
    }
    return user.personId;
  }

  /**
   * Build base Prisma where condition for Daily Handover filtering with role security.
   */
  private static async buildWhere(
    filters: SalesLedgerSummaryFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<Prisma.DailyHandoverWhereInput> {
    const where: Prisma.DailyHandoverWhereInput = {
      status: { in: this.ELIGIBLE_STATUSES },
    };

    // Date range filter
    if (filters.fromDate || filters.toDate) {
      where.handoverDate = {
        ...(filters.fromDate ? { gte: this.parseDate(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: this.parseDate(filters.toDate) } : {}),
      };
    }

    // Role-based security & isolation
    if (currentUser.role === UserRole.SALESMAN) {
      const ownPersonId = await this.resolveSalesmanPersonId(currentUser);
      if (filters.dealerId || (filters.recipientType && filters.recipientType !== HandoverRecipientType.SALESMAN)) {
        throw AppError.forbidden('Salesman cannot access dealer sales records');
      }
      if (filters.salesmanId && filters.salesmanId !== ownPersonId) {
        throw AppError.forbidden('Salesman can only view their own sales records');
      }
      where.recipientType = HandoverRecipientType.SALESMAN;
      where.salesmanId = ownPersonId;
    } else {
      // Admin filters
      if (filters.recipientType) {
        where.recipientType = filters.recipientType;
      }
      if (filters.salesmanId) {
        where.salesmanId = filters.salesmanId;
      }
      if (filters.dealerId) {
        where.dealerId = filters.dealerId;
      }
    }

    // Product filter: filter handovers containing this product
    if (filters.productId) {
      where.items = {
        some: {
          productId: filters.productId,
        },
      };
    }

    return where;
  }

  /**
   * Calculate consolidated Sales Ledger KPIs.
   */
  static async getSummary(
    filters: SalesLedgerSummaryFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<SalesLedgerKpis> {
    const where = await this.buildWhere(filters, currentUser);

    if (!filters.productId) {
      // Fast database-level aggregation across all handovers
      const agg = await prisma.dailyHandover.aggregate({
        where,
        _sum: {
          grossSales: true,
          totalItemDiscount: true,
          netSales: true,
          emptyPacketBenefit: true,
          couponBenefit: true,
          expectedHandover: true,
          collectionTotal: true,
          outstanding: true,
          excess: true,
        },
      });

      const totalGrossSales = agg._sum.grossSales || new Prisma.Decimal(0);
      const totalDiscount = agg._sum.totalItemDiscount || new Prisma.Decimal(0);
      const totalNetSales = totalGrossSales.minus(totalDiscount);
      const totalEmptyPacket = agg._sum.emptyPacketBenefit || new Prisma.Decimal(0);
      const totalCoupon = agg._sum.couponBenefit || new Prisma.Decimal(0);
      const totalExpectedHandover = totalNetSales.minus(totalEmptyPacket).minus(totalCoupon);
      const totalCollection = agg._sum.collectionTotal || new Prisma.Decimal(0);
      const totalOutstanding = agg._sum.outstanding || new Prisma.Decimal(0);
      const totalExcess = agg._sum.excess || new Prisma.Decimal(0);

      return {
        totalGrossSales: totalGrossSales.toNumber(),
        totalDiscount: totalDiscount.toNumber(),
        totalNetSales: totalNetSales.toNumber(),
        totalEmptyPacket: totalEmptyPacket.toNumber(),
        totalCoupon: totalCoupon.toNumber(),
        totalExpectedHandover: totalExpectedHandover.toNumber(),
        totalCollection: totalCollection.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        totalExcess: totalExcess.toNumber(),
      };
    } else {
      // Product-specific filtering
      const [itemAgg, handoverAgg] = await Promise.all([
        prisma.dailyHandoverItem.aggregate({
          where: {
            productId: filters.productId,
            handover: where,
          },
          _sum: {
            grossAmount: true,
            discount: true,
            netAmount: true,
          },
        }),
        prisma.dailyHandover.aggregate({
          where,
          _sum: {
            emptyPacketBenefit: true,
            couponBenefit: true,
            collectionTotal: true,
            outstanding: true,
            excess: true,
          },
        }),
      ]);

      const totalGrossSales = itemAgg._sum.grossAmount || new Prisma.Decimal(0);
      const totalDiscount = itemAgg._sum.discount || new Prisma.Decimal(0);
      const totalNetSales = totalGrossSales.minus(totalDiscount);
      const totalEmptyPacket = handoverAgg._sum.emptyPacketBenefit || new Prisma.Decimal(0);
      const totalCoupon = handoverAgg._sum.couponBenefit || new Prisma.Decimal(0);
      const totalExpectedHandover = totalNetSales.minus(totalEmptyPacket).minus(totalCoupon);
      const totalCollection = handoverAgg._sum.collectionTotal || new Prisma.Decimal(0);
      const totalOutstanding = handoverAgg._sum.outstanding || new Prisma.Decimal(0);
      const totalExcess = handoverAgg._sum.excess || new Prisma.Decimal(0);

      return {
        totalGrossSales: totalGrossSales.toNumber(),
        totalDiscount: totalDiscount.toNumber(),
        totalNetSales: totalNetSales.toNumber(),
        totalEmptyPacket: totalEmptyPacket.toNumber(),
        totalCoupon: totalCoupon.toNumber(),
        totalExpectedHandover: totalExpectedHandover.toNumber(),
        totalCollection: totalCollection.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        totalExcess: totalExcess.toNumber(),
      };
    }
  }

  /**
   * Get detailed Sales Ledger list with KPIs, paginated rows, and product details.
   */
  static async getSalesLedger(
    filters: SalesLedgerFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<SalesLedgerListResponse> {
    const where = await this.buildWhere(filters, currentUser);

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Concurrently fetch summary KPIs, total row count, and paginated records
    const [kpis, total, handovers] = await Promise.all([
      this.getSummary(filters, currentUser),
      prisma.dailyHandover.count({ where }),
      prisma.dailyHandover.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ handoverDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { id: true, name: true } },
          dealer: { select: { id: true, name: true } },
          items: {
            where: filters.productId ? { productId: filters.productId } : undefined,
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const rows: SalesLedgerRow[] = handovers.map((h) => {
      const items: SalesLedgerItemRow[] = h.items.map((it) => ({
        productId: it.productId,
        productName: it.product.name,
        productSku: it.product.sku,
        category: it.product.category,
        brand: it.product.brand,
        uom: it.uom,
        openingQuantity: it.openingQuantity.toNumber(),
        closingQuantity: it.closingQuantity.toNumber(),
        salesQuantity: it.salesQuantity.toNumber(),
        freeQuantity: it.freeQuantity.toNumber(),
        chargeableQuantity: it.chargeableQuantity.toNumber(),
        rate: it.rate.toNumber(),
        grossAmount: it.grossAmount.toNumber(),
        freeItemValue: it.freeItemValue.toNumber(),
        discount: it.discount.toNumber(),
        netAmount: it.netAmount.toNumber(),
        baseSalesQuantity: it.baseSalesQuantity ? it.baseSalesQuantity.toNumber() : null,
      }));

      // Calculate row-level totals
      let rowGross: Prisma.Decimal;
      let rowDiscount: Prisma.Decimal;
      let rowNet: Prisma.Decimal;

      if (filters.productId) {
        // If product-filtered, compute row gross and discount strictly from matching items
        rowGross = items.reduce((acc, it) => acc.plus(new Prisma.Decimal(it.grossAmount)), new Prisma.Decimal(0));
        rowDiscount = items.reduce((acc, it) => acc.plus(new Prisma.Decimal(it.discount)), new Prisma.Decimal(0));
        rowNet = rowGross.minus(rowDiscount);
      } else {
        rowGross = h.grossSales;
        rowDiscount = h.totalItemDiscount;
        rowNet = h.netSales;
      }

      const emptyPacket = h.emptyPacketBenefit.toNumber();
      const coupon = h.couponBenefit.toNumber();
      const expectedHandover = rowNet.minus(h.emptyPacketBenefit).minus(h.couponBenefit).toNumber();

      return {
        handoverId: h.id,
        handoverDate: this.formatDate(h.handoverDate),
        recipientType: h.recipientType,
        salesmanId: h.salesmanId,
        salesmanName: h.salesman?.name || null,
        dealerId: h.dealerId,
        dealerName: h.dealer?.name || null,
        customerName: h.customerName,
        customerPhone: h.customerPhone,
        status: h.status,
        isProvisional: h.status === HandoverStatus.SUBMITTED,
        grossSales: rowGross.toNumber(),
        itemDiscount: rowDiscount.toNumber(),
        netSales: rowNet.toNumber(),
        emptyPacket,
        coupon,
        expectedHandover,
        cashCollected: h.cashCollected.toNumber(),
        gpayCollected: h.gpayCollected.toNumber(),
        collectionTotal: h.collectionTotal.toNumber(),
        outstanding: h.outstanding.toNumber(),
        excess: h.excess.toNumber(),
        items,
      };
    });

    return {
      kpis,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
