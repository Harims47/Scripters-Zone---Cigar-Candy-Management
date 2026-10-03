import { ApiClient } from './apiClient';

export interface BackendDailyHandoverItem {
  id?: string;
  productId: string;
  productName?: string;
  uom: string;
  openingQuantity: number;
  closingQuantity: number;
  salesQuantity: number;
  freeQuantity: number;
  chargeableQuantity: number;
  rate: number;
  grossAmount: number;
  freeItemValue: number;
  discount: number;
  netAmount: number;
  baseSalesQuantity?: number;
  product?: {
    id: string;
    name: string;
    category?: string;
    brand?: string;
    sku?: string;
  };
}

export interface BackendEmptyPacket {
  id?: string;
  productId?: string | null;
  quantity: number;
  actualAmount: number;
}

export interface BackendCoupon {
  id?: string;
  productId?: string | null;
  denomination: number;
  quantity: number;
  amount: number;
}

export interface BackendDailyHandover {
  id: string;
  recipientType: 'SALESMAN' | 'DEALER';
  salesmanId?: string | null;
  dealerId?: string | null;
  salesmanName?: string | null;
  dealerName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  handoverDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'SETTLED' | 'SHORT' | 'EXCESS';
  grossSales: number;
  totalItemDiscount: number;
  netSales: number;
  freeItemValue: number;
  emptyPacketBenefit: number;
  couponBenefit: number;
  expectedHandover: number;
  cashCollected: number;
  gpayCollected: number;
  collectionTotal: number;
  outstanding: number;
  excess: number;
  notes?: string | null;
  createdAt: string;
  items: BackendDailyHandoverItem[];
  emptyPackets: BackendEmptyPacket[];
  coupons: BackendCoupon[];
  salesman?: { id: string; name: string } | null;
  dealer?: { id: string; name: string } | null;
}

export class DailyHandoverService {
  static async getDailyHandovers(params?: {
    recipientType?: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    page?: number;
  }) {
    const res = await ApiClient.get<any>('/daily-handovers', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.handovers || []);
  }

  static async getDailyHandover(id: string) {
    return ApiClient.get<BackendDailyHandover>(`/daily-handovers/${id}`);
  }

  static async createDailyHandover(data: {
    recipientType: 'SALESMAN' | 'DEALER';
    salesmanId?: string;
    dealerId?: string;
    handoverDate: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    items: Array<{
      productId: string;
      uom: string;
      openingQuantity: number;
      closingQuantity: number;
      freeQuantity?: number;
      discount?: number;
    }>;
    emptyPackets?: Array<{
      productId?: string;
      quantity: number;
      actualAmount: number;
    }>;
    coupons?: Array<{
      productId?: string;
      denomination: number;
      quantity: number;
    }>;
    collection?: {
      cashCollected: number;
      gpayCollected: number;
    };
  }) {
    return ApiClient.post<BackendDailyHandover>('/daily-handovers', data);
  }

  static async updateDailyHandover(id: string, data: any) {
    return ApiClient.patch<BackendDailyHandover>(`/daily-handovers/${id}`, data);
  }

  static async submitDailyHandover(id: string) {
    return ApiClient.post<BackendDailyHandover>(`/daily-handovers/${id}/submit`);
  }

  static async recordCollection(id: string, data: { cashCollected: number; gpayCollected: number; notes?: string }) {
    return ApiClient.post<BackendDailyHandover>(`/daily-handovers/${id}/collection`, data);
  }

  static async deleteDailyHandover(id: string) {
    return ApiClient.delete(`/daily-handovers/${id}`);
  }
}

