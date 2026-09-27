import { ExpenseCategory } from '@prisma/client';

export { ExpenseCategory };

export interface CreateExpenseInput {
  expenseDate: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  notes: string;
}

export interface ExpenseFilters {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  category?: ExpenseCategory;
  page?: number;
  limit?: number;
}

export interface ExpenseSummaryFilters {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
}

export interface FormattedExpense {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

export interface ExpenseListResponse {
  expenses: FormattedExpense[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExpenseSummaryResponse {
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
