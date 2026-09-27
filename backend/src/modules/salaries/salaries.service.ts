import { Prisma, UserRole, PersonType, SalaryStatus, LedgerTransactionType, LedgerDirection } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateSalaryInput,
  SalaryFilters,
  MySalaryFilters,
  FormattedSalary,
  SalaryListResponse,
} from './salaries.types.js';

export class SalariesService {
  /**
   * Normalize any YYYY-MM or YYYY-MM-DD input to exact start of month, end of month, and YYYY-MM label.
   */
  static normalizeSalaryMonth(monthInput: string): {
    startOfMonth: Date;
    endOfMonth: Date;
    formattedMonth: string;
  } {
    const parts = monthInput.split('-');
    if (parts.length < 2) {
      throw AppError.badRequest(`Invalid month format "${monthInput}". Expected YYYY-MM or YYYY-MM-DD`);
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw AppError.badRequest(`Invalid year/month values in "${monthInput}"`);
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    // Day 0 of next month is the last day of the current month
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;

    return { startOfMonth, endOfMonth, formattedMonth };
  }

  /**
   * Format Date to YYYY-MM-DD.
   */
  private static formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Format Date to YYYY-MM.
   */
  private static formatMonth(d: Date): string {
    return d.toISOString().substring(0, 7);
  }

  /**
   * Format Prisma SalesmanSalary to FormattedSalary DTO.
   */
  private static formatSalary(salary: any): FormattedSalary {
    return {
      id: salary.id,
      salesmanId: salary.salesmanId,
      salesmanName: salary.salesman?.name,
      salaryMonth: this.formatMonth(salary.salaryMonth),
      baseSalary: salary.baseSalary.toNumber(),
      salaryRecovery: salary.salaryRecovery.toNumber(),
      netSalary: salary.netSalary.toNumber(),
      status: salary.status,
      paidDate: this.formatDate(salary.paidDate),
      createdBy: salary.createdBy,
      createdAt: salary.createdAt,
      updatedAt: salary.updatedAt,
    };
  }

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
   * Record a salesman salary payment (Admin only).
   *
   * Rules:
   * - Server-authoritative calculation:
   *   salaryRecovery = SUM of SALARY_DEDUCTION CREDIT ledger transactions in salary month
   *   netSalary = baseSalary - salaryRecovery
   * - Decoupled from attendance: ABSENT days do NOT reduce salary.
   * - General ledger balance/shortages/advances do NOT reduce salary.
   * - Does NOT create or mutate ledger entries.
   * - Status is automatically PAID.
   */
  static async createSalary(
    input: CreateSalaryInput,
    currentUser: { userId: string; role: string }
  ): Promise<FormattedSalary> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can record salary payments');
    }

    if (input.baseSalary <= 0) {
      throw AppError.badRequest('Base salary must be greater than zero');
    }

    // 1. Salesman validation
    const person = await prisma.person.findUnique({
      where: { id: input.salesmanId },
    });

    if (!person) {
      throw AppError.notFound(`Salesman with ID "${input.salesmanId}" not found`);
    }

    if (person.type !== PersonType.SALESMAN) {
      throw AppError.badRequest(`Selected person "${person.name}" is not a SALESMAN. Recipient must be a Salesman.`);
    }

    if (!person.active) {
      throw AppError.badRequest(`Cannot record salary for inactive salesman "${person.name}"`);
    }

    // 2. Month normalization & duplicate check
    const { startOfMonth, endOfMonth } = this.normalizeSalaryMonth(input.salaryMonth);

    const existing = await prisma.salesmanSalary.findUnique({
      where: {
        salesmanId_salaryMonth: {
          salesmanId: input.salesmanId,
          salaryMonth: startOfMonth,
        },
      },
    });

    if (existing) {
      throw AppError.conflict(
        `Salary already recorded for salesman "${person.name}" for month ${this.formatMonth(startOfMonth)}`
      );
    }

