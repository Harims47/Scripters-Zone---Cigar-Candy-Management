import { Uom } from '@prisma/client';

export interface SalesTargetProductSummary {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  category: string;
  brand: string;
  targetQuantity: number;
  uom: Uom;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesTargetSummary {
  id: string;
  salesmanId: string;
  salesmanName: string;
  targetDate: string; // YYYY-MM-DD
  dailyRevenueTarget: number;
  active: boolean;
  createdBy: string | null;
  productTargets: SalesTargetProductSummary[];
  createdAt: Date;
  updatedAt: Date;
}
