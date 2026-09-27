import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ProductStockSummary } from './inventory.types.js';
import { StockMovementType, Uom } from '@prisma/client';
import { UnitConversionService } from '../products/unit-conversion.service.js';

export class InventoryService {
  /**
   * Calculates stock balance for a single product.
   * Business Rules (Section 24, 25, 26):
   * Current Stock = Initial Stock (in base UOM) + Purchase Receipts (in base UOM) - Issued Stock (in base UOM)
   */
  public static async getStockByProductId(
    productId: string,
    client: typeof prisma | any = prisma
  ): Promise<ProductStockSummary> {
    const product = await client.product.findUnique({
      where: { id: productId },
      include: {
        initialStock: true,
        stockMovements: true,
      },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${productId}" not found`);
    }

    // 1. Initial Stock calculation normalized to base UOM
    let initialStockQty = 0;
    let initialStockUom: Uom | null = null;
    let initialStockInBaseUom = 0;

    if (product.initialStock) {
      initialStockQty = product.initialStock.quantity.toNumber();
      initialStockUom = product.initialStock.uom;

      if (initialStockUom === product.baseUom) {
        initialStockInBaseUom = initialStockQty;
      } else {
        const conv = await UnitConversionService.convertQuantity({
          productId: product.id,
          quantity: initialStockQty,
          fromUom: product.initialStock.uom,
          toUom: product.baseUom,
        });
        initialStockInBaseUom = conv.convertedQuantity;
      }
    }

    // 2. Sum of Purchase Receipts & Issues in base UOM
    let receiptsBaseQty = 0;
    let issuedBaseQty = 0;

    for (const mov of product.stockMovements) {
      if (mov.movementType === StockMovementType.RECEIPT) {
        receiptsBaseQty += mov.baseQuantity.toNumber();
      } else if (mov.movementType === StockMovementType.ISSUE) {
        issuedBaseQty += mov.baseQuantity.toNumber();
      }
    }

    receiptsBaseQty = Math.round(receiptsBaseQty * 10000) / 10000;
    issuedBaseQty = Math.round(issuedBaseQty * 10000) / 10000;

    // 3. Current Stock = Initial Stock + Purchase Receipts - Issued Stock
    const currentStock = Math.round((initialStockInBaseUom + receiptsBaseQty - issuedBaseQty) * 10000) / 10000;

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      baseUom: product.baseUom,
      initialStockQuantity: initialStockQty,
      initialStockUom,
      initialStockInBaseUom,
      purchaseReceiptsQuantity: receiptsBaseQty,
      issuedQuantity: issuedBaseQty,
      currentStock,
    };
  }

  /**
   * Helper to get available stock in base UOM for a product.
   * Can be executed within a Prisma transaction client.
   */
  public static async getAvailableStockInBaseUom(
    productId: string,
    client: typeof prisma | any = prisma
  ): Promise<number> {
    const summary = await this.getStockByProductId(productId, client);
    return summary.currentStock;
  }

  /**
   * Calculates stock balance for all products.
   */
  public static async getAllStock(category?: string): Promise<ProductStockSummary[]> {
    const products = await prisma.product.findMany({
      where: category ? { category: category as any } : undefined,
      select: { id: true },
      orderBy: { name: 'asc' },
    });

    const stockList: ProductStockSummary[] = [];
    for (const p of products) {
      const summary = await this.getStockByProductId(p.id);
      stockList.push(summary);
    }

    return stockList;
  }
}
