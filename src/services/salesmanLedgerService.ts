import { ApiClient } from './apiClient';

export interface BackendLedgerTransaction {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  transactionDate: string;
  type: 'HANDOVER_SHORT' | 'ADVANCE' | 'RECOVERY' | 'SALARY_DEDUCTION' | 'MANUAL_ADJUSTMENT';
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  runningBalance?: number;
  referenceType?: string | null;
  referenceId?: string | null;
  dailyHandoverId?: string | null;
  notes?: string | null;
  createdBy?: string;
  createdAt: string;
}

export interface BackendLedgerSummary {
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface BackendLedgerResponse {
  summary: BackendLedgerSummary;
  transactions: BackendLedgerTransaction[];
}

export class SalesmanLedgerService {
  static async getSalesmanLedger(
    salesmanIdOrParams?: string | { salesmanId?: string; fromDate?: string; toDate?: string },
    params?: { fromDate?: string; toDate?: string }
  ) {
    if (typeof salesmanIdOrParams === 'object' && salesmanIdOrParams !== null) {
      return ApiClient.get<BackendLedgerResponse>('/salesman-ledger', salesmanIdOrParams);
    }
    return ApiClient.get<BackendLedgerResponse>('/salesman-ledger', {
      salesmanId: salesmanIdOrParams,
      ...params,
    });
  }

  static async getMyLedger(params?: { fromDate?: string; toDate?: string }) {
    return ApiClient.get<BackendLedgerResponse>('/salesman-ledger/my', params);
  }

  static async createTransaction(data: {
    salesmanId: string;
    transactionDate: string;
    type: 'ADVANCE' | 'RECOVERY' | 'MANUAL_ADJUSTMENT';
    direction: 'DEBIT' | 'CREDIT';
    amount: number;
    notes?: string;
  }) {
    return ApiClient.post<BackendLedgerTransaction>('/salesman-ledger/transactions', data);
  }
}
