import { ApiClient } from './apiClient';

export interface BackendSalary {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  salaryMonth: string;
  baseSalary: number;
  salaryRecovery: number;
  netSalary: number;
  status: 'PAID';
  paidDate: string;
  createdBy: string;
  createdAt: string;
  salesman?: {
    id: string;
    name: string;
  };
}

export class SalaryService {
  static async getSalaries(params?: { salesmanId?: string; fromMonth?: string; toMonth?: string }) {
    const res = await ApiClient.get<any>('/salaries', {
      limit: 100,
      ...params,
    });
    return Array.isArray(res) ? res : (res?.salaries || []);
  }

  static async getMySalaries(params?: { fromMonth?: string; toMonth?: string }) {
    const res = await ApiClient.get<any>('/salaries/my', params);
    return Array.isArray(res) ? res : (res?.salaries || []);
  }

  static async createSalary(data: {
    salesmanId: string;
    salaryMonth: string; // YYYY-MM
    baseSalary: number;
  }) {
    return ApiClient.post<BackendSalary>('/salaries', data);
  }
}
