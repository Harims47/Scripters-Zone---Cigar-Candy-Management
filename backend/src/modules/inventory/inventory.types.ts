import { Uom } from '@prisma/client';

export interface ProductStockSummary {
  productId: string;
  productName: string;
  sku: string | null;
  category: string;
  baseUom: Uom;
  initialStockQuantity: number;
  initialStockUom: Uom | null;
  initialStockInBaseUom: number;
  purchaseReceiptsQuantity: number;
  issuedQuantity: number;
  currentStock: number;
}
