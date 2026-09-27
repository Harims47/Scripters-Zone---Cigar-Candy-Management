import { ApiClient } from './apiClient';

export interface BackendProductTarget {
  id?: string;
  productId: string;
  productName?: string;
  targetQuantity: number;
  uom: string;
}

export interface BackendSalesTarget {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  targetDate: string;
  dailyRevenueTarget: number;
  active: boolean;
  createdBy?: string;
  createdAt: string;
  productTargets: BackendProductTarget[];
}

export class SalesTargetService {
  static async getSalesTargets(params?: { salesmanId?: string; fromDate?: string; toDate?: string; active?: boolean }) {
    const res = await ApiClient.get<any>('/sales-targets', params);
    return Array.isArray(res) ? res : (res?.targets || []);
  }

  static async getMySalesTargets(params?: { fromDate?: string; toDate?: string }) {
    const res = await ApiClient.get<any>('/sales-targets/my', params);
    return Array.isArray(res) ? res : (res?.targets || []);
  }

  static async getSalesTarget(id: string) {
    return ApiClient.get<BackendSalesTarget>(`/sales-targets/${id}`);
  }

  static async createSalesTarget(data: {
    salesmanId: string;
    targetDate: string;
    dailyRevenueTarget: number;
    productTargets?: Array<{
      productId: string;
      targetQuantity: number;
      uom: string;
    }>;
  }) {
    return ApiClient.post<BackendSalesTarget>('/sales-targets', data);
  }

  static async updateSalesTarget(id: string, data: Partial<{
    targetDate: string;
    dailyRevenueTarget: number;
    active: boolean;
    productTargets: Array<{
      productId: string;
      targetQuantity: number;
      uom: string;
    }>;
  }>) {
    return ApiClient.patch<BackendSalesTarget>(`/sales-targets/${id}`, data);
  }

  static async toggleSalesTargetStatus(id: string, active: boolean) {
    return ApiClient.patch<BackendSalesTarget>(`/sales-targets/${id}/status`, { active });
  }
}
