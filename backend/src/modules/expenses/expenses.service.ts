import { Prisma, UserRole, HandoverStatus, ExpenseCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateExpenseInput,
  ExpenseFilters,
  ExpenseSummaryFilters,
  FormattedExpense,
  ExpenseListResponse,
  ExpenseSummaryResponse,
} from './expenses.types.js';

export class ExpensesService {
  /**
   * Helper: Parse YYYY-MM-DD string to UTC Date.
   */
  private static parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  /**
   * Helper: Format Date to YYYY-MM-DD.
   */
  private static formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Format Prisma Expense to FormattedExpense DTO.
   */
  private static formatExpense(expense: any): FormattedExpense {
    return {
      id: expense.id,
      expenseDate: this.formatDate(expense.expenseDate),
      category: expense.category,
      amount: expense.amount.toNumber(),
      notes: expense.notes,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
    };
  }

  /**
   * Create a manual operating expense (Admin only).
   */
  static async createExpense(
    input: CreateExpenseInput,
    currentUser: { userId: string; role: string }
  ): Promise<FormattedExpense> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can create expenses');
    }

    if (input.amount <= 0) {
      throw AppError.badRequest('Expense amount must be greater than zero');
    }

    if (!input.notes || input.notes.trim().length === 0) {
      throw AppError.badRequest('Notes are mandatory for expenses');
    }

    if (!Object.values(ExpenseCategory).includes(input.category)) {
      throw AppError.badRequest(
        `Invalid category "${input.category}". Allowed manual categories: ${Object.values(ExpenseCategory).join(', ')}`
      );
    }

    const expenseDate = this.parseDate(input.expenseDate);

    const expense = await prisma.expense.create({
      data: {
        expenseDate,
        category: input.category,
        amount: input.amount,
        notes: input.notes.trim(),
        createdBy: currentUser.userId,
      },
    });

    return this.formatExpense(expense);
  }

  /**
   * List manual operating expenses with filters and pagination.
   */
  static async getExpenses(
    filters: ExpenseFilters,
    currentUser: { userId: string; role: string }
  ): Promise<ExpenseListResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view operational expenses');
    }

    const where: Prisma.ExpenseWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.fromDate || filters.toDate) {
      where.expenseDate = {};
      if (filters.fromDate) {
        where.expenseDate.gte = this.parseDate(filters.fromDate);
      }
      if (filters.toDate) {
        where.expenseDate.lte = this.parseDate(filters.toDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      expenses: expenses.map((e) => this.formatExpense(e)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single manual expense by ID.
   */
  static async getExpenseById(
    id: string,
    currentUser: { userId: string; role: string }
  ): Promise<FormattedExpense> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view operational expenses');
    }

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw AppError.notFound(`Expense with ID "${id}" not found`);
    }

    return this.formatExpense(expense);
  }

  /**
   * Get aggregated expense summary (Manual + Derived) for a date range.
   *
   * Formulas:
   * - Operating Expenses = OFFICE + HOUSE + GPI + EMPTY_PACKET + COUPON
   * - Total Expense Impact = Operating Expenses
   * - Total Company Cost Impact = Operating Expenses + DISCOUNT
   *
   * Note: DISCOUNT reduces gross revenue and is NOT an operating expense (avoids double counting).
   */
  static async getExpenseSummary(
    filters: ExpenseSummaryFilters,
    currentUser: { userId: string; role: string }
  ): Promise<ExpenseSummaryResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view expense summary');
    }

    // 1. Date filters
    const expenseWhere: Prisma.ExpenseWhereInput = {};
    const handoverDateWhere: Prisma.DateTimeFilter | undefined =
      filters.fromDate || filters.toDate
        ? {
            ...(filters.fromDate ? { gte: this.parseDate(filters.fromDate) } : {}),
            ...(filters.toDate ? { lte: this.parseDate(filters.toDate) } : {}),
          }
        : undefined;

    if (handoverDateWhere) {
      expenseWhere.expenseDate = handoverDateWhere;
    }

    // 2. Fetch manual expenses
    const manualExpenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: { category: true, amount: true },
    });

    let officeTotal = new Prisma.Decimal(0);
    let houseTotal = new Prisma.Decimal(0);
    let gpiTotal = new Prisma.Decimal(0);

    for (const exp of manualExpenses) {
      if (exp.category === ExpenseCategory.OFFICE) {
        officeTotal = officeTotal.plus(exp.amount);
      } else if (exp.category === ExpenseCategory.HOUSE) {
        houseTotal = houseTotal.plus(exp.amount);
      } else if (exp.category === ExpenseCategory.GPI) {
        gpiTotal = gpiTotal.plus(exp.amount);
      }
    }

    // 3. Derived expenses from authoritative Daily Handovers
    // Authoritative financial statuses: SUBMITTED, SETTLED, SHORT, EXCESS (DRAFT is excluded)
    const financialStatuses = [
      HandoverStatus.SUBMITTED,
      HandoverStatus.SETTLED,
      HandoverStatus.SHORT,
      HandoverStatus.EXCESS,
    ];

    const handoverFilter: Prisma.DailyHandoverWhereInput = {
      status: { in: financialStatuses },
      ...(handoverDateWhere ? { handoverDate: handoverDateWhere } : {}),
    };

    const [emptyPacketAgg, couponAgg, discountAgg] = await Promise.all([
      prisma.dailyHandoverEmptyPacket.aggregate({
        _sum: { actualAmount: true },
        where: { handover: handoverFilter },
      }),
      prisma.dailyHandoverCoupon.aggregate({
        _sum: { amount: true },
        where: { handover: handoverFilter },
      }),
      prisma.dailyHandoverItem.aggregate({
        _sum: { discount: true },
        where: { handover: handoverFilter },
      }),
    ]);

    const emptyPacketTotal = emptyPacketAgg._sum.actualAmount || new Prisma.Decimal(0);
    const couponTotal = couponAgg._sum.amount || new Prisma.Decimal(0);
    const discountTotal = discountAgg._sum.discount || new Prisma.Decimal(0);

    // 4. Calculate consolidated metrics with Prisma.Decimal arithmetic
    const operatingExpensesDecimal = officeTotal
      .plus(houseTotal)
      .plus(gpiTotal)
      .plus(emptyPacketTotal)
      .plus(couponTotal);

    const totalExpenseImpactDecimal = operatingExpensesDecimal;
    const totalCompanyCostImpactDecimal = operatingExpensesDecimal.plus(discountTotal);

    return {
      office: officeTotal.toNumber(),
      house: houseTotal.toNumber(),
      gpi: gpiTotal.toNumber(),
      emptyPacket: emptyPacketTotal.toNumber(),
      coupon: couponTotal.toNumber(),
      discount: discountTotal.toNumber(),
      operatingExpenses: operatingExpensesDecimal.toNumber(),
      totalExpenseImpact: totalExpenseImpactDecimal.toNumber(),
      totalCompanyCostImpact: totalCompanyCostImpactDecimal.toNumber(),
    };
  }

  /**
   * Delete a manual operating expense by ID.
   */
  public static async deleteExpense(id: string, _user?: any): Promise<void> {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Expense not found');
    }
    await prisma.expense.delete({ where: { id } });
  }
}

