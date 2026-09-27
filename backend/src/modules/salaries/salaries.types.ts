import { SalaryStatus } from '@prisma/client';

export { SalaryStatus };

export interface CreateSalaryInput {
  salesmanId: string;
  salaryMonth: string; // YYYY-MM or YYYY-MM-DD
  baseSalary: number;
}

export interface SalaryFilters {
  salesmanId?: string;
  fromMonth?: string; // YYYY-MM or YYYY-MM-DD
  toMonth?: string; // YYYY-MM or YYYY-MM-DD
  page?: number;
  limit?: number;
}

export interface MySalaryFilters {
  fromMonth?: string; // YYYY-MM or YYYY-MM-DD
  toMonth?: string; // YYYY-MM or YYYY-MM-DD
  page?: number;
  limit?: number;
}

export interface FormattedSalary {
  id: string;
  salesmanId: string;
  salesmanName?: string;
  salaryMonth: string; // YYYY-MM
  baseSalary: number;
  salaryRecovery: number;
  netSalary: number;
  status: SalaryStatus;
  paidDate: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalaryListResponse {
  salaries: FormattedSalary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
