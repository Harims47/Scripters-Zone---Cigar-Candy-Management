import { ProductCategory, Uom } from '@prisma/client';

export interface ProductSummary {
  id: string;
  sku: string | null;
  name: string;
  category: ProductCategory;
  brand: string;
  baseUom: Uom;
  salesUom: Uom;
  purchaseUom: Uom;
  standardPurchasePrice: number;
  salesRate: number;
  active: boolean;
  conversions?: Array<{
    fromUom: Uom;
    toUom: Uom;
    conversionFactor: number;
  }>;
  hasInitialStock: boolean;
  initialStock?: {
    id: string;
    quantity: number;
    uom: Uom;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitConversionResult {
  productId: string;
  productName: string;
  fromUom: Uom;
  toUom: Uom;
  inputQuantity: number;
  conversionFactor: number;
  convertedQuantity: number;
}

export interface InitialStockSummary {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  uom: Uom;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
