import { ApiClient } from './apiClient';

export interface BackendPnLReport {
  period: {
    fromDate?: string;
    toDate?: string;
  };
  grossSales: number;
  discount: number;
  netRevenue: number;

  officeExpense: number;
  houseExpense: number;
  gpiExpense: number;
  emptyPacketExpense: number;
  couponExpense: number;

  operatingExpenses: number;
  grossProfit: number;

  collectionTotal: number;
  outstanding: number;
  excess: number;
}

export class PnLService {
  static async getPnLReport(params?: { fromDate?: string; toDate?: string }) {
    return ApiClient.get<BackendPnLReport>('/reports/pnl', params);
  }
}
