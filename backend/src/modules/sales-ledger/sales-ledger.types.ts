import { HandoverRecipientType, HandoverStatus } from '@prisma/client';

export interface SalesLedgerFilters {
  fromDate?: string;
  toDate?: string;
  productId?: string;
  recipientType?: HandoverRecipientType;
  salesmanId?: string;
  dealerId?: string;
  page?: number;
  limit?: number;
}

export interface SalesLedgerSummaryFilters {
  fromDate?: string;
  toDate?: string;
  productId?: string;
  recipientType?: HandoverRecipientType;
  salesmanId?: string;
  dealerId?: string;
}

export interface SalesLedgerKpis {
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  totalEmptyPacket: number;
  totalCoupon: number;
  totalExpectedHandover: number;
  totalCollection: number;
  totalOutstanding: number;
  totalExcess: number;
}

export interface SalesLedgerItemRow {
  productId: string;
  productName: string;
  productSku: string | null;
  category: string;
  brand: string;
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
  baseSalesQuantity: number | null;
}

export interface SalesLedgerRow {
  handoverId: string;
  handoverDate: string;
  recipientType: HandoverRecipientType;
  salesmanId: string | null;
  salesmanName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: HandoverStatus;
  isProvisional: boolean;
  grossSales: number;
  itemDiscount: number;
  netSales: number;
  emptyPacket: number;
  coupon: number;
  expectedHandover: number;
  cashCollected: number;
  gpayCollected: number;
  collectionTotal: number;
  outstanding: number;
  excess: number;
  items: SalesLedgerItemRow[];
}

export interface SalesLedgerListResponse {
  kpis: SalesLedgerKpis;
  rows: SalesLedgerRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
