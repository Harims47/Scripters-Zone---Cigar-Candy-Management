import { ApiClient } from './apiClient';

export interface BackendProduct {
  id: string;
  sku: string | null;
  name: string;
  category: 'CANDY' | 'CIGARETTE';
  brand: string;
  baseUom: string;
  salesUom: string;
  purchaseUom: string;
  standardPurchasePrice: number | string;
  salesRate: number | string;
  active: boolean;
  hasInitialStock?: boolean;
  initialStock?: {
    id: string;
    quantity: number;
    uom: string;
    createdAt: string;
  } | null;
  uomConversions?: Array<{
    id?: string;
    fromUom: string;
    toUom: string;
    conversionFactor: number;
  }>;
}

export interface BackendDealer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendPerson {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: 'SALESMAN' | 'DEALER' | 'STAFF';
  active: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
  } | null;
}

export interface BackendSupplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export class MasterDataService {
  // --- Products ---
  static async getProducts(params?: { category?: string; brand?: string; active?: boolean; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/products', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.products || []);
  }

  static async getProduct(id: string) {
    return ApiClient.get<BackendProduct>(`/products/${id}`);
  }

  static async createProduct(data: any) {
    return ApiClient.post<BackendProduct>('/products', data);
  }

  static async updateProduct(id: string, data: any) {
    return ApiClient.patch<BackendProduct>(`/products/${id}`, data);
  }

  static async toggleProductStatus(id: string, active: boolean) {
    return ApiClient.patch<BackendProduct>(`/products/${id}/status`, { active });
  }

  static async deleteProduct(id: string) {
    return ApiClient.delete(`/products/${id}`);
  }

  // --- Dealers ---
  static async getDealers(params?: { active?: boolean; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/dealers', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.dealers || []);
  }

  static async getDealer(id: string) {
    return ApiClient.get<BackendDealer>(`/dealers/${id}`);
  }

  static async createDealer(data: { name: string; phone?: string; address?: string }) {
    return ApiClient.post<BackendDealer>('/dealers', data);
  }

  static async updateDealer(id: string, data: Partial<{ name: string; phone: string; address: string }>) {
    return ApiClient.patch<BackendDealer>(`/dealers/${id}`, data);
  }

  static async toggleDealerStatus(id: string, active: boolean) {
    return ApiClient.patch<BackendDealer>(`/dealers/${id}/status`, { active });
  }

  static async deleteDealer(id: string) {
    return ApiClient.delete(`/dealers/${id}`);
  }

  // --- Persons / Salesmen ---
  static async getPersons(params?: { type?: string; active?: boolean; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/persons', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.persons || []);
  }

  static async createPerson(data: { name: string; phone?: string; address?: string; type: 'SALESMAN' | 'DEALER' | 'STAFF'; username?: string; password?: string }) {
    return ApiClient.post<BackendPerson>('/persons', data);
  }

  static async updatePerson(id: string, data: Partial<{ name: string; phone: string; address: string; active: boolean }>) {
    return ApiClient.patch<BackendPerson>(`/persons/${id}`, data);
  }

  static async deletePerson(id: string) {
    return ApiClient.delete(`/persons/${id}`);
  }

  // --- Suppliers ---
  static async getSuppliers(params?: { active?: boolean; limit?: number; page?: number }) {
    const res = await ApiClient.get<any>('/suppliers', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.suppliers || []);
  }

  static async createSupplier(data: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string }) {
    return ApiClient.post<BackendSupplier>('/suppliers', data);
  }

  static async updateSupplier(id: string, data: Partial<{ name: string; contactPerson: string; phone: string; email: string; address: string }>) {
    return ApiClient.patch<BackendSupplier>(`/suppliers/${id}`, data);
  }
}
