import {
  LedgerTransactionType,
  LedgerDirection,
  LedgerReferenceType,
} from '@prisma/client';

export { LedgerTransactionType, LedgerDirection, LedgerReferenceType };

export interface CreateManualTransactionInput {
  salesmanId: string;
  transactionDate: string; // YYYY-MM-DD
  type: LedgerTransactionType;
  direction?: LedgerDirection;
  amount: number;
  notes?: string;
}

export interface SalesmanLedgerFilters {
  salesmanId?: string;
  fromDate?: string;
  toDate?: string;
  type?: LedgerTransactionType;
  direction?: LedgerDirection;
  page?: number;
  limit?: number;
}

export interface FormattedLedgerTransaction {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  transactionDate: string;
  type: LedgerTransactionType;
  direction: LedgerDirection;
  amount: number;
  referenceType: LedgerReferenceType | null;
  referenceId: string | null;
  dailyHandoverId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface SalesmanLedgerSummary {
  salesmanId?: string;
  salesmanName?: string;
  fromDate?: string;
  toDate?: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  transactions: FormattedLedgerTransaction[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
