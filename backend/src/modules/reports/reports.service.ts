import { Prisma, HandoverStatus, ExpenseCategory, UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { PnLFilters, PnLReportResponse } from './reports.types.js';

export class ReportsService {
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

  /**
   * Calculate authoritative Management P&L report for a date range.
   *
   * FORMULA:
   * Gross Sales - Discounts = Net Revenue
   * Operating Expenses = Office + House + GPI + Empty Packet + Coupon
   * Gross Profit = Net Revenue - Operating Expenses
   *
   * Note: Discounts are subtracted from Gross Sales to reach Net Revenue,
   * and are NEVER deducted a second time in Operating Expenses.
   */
  static async getPnLReport(
    filters: PnLFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<PnLReportResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can access the financial P&L report');
    }

    const handoverWhere: Prisma.DailyHandoverWhereInput = {
      status: { in: this.ELIGIBLE_STATUSES },
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {};

    if (filters.fromDate || filters.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {
        ...(filters.fromDate ? { gte: this.parseDate(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: this.parseDate(filters.toDate) } : {}),
      };
      handoverWhere.handoverDate = dateFilter;
      expenseWhere.expenseDate = dateFilter;
    }

    // Concurrently aggregate handovers and manual expenses
    const [handoverAgg, manualExpenses] = await Promise.all([
      prisma.dailyHandover.aggregate({
        where: handoverWhere,
        _sum: {
          grossSales: true,
          totalItemDiscount: true,
          netSales: true,
          emptyPacketBenefit: true,
          couponBenefit: true,
          collectionTotal: true,
          outstanding: true,
          excess: true,
        },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        select: {
          category: true,
          amount: true,
        },
      }),
    ]);

    // 1. Sales & Revenue
    const grossSalesDec = handoverAgg._sum.grossSales || new Prisma.Decimal(0);
    const discountDec = handoverAgg._sum.totalItemDiscount || new Prisma.Decimal(0);
    const netRevenueDec = grossSalesDec.minus(discountDec);

    // 2. Manual Operating Expenses
    let officeDec = new Prisma.Decimal(0);
    let houseDec = new Prisma.Decimal(0);
    let gpiDec = new Prisma.Decimal(0);

    for (const exp of manualExpenses) {
      if (exp.category === ExpenseCategory.OFFICE) {
        officeDec = officeDec.plus(exp.amount);
      } else if (exp.category === ExpenseCategory.HOUSE) {
        houseDec = houseDec.plus(exp.amount);
      } else if (exp.category === ExpenseCategory.GPI) {
        gpiDec = gpiDec.plus(exp.amount);
      }
    }

    // 3. Derived Operating Expenses (Handover benefits counted once per handover)
    const emptyPacketDec = handoverAgg._sum.emptyPacketBenefit || new Prisma.Decimal(0);
    const couponDec = handoverAgg._sum.couponBenefit || new Prisma.Decimal(0);

    // 4. Operating Expenses = Office + House + GPI + Empty Packet + Coupon (Excludes Discount)
    const operatingExpensesDec = officeDec
      .plus(houseDec)
      .plus(gpiDec)
      .plus(emptyPacketDec)
      .plus(couponDec);

    // 5. Gross Profit = Net Revenue - Operating Expenses
    const grossProfitDec = netRevenueDec.minus(operatingExpensesDec);

    // 6. Cash reconciliation metrics
    const collectionTotalDec = handoverAgg._sum.collectionTotal || new Prisma.Decimal(0);
    const outstandingDec = handoverAgg._sum.outstanding || new Prisma.Decimal(0);
    const excessDec = handoverAgg._sum.excess || new Prisma.Decimal(0);

    return {
      period: {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      },
      grossSales: grossSalesDec.toNumber(),
      discount: discountDec.toNumber(),
      netRevenue: netRevenueDec.toNumber(),

      officeExpense: officeDec.toNumber(),
      houseExpense: houseDec.toNumber(),
      gpiExpense: gpiDec.toNumber(),
      emptyPacketExpense: emptyPacketDec.toNumber(),
      couponExpense: couponDec.toNumber(),

      operatingExpenses: operatingExpensesDec.toNumber(),
      grossProfit: grossProfitDec.toNumber(),

      collectionTotal: collectionTotalDec.toNumber(),
      outstanding: outstandingDec.toNumber(),
      excess: excessDec.toNumber(),
    };
  }
}
