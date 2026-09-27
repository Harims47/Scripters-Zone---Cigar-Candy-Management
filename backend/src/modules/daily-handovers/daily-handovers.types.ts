import { HandoverRecipientType, HandoverStatus, Uom } from '@prisma/client';

export { HandoverRecipientType, HandoverStatus };

export interface CreateDailyHandoverItemInput {
  productId: string;
  uom: string;
  openingQuantity: number;
  closingQuantity: number;
  freeQuantity?: number;
  discount?: number;
}

export interface CreateEmptyPacketInput {
  productId?: string;
  quantity: number;
  actualAmount: number;
}

export interface CreateCouponInput {
  productId?: string;
  denomination: number;
  quantity: number;
}

export interface CreateDailyHandoverInput {
  recipientType: HandoverRecipientType;
  salesmanId?: string;
  dealerId?: string;
  handoverDate: string; // YYYY-MM-DD
  customerName?: string;
  customerPhone?: string;
  status?: HandoverStatus;
  items: CreateDailyHandoverItemInput[];
  emptyPackets?: CreateEmptyPacketInput[];
  coupons?: CreateCouponInput[];
  cashCollected?: number;
  gpayCollected?: number;
  notes?: string;
}

export interface UpdateDailyHandoverInput {
  customerName?: string;
  customerPhone?: string;
  items?: CreateDailyHandoverItemInput[];
  emptyPackets?: CreateEmptyPacketInput[];
  coupons?: CreateCouponInput[];
  notes?: string;
}

export interface RecordCollectionInput {
  cashCollected: number;
  gpayCollected: number;
  notes?: string;
}

export interface DailyHandoverFilters {
  recipientType?: HandoverRecipientType;
  salesmanId?: string;
  dealerId?: string;
  handoverDate?: string;
  startDate?: string;
  endDate?: string;
  status?: HandoverStatus;
  productId?: string;
  page?: number;
  limit?: number;
}

export interface CalculatedHandoverItem {
  productId: string;
  uom: Uom;
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

export interface CalculatedEmptyPacket {
  productId?: string;
  quantity: number;
  actualAmount: number;
}

export interface CalculatedCoupon {
  productId?: string;
  denomination: number;
  quantity: number;
  amount: number;
}

export interface CalculatedHandoverTotals {
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
  status: HandoverStatus;
}
