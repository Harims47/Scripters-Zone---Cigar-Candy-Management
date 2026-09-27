import { ApiClient } from './apiClient';

export interface BackendExpense {
  id: string;
  expenseDate: string;
  category: 'OFFICE' | 'HOUSE' | 'GPI';
  amount: number;
  notes: string;
  createdBy: string;
  createdAt?: string;
}

export interface BackendExpenseSummary {
  office: number;
  house: number;
  gpi: number;
  emptyPacket: number;
  coupon: number;
  discount: number;
  operatingExpenses: number;
  totalExpenseImpact: number;
  totalCompanyCostImpact: number;
}

export class ExpensesService {
  static async getExpenses(params?: { category?: string; fromDate?: string; toDate?: string; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/expenses', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.expenses || []);
  }

  static async getExpenseSummary(params?: { fromDate?: string; toDate?: string }) {
    return ApiClient.get<BackendExpenseSummary>('/expenses/summary', params);
  }

  static async createExpense(data: {
    expenseDate: string;
    category: 'OFFICE' | 'HOUSE' | 'GPI';
    amount: number;
    notes: string;
  }) {
    return ApiClient.post<BackendExpense>('/expenses', data);
  }
}
