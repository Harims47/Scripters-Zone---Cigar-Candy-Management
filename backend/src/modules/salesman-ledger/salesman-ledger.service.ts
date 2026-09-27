import {
  Prisma,
  PersonType,
  UserRole,
  LedgerTransactionType,
  LedgerDirection,
  LedgerReferenceType,
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreateManualTransactionInput,
  SalesmanLedgerFilters,
  FormattedLedgerTransaction,
  SalesmanLedgerSummary,
} from './salesman-ledger.types.js';

export class SalesmanLedgerService {
  /**
   * Parse a YYYY-MM-DD string into a UTC Date object.
   */
  static parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      throw AppError.badRequest(`Invalid date format "${dateStr}". Expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Format a Date into YYYY-MM-DD.
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
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
   * Create a manual ledger transaction (Admin only).
   */
  static async createManualTransaction(
    input: CreateManualTransactionInput,
    currentUser: { userId: string; role: string }
  ) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only Admin can create manual ledger transactions');
    }

    if (input.type === LedgerTransactionType.HANDOVER_SHORT) {
      throw AppError.badRequest('HANDOVER_SHORT cannot be manually created. It is system-generated from Daily Handover.');
    }

    if (input.amount <= 0) {
      throw AppError.badRequest('Amount must be greater than zero');
    }

    // Validate Salesman
    const salesman = await prisma.person.findUnique({
      where: { id: input.salesmanId },
      include: { user: true },
    });

    if (!salesman) {
      throw AppError.notFound(`Salesman with ID "${input.salesmanId}" not found`);
    }
    if (salesman.type === PersonType.DEALER) {
      throw AppError.badRequest('Dealer cannot have a salesman ledger. Dealer ledger is not supported.');
    }
    if (salesman.type === PersonType.STAFF) {
      throw AppError.badRequest('Staff cannot be a salesman recipient for ledger transactions');
    }
    if (salesman.type !== PersonType.SALESMAN) {
      throw AppError.badRequest(`Recipient must be a Salesman. Found ${salesman.type}`);
    }
    if (!salesman.active) {
      throw AppError.badRequest(`Cannot create ledger transaction for inactive salesman "${salesman.name}"`);
    }
    if (salesman.user && !salesman.user.isActive) {
      throw AppError.badRequest(`Cannot create ledger transaction for deactivated salesman "${salesman.name}"`);
    }

    // Determine direction
    let direction: LedgerDirection;
    if (input.type === LedgerTransactionType.ADVANCE) {
      direction = LedgerDirection.DEBIT;
    } else if (
      input.type === LedgerTransactionType.RECOVERY ||
      input.type === LedgerTransactionType.SALARY_DEDUCTION
    ) {
      direction = LedgerDirection.CREDIT;
    } else if (input.type === LedgerTransactionType.MANUAL_ADJUSTMENT) {
      if (!input.direction) {
        throw AppError.badRequest('direction (DEBIT or CREDIT) is required for MANUAL_ADJUSTMENT');
      }
      if (!input.notes || input.notes.trim().length === 0) {
        throw AppError.badRequest('notes/reason is required for MANUAL_ADJUSTMENT');
      }
      direction = input.direction;
    } else {
      throw AppError.badRequest(`Unsupported transaction type "${input.type}"`);
    }

    const transactionDate = this.parseDate(input.transactionDate);

    const tx = await prisma.salesmanLedgerTransaction.create({
      data: {
        salesmanId: input.salesmanId,
        transactionDate,
        type: input.type,
        direction,
        amount: input.amount,
        referenceType: LedgerReferenceType.MANUAL,
        notes: input.notes || null,
        createdBy: currentUser.userId,
      },
      include: {
        salesman: { select: { id: true, name: true, phone: true } },
      },
    });

    return {
      id: tx.id,
      salesmanId: tx.salesmanId,
      salesmanName: tx.salesman?.name,
      transactionDate: this.formatDate(tx.transactionDate),
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount.toNumber(),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      dailyHandoverId: tx.dailyHandoverId,
      notes: tx.notes,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
    };
  }

  /**
   * Get ledger report with authoritative balance calculation.
   */
  static async getSalesmanLedger(
    filters: SalesmanLedgerFilters,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<SalesmanLedgerSummary> {
    let targetSalesmanId = filters.salesmanId;

    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (!userPersonId) {
        throw AppError.forbidden('Salesman user profile is not linked to a Person record');
      }
      if (filters.salesmanId && filters.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot query another person\'s ledger');
      }
      targetSalesmanId = userPersonId;
    }

    let salesmanName: string | undefined;
    if (targetSalesmanId) {
      const salesman = await prisma.person.findUnique({
        where: { id: targetSalesmanId },
        select: { name: true },
      });
      salesmanName = salesman?.name;
    }

    // 1. Calculate Opening Balance:
    // Opening balance = all DEBITs - all CREDITs before fromDate (for targetSalesmanId)
    let openingBalance = 0;
    if (filters.fromDate && targetSalesmanId) {
      const fromDateObj = this.parseDate(filters.fromDate);
      const priorTransactions = await prisma.salesmanLedgerTransaction.findMany({
        where: {
          salesmanId: targetSalesmanId,
          transactionDate: { lt: fromDateObj },
        },
        select: { amount: true, direction: true },
      });

      let priorDebits = new Prisma.Decimal(0);
      let priorCredits = new Prisma.Decimal(0);

      for (const t of priorTransactions) {
        if (t.direction === LedgerDirection.DEBIT) {
          priorDebits = priorDebits.plus(t.amount);
        } else {
          priorCredits = priorCredits.plus(t.amount);
        }
      }
      openingBalance = priorDebits.minus(priorCredits).toNumber();
    }

    // 2. Query period transactions
    const where: Prisma.SalesmanLedgerTransactionWhereInput = {};
    if (targetSalesmanId) {
      where.salesmanId = targetSalesmanId;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.direction) {
      where.direction = filters.direction;
    }

    if (filters.fromDate || filters.toDate) {
      where.transactionDate = {};
      if (filters.fromDate) {
        where.transactionDate.gte = this.parseDate(filters.fromDate);
      }
      if (filters.toDate) {
        where.transactionDate.lte = this.parseDate(filters.toDate);
      }
    }

    // Total period debits and credits
    const periodTransactions = await prisma.salesmanLedgerTransaction.findMany({
      where,
      select: { amount: true, direction: true },
    });

    let periodDebits = new Prisma.Decimal(0);
    let periodCredits = new Prisma.Decimal(0);

    for (const t of periodTransactions) {
      if (t.direction === LedgerDirection.DEBIT) {
        periodDebits = periodDebits.plus(t.amount);
      } else {
        periodCredits = periodCredits.plus(t.amount);
      }
    }

    const totalDebits = periodDebits.toNumber();
    const totalCredits = periodCredits.toNumber();
    const closingBalance = new Prisma.Decimal(openingBalance)
      .plus(periodDebits)
      .minus(periodCredits)
      .toNumber();

    // 3. Paginated transactions list
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, transactions] = await Promise.all([
      prisma.salesmanLedgerTransaction.count({ where }),
      prisma.salesmanLedgerTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          salesman: { select: { id: true, name: true } },
        },
      }),
    ]);

    const formattedTransactions: FormattedLedgerTransaction[] = transactions.map((t) => ({
      id: t.id,
      salesmanId: t.salesmanId,
      salesmanName: t.salesman?.name,
      transactionDate: this.formatDate(t.transactionDate),
      type: t.type,
      direction: t.direction,
      amount: t.amount.toNumber(),
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      dailyHandoverId: t.dailyHandoverId,
      notes: t.notes,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
    }));

    return {
      salesmanId: targetSalesmanId,
      salesmanName,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance,
      transactions: formattedTransactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single transaction by ID.
   */
  static async getTransactionById(
    id: string,
    currentUser: { userId: string; role: string; personId?: string }
  ): Promise<FormattedLedgerTransaction> {
    const tx = await prisma.salesmanLedgerTransaction.findUnique({
      where: { id },
      include: { salesman: { select: { id: true, name: true } } },
    });

    if (!tx) {
      throw AppError.notFound(`Salesman ledger transaction with ID "${id}" not found`);
    }

    if (currentUser.role === UserRole.SALESMAN) {
      const userPersonId = await this.getSalesmanPersonId(currentUser);
      if (tx.salesmanId !== userPersonId) {
        throw AppError.forbidden('Salesman cannot access another person\'s ledger transaction');
      }
    }

    return {
      id: tx.id,
      salesmanId: tx.salesmanId,
      salesmanName: tx.salesman?.name,
      transactionDate: this.formatDate(tx.transactionDate),
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount.toNumber(),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      dailyHandoverId: tx.dailyHandoverId,
      notes: tx.notes,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
    };
  }
}
