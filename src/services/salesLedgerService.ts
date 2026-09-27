import { ApiClient } from './apiClient';

export interface BackendSalesLedgerKpis {
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  totalEmptyPacket: number;
  totalCoupon: number;
  totalExpectedHandover: number;
  totalCollection: number;
  totalOutstanding: number;
  totalExcess: number;
}

export interface BackendSalesLedgerResponse {
  kpis: BackendSalesLedgerKpis;
  rows: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SalesLedgerService {
  static async getSalesLedger(params?: {
    fromDate?: string;
    toDate?: string;
    productId?: string;
    recipientType?: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
    page?: number;
    limit?: number;
  }) {
    return ApiClient.get<BackendSalesLedgerResponse>('/sales-ledger', params);
  }

  static async getSalesLedgerSummary(params?: {
    fromDate?: string;
    toDate?: string;
    productId?: string;
    recipientType?: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
  }) {
    return ApiClient.get<BackendSalesLedgerKpis>('/sales-ledger/summary', params);
  }
}
