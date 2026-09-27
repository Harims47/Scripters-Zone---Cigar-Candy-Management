import { PurchaseInvoiceStatus, Uom } from '@prisma/client';

export interface PurchaseInvoiceItemSummary {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  productCategory: string;
  quantity: number;
  uom: Uom;
  actualRate: number;
  discount: number;
  grossTotal: number;
  netTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseInvoiceSummary {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  grossTotal: number;
  totalItemDiscount: number;
  netTotal: number;
  status: PurchaseInvoiceStatus;
  createdBy: string | null;
  itemsCount: number;
  items?: PurchaseInvoiceItemSummary[];
  createdAt: Date;
  updatedAt: Date;
}
