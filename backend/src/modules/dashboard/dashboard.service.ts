import { Prisma, HandoverStatus, HandoverRecipientType, UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import {
  DashboardFilters,
  AdminDashboardResponse,
  CumulativeItemSoldRow,
  CumulativeItemsSoldSummary,
  DashboardRecentActivityItem,
} from './dashboard.types.js';

export class DashboardService {
  public static readonly ELIGIBLE_STATUSES: HandoverStatus[] = [
    HandoverStatus.SUBMITTED,
    HandoverStatus.REVIEWED,
    HandoverStatus.SETTLED,
    HandoverStatus.SHORT,
    HandoverStatus.EXCESS,
  ];

  public static parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  public static formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Get Admin Dashboard consolidated metrics.
   */
  static async getAdminDashboard(
    filters: DashboardFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<AdminDashboardResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can access the operational command center dashboard');
    }

    // Determine effective date range
    let effectiveFromDate = filters.fromDate;
    let effectiveToDate = filters.toDate;

    if (!effectiveFromDate || !effectiveToDate) {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const lastDay = new Date(Date.UTC(year, now.getUTCMonth() + 1, 0)).getUTCDate();
      if (!effectiveFromDate) {
        effectiveFromDate = `${year}-${month}-01`;
      }
      if (!effectiveToDate) {
        effectiveToDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    const fromDateObj = this.parseDate(effectiveFromDate);
    const toDateObj = this.parseDate(effectiveToDate);

    const handoverWhere: Prisma.DailyHandoverWhereInput = {
      status: { in: this.ELIGIBLE_STATUSES },
      handoverDate: {
        gte: fromDateObj,
        lte: toDateObj,
      },
    };

    // Concurrently fetch:
    // 1. Handover items for Cumulative Items Sold
    // 2. Handover aggregated totals
    // 3. Dealer & Salesman netSales breakdown
    // 4. Sales targets in date range
    // 5. Expense summary
    // 6. Recent finalized handovers
    const [
      handoverItems,
      handoverAgg,
      salesmanHandoversAgg,
      dealerHandoversAgg,
      targetAgg,
      expenseSummary,
      recentHandovers,
    ] = await Promise.all([
      prisma.dailyHandoverItem.findMany({
        where: {
          handover: handoverWhere,
        },
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
      }),
      prisma.dailyHandover.aggregate({
        where: handoverWhere,
        _sum: {
          grossSales: true,
          totalItemDiscount: true,
          netSales: true,
          emptyPacketBenefit: true,
          couponBenefit: true,
          expectedHandover: true,
          cashCollected: true,
          gpayCollected: true,
          collectionTotal: true,
          outstanding: true,
          excess: true,
        },
      }),
      prisma.dailyHandover.aggregate({
        where: {
          ...handoverWhere,
          recipientType: HandoverRecipientType.SALESMAN,
        },
        _sum: {
          netSales: true,
        },
      }),
      prisma.dailyHandover.aggregate({
        where: {
          ...handoverWhere,
          recipientType: HandoverRecipientType.DEALER,
        },
        _sum: {
          netSales: true,
        },
      }),
      prisma.salesTarget.aggregate({
        where: {
          active: true,
          targetDate: {
            gte: fromDateObj,
            lte: toDateObj,
          },
        },
        _sum: {
          dailyRevenueTarget: true,
        },
      }),
      ExpensesService.getExpenseSummary(
        { fromDate: effectiveFromDate, toDate: effectiveToDate },
        currentUser
      ),
      prisma.dailyHandover.findMany({
        where: handoverWhere,
        take: 5,
        orderBy: [{ handoverDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { name: true } },
          dealer: { select: { name: true } },
        },
      }),
    ]);

    // 1. Process Cumulative Items Sold
    const itemMap = new Map<string, CumulativeItemSoldRow>();

    for (const it of handoverItems) {
      const existing = itemMap.get(it.productId) || {
        productId: it.productId,
        productName: it.product.name,
        productSku: it.product.sku,
        category: it.product.category,
        brand: it.product.brand,
        salesQuantity: 0,
        baseSalesQuantity: 0,
        freeQuantity: 0,
        chargeableQuantity: 0,
        grossSalesValue: 0,
        itemDiscount: 0,
        netItemSalesValue: 0,
      };

      const salesQty = it.salesQuantity.toNumber();
      const baseSalesQty = (it.baseSalesQuantity || it.salesQuantity).toNumber();
      const freeQty = it.freeQuantity.toNumber();
      const chargeableQty = it.chargeableQuantity.toNumber();
      const grossVal = it.grossAmount.toNumber();
      const disc = it.discount.toNumber();
      const netVal = it.netAmount.toNumber();

      existing.salesQuantity += salesQty;
      existing.baseSalesQuantity += baseSalesQty;
      existing.freeQuantity += freeQty;
      existing.chargeableQuantity += chargeableQty;
      existing.grossSalesValue += grossVal;
      existing.itemDiscount += disc;
      existing.netItemSalesValue += netVal;

      itemMap.set(it.productId, existing);
    }

    const items = Array.from(itemMap.values()).sort((a, b) => b.netItemSalesValue - a.netItemSalesValue);

    const totalSalesQty = items.reduce((sum, r) => sum + r.salesQuantity, 0);
    const totalBaseSalesQty = items.reduce((sum, r) => sum + r.baseSalesQuantity, 0);
    const totalFreeQty = items.reduce((sum, r) => sum + r.freeQuantity, 0);
    const totalChargeableQty = items.reduce((sum, r) => sum + r.chargeableQuantity, 0);
    const totalGrossValue = items.reduce((sum, r) => sum + r.grossSalesValue, 0);
    const totalItemDiscount = items.reduce((sum, r) => sum + r.itemDiscount, 0);
    const totalNetItemsSoldValue = items.reduce((sum, r) => sum + r.netItemSalesValue, 0);

    const cumulativeItemsSold: CumulativeItemsSoldSummary = {
      items,
      totalSalesQty,
      totalBaseSalesQty,
      totalFreeQty,
      totalChargeableQty,
      totalGrossValue,
      totalItemDiscount,
      totalNetItemsSoldValue,
    };

    // 2. Sales Summary
    const grossSalesDec = handoverAgg._sum.grossSales || new Prisma.Decimal(0);
    const discountDec = handoverAgg._sum.totalItemDiscount || new Prisma.Decimal(0);
    const netSalesDec = grossSalesDec.minus(discountDec);
    const emptyPacketDec = handoverAgg._sum.emptyPacketBenefit || new Prisma.Decimal(0);
    const couponDec = handoverAgg._sum.couponBenefit || new Prisma.Decimal(0);
    const expectedHandoverDec = netSalesDec.minus(emptyPacketDec).minus(couponDec);
    const salesmanSalesDec = salesmanHandoversAgg._sum.netSales || new Prisma.Decimal(0);
    const dealerSalesDec = dealerHandoversAgg._sum.netSales || new Prisma.Decimal(0);

    const salesSummary = {
      grossSales: grossSalesDec.toNumber(),
      discount: discountDec.toNumber(),
      netSales: netSalesDec.toNumber(),
      emptyPacket: emptyPacketDec.toNumber(),
      coupon: couponDec.toNumber(),
      expectedHandover: expectedHandoverDec.toNumber(),
      dealerSales: dealerSalesDec.toNumber(),
      salesmanSales: salesmanSalesDec.toNumber(),
    };

    // 3. Target Summary
    const targetRevenueDec = targetAgg._sum.dailyRevenueTarget || new Prisma.Decimal(0);
    const totalDailyRevenueTarget = targetRevenueDec.toNumber();
    const actualNetSales = salesmanSalesDec.toNumber();
    const targetAchievementAmount = actualNetSales;
    const targetRemainingAmount = Math.max(0, totalDailyRevenueTarget - actualNetSales);
    const achievementPercentage =
      totalDailyRevenueTarget > 0 ? Math.round((actualNetSales / totalDailyRevenueTarget) * 100) : 0;

    const targetSummary = {
      totalDailyRevenueTarget,
      actualNetSales,
      targetAchievementAmount,
      targetRemainingAmount,
      achievementPercentage,
    };

    // 4. Collection Summary
    const cashCollectedDec = handoverAgg._sum.cashCollected || new Prisma.Decimal(0);
    const gpayCollectedDec = handoverAgg._sum.gpayCollected || new Prisma.Decimal(0);
    const collectionTotalDec = handoverAgg._sum.collectionTotal || new Prisma.Decimal(0);
    const outstandingDec = handoverAgg._sum.outstanding || new Prisma.Decimal(0);
    const excessDec = handoverAgg._sum.excess || new Prisma.Decimal(0);

    const collectionSummary = {
      expectedHandover: expectedHandoverDec.toNumber(),
      cashCollected: cashCollectedDec.toNumber(),
      gpayCollected: gpayCollectedDec.toNumber(),
      collectionTotal: collectionTotalDec.toNumber(),
      outstanding: outstandingDec.toNumber(),
      excess: excessDec.toNumber(),
    };

    // 5. Outstanding Summary
    const outstandingSummary = {
      totalOutstanding: outstandingDec.toNumber(),
      totalExcess: excessDec.toNumber(),
    };

    // 6. P&L Summary
    const netRevenueDec = grossSalesDec.minus(discountDec);
    const operatingExpensesDec = new Prisma.Decimal(expenseSummary.operatingExpenses);
    const grossProfitDec = netRevenueDec.minus(operatingExpensesDec);

    const pnlSummary = {
      grossSales: grossSalesDec.toNumber(),
      discount: discountDec.toNumber(),
      netRevenue: netRevenueDec.toNumber(),
      operatingExpenses: operatingExpensesDec.toNumber(),
      grossProfit: grossProfitDec.toNumber(),
    };

    // 7. Recent Activity
    const recentActivity: DashboardRecentActivityItem[] = recentHandovers.map((h) => ({
      id: h.id,
      handoverDate: this.formatDate(h.handoverDate),
      recipientType: h.recipientType,
      recipientName: h.recipientType === HandoverRecipientType.SALESMAN ? h.salesman?.name || '' : h.dealer?.name || h.customerName || '',
      netSales: h.netSales.toNumber(),
      expectedHandover: h.expectedHandover.toNumber(),
      status: h.status,
    }));

    return {
      period: {
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      },
      cumulativeItemsSold,
      salesSummary,
      targetSummary,
      collectionSummary,
      outstandingSummary,
      expenseSummary,
      pnlSummary,
      recentActivity,
    };
  }
}