    // 3. Server-authoritative salary recovery calculation from Salesman Ledger:
    // Only SALARY_DEDUCTION CREDIT transactions in the salary month count.
    const ledgerDeductions = await prisma.salesmanLedgerTransaction.findMany({
      where: {
        salesmanId: input.salesmanId,
        type: LedgerTransactionType.SALARY_DEDUCTION,
        direction: LedgerDirection.CREDIT,
        transactionDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { amount: true },
    });

    let salaryRecoveryDecimal = new Prisma.Decimal(0);
    for (const d of ledgerDeductions) {
      salaryRecoveryDecimal = salaryRecoveryDecimal.plus(d.amount);
    }

    const baseSalaryDecimal = new Prisma.Decimal(input.baseSalary);
    const netSalaryDecimal = baseSalaryDecimal.minus(salaryRecoveryDecimal);

    // 4. Create Salary record (status: PAID, paidDate: today)
    const paidDate = new Date();

    const salary = await prisma.salesmanSalary.create({
      data: {
        salesmanId: input.salesmanId,
        salaryMonth: startOfMonth,
        baseSalary: baseSalaryDecimal,
        salaryRecovery: salaryRecoveryDecimal,
        netSalary: netSalaryDecimal,
        status: SalaryStatus.PAID,
        paidDate,
        createdBy: currentUser.userId,
      },
      include: {
        salesman: { select: { id: true, name: true } },
      },
    });

    return this.formatSalary(salary);
  }

  /**
   * List salary records with filtering and pagination (Admin only).
   */
  static async getSalaries(
    filters: SalaryFilters,
    currentUser: { userId: string; role: string }
  ): Promise<SalaryListResponse> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can view salary records');
    }

    const where: Prisma.SalesmanSalaryWhereInput = {};

    if (filters.salesmanId) {
      where.salesmanId = filters.salesmanId;
    }

    if (filters.fromMonth || filters.toMonth) {
      where.salaryMonth = {};
      if (filters.fromMonth) {
        where.salaryMonth.gte = this.normalizeSalaryMonth(filters.fromMonth).startOfMonth;
      }
      if (filters.toMonth) {
        where.salaryMonth.lte = this.normalizeSalaryMonth(filters.toMonth).startOfMonth;
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, salaries] = await Promise.all([
      prisma.salesmanSalary.count({ where }),
      prisma.salesmanSalary.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ salaryMonth: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      salaries: salaries.map((s) => this.formatSalary(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Salesman view own salary records (Salesman only).
   */
  static async getMySalaries(
    filters: MySalaryFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<SalaryListResponse> {
    if (currentUser.role !== UserRole.SALESMAN) {
      throw AppError.forbidden('Only Salesmen can access personal salary history');
    }

    const userPersonId = await this.getSalesmanPersonId(currentUser);
    if (!userPersonId) {
      throw AppError.notFound('No associated Salesman profile found for user');
    }

    const where: Prisma.SalesmanSalaryWhereInput = {
      salesmanId: userPersonId,
    };

    if (filters.fromMonth || filters.toMonth) {
      where.salaryMonth = {};
      if (filters.fromMonth) {
        where.salaryMonth.gte = this.normalizeSalaryMonth(filters.fromMonth).startOfMonth;
      }
      if (filters.toMonth) {
        where.salaryMonth.lte = this.normalizeSalaryMonth(filters.toMonth).startOfMonth;
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, salaries] = await Promise.all([
      prisma.salesmanSalary.count({ where }),
      prisma.salesmanSalary.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ salaryMonth: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      salaries: salaries.map((s) => this.formatSalary(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single salary record by ID.
   * Authorization: Admin can access any; Salesman can access only own.
   */
  static async getSalaryById(
    id: string,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<FormattedSalary> {
    const salary = await prisma.salesmanSalary.findUnique({
      where: { id },
      include: {
        salesman: { select: { id: true, name: true } },
      },
    });

    if (!salary) {
      throw AppError.notFound(`Salary record with ID "${id}" not found`);
    }

    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (salary.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot access another person\'s salary details');
      }
    }

    return this.formatSalary(salary);
  }
}
