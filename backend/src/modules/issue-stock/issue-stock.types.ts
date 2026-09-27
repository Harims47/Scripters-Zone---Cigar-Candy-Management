import { IssueRecipientType, Uom } from '@prisma/client';

export interface IssueStockItemSummary {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  category: string;
  brand: string;
  quantity: number;
  uom: Uom;
  salesRate: number;
  issuedValue: number;
  baseQuantity: number;
  createdAt: Date;
}

export interface IssueStockSummary {
  id: string;
  recipientType: IssueRecipientType;
  salesmanId: string | null;
  salesmanName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  issueDate: string; // YYYY-MM-DD
  totalIssuedValue: number;
  createdBy: string | null;
  items: IssueStockItemSummary[];
  createdAt: Date;
  updatedAt: Date;
}
