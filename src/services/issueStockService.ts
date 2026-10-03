import { ApiClient } from './apiClient';

export interface BackendIssueStockItem {
  id?: string;
  productId: string;
  productName?: string;
  quantity: number;
  uom: string;
  salesRate?: number;
  issuedValue?: number;
  baseQuantity?: number;
  product?: {
    id: string;
    name: string;
  };
}

export interface BackendIssueStock {
  id: string;
  recipientType: 'SALESMAN' | 'DEALER';
  salesmanId?: string | null;
  dealerId?: string | null;
  salesmanName?: string | null;
  dealerName?: string | null;
  issueDate: string;
  totalIssuedValue: number;
  createdBy?: string | null;
  createdAt: string;
  items: BackendIssueStockItem[];
  salesman?: { id: string; name: string } | null;
  dealer?: { id: string; name: string } | null;
}

export class IssueStockService {
  static async getIssueStock(params?: {
    recipientType?: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
  }) {
    const res = await ApiClient.get<any>('/issue-stock', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.issues || []);
  }

  static async getIssueStockById(id: string) {
    return ApiClient.get<BackendIssueStock>(`/issue-stock/${id}`);
  }

  static async createIssueStock(data: {
    recipientType: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
    issueDate: string;
    items: Array<{
      productId: string;
      quantity: number;
      uom: string;
    }>;
  }) {
    return ApiClient.post<BackendIssueStock>('/issue-stock', data);
  }

  static async deleteIssueStock(id: string) {
    return ApiClient.delete(`/issue-stock/${id}`);
  }
}

