import { ApiClient } from './apiClient';

export interface BackendStockItem {
  productId: string;
  productName: string;
  sku: string | null;
  category: string;
  brand?: string;
  baseUom: string;
  currentStock?: number;
  currentStockBase?: number;
  initialStockQuantity?: number;
  initialStockInBaseUom?: number;
  initialStockBase?: number;
  purchaseReceiptsQuantity?: number;
  purchaseReceiptsBase?: number;
  issuedQuantity?: number;
  issuedStockBase?: number;
  lastUpdated?: string;
}

export interface BackendPurchaseInvoiceItem {
  id?: string;
  productId: string;
  productName?: string;
  productSku?: string;
  productCategory?: string;
  quantity: number;
  uom: string;
  actualRate?: number;
  purchaseCost?: number;
  grossTotal?: number;
  grossAmount?: number;
  discount: number;
  netTotal?: number;
  netAmount?: number;
  baseQuantity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendPurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  invoiceDate: string;
  grossTotal?: number;
  totalGross?: number;
  totalItemDiscount?: number;
  totalDiscount?: number;
  netTotal?: number;
  totalNet?: number;
  status?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  itemsCount?: number;
  items: BackendPurchaseInvoiceItem[];
  supplier?: {
    id: string;
    name: string;
  };
}

export class InventoryService {
  static async getStock(params?: { category?: string; lowStockOnly?: boolean }) {
    const res = await ApiClient.get<any>('/inventory/stock', params);
    return Array.isArray(res) ? res : (res?.stock || []);
  }

  static async getProductStock(productId: string) {
    const res = await ApiClient.get<any>(`/inventory/stock/${productId}`);
    return res?.stock || res;
  }

  static async setInitialStock(productId: string, data: { quantity: number; uom: string }) {
    return ApiClient.post(`/products/${productId}/initial-stock`, data);
  }

  static async getInitialStock(productId: string) {
    return ApiClient.get(`/products/${productId}/initial-stock`);
  }

  static async getPurchaseInvoices(params?: { supplierId?: string; fromDate?: string; toDate?: string; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/purchase-invoices', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.invoices || []);
  }

  static async getPurchaseInvoice(id: string) {
    return ApiClient.get<BackendPurchaseInvoice>(`/purchase-invoices/${id}`);
  }

  static async createPurchaseInvoice(data: {
    invoiceNumber: string;
    supplierId: string;
    invoiceDate: string;
    items: Array<{
      productId: string;
      quantity: number;
      uom: string;
      actualRate?: number;
      purchaseCost?: number;
      discount?: number;
    }>;
  }) {
    const payload = {
      ...data,
      items: data.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        uom: it.uom,
        actualRate: it.actualRate !== undefined ? it.actualRate : (it.purchaseCost || 0),
        discount: it.discount || 0,
      })),
    };
    return ApiClient.post<BackendPurchaseInvoice>('/purchase-invoices', payload);
  }
}
