import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ProductCategory, Uom } from '@prisma/client';
import { UnitConversionResult } from './products.types.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface ConvertQuantityParams {
  productId: string;
  quantity: number;
  fromUom: Uom;
  toUom: Uom;
}

export class UnitConversionService {
  /**
   * Authoritative product-specific UOM conversion engine.
   * Business Rules:
   * 1. 1 M = 100 PACKET (Constant cigarette standard).
   * 2. 1 CASE = Product-specific conversion factor configured in Product Master.
   * 3. Candy products do NOT support cigarette conversions.
   */
  public static async convertQuantity(params: ConvertQuantityParams): Promise<UnitConversionResult> {
    const { productId, quantity, fromUom, toUom } = params;

    if (quantity < 0) {
      throw AppError.badRequest('Quantity to convert cannot be negative');
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { uomConversions: true },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${productId}" not found`);
    }

    // 1. Identity conversion
    if (fromUom === toUom) {
      return {
        productId: product.id,
        productName: product.name,
        fromUom,
        toUom,
        inputQuantity: quantity,
        conversionFactor: 1,
        convertedQuantity: quantity,
      };
    }

    // 2. Candy rules
    if (product.category === ProductCategory.CANDY) {
      // Candy does not support cigarette UOM conversions
      const cigaretteUoms: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET, Uom.POCKET];
      if (cigaretteUoms.includes(fromUom) || cigaretteUoms.includes(toUom)) {
        throw AppError.badRequest(
          `Product "${product.name}" is a CANDY product and cannot convert using cigarette units (${fromUom} -> ${toUom})`
        );
      }

      // Check for direct conversion in table if present
      const direct = product.uomConversions.find((c) => c.fromUom === fromUom && c.toUom === toUom);
      if (direct) {
        const factor = direct.conversionFactor.toNumber();
        return {
          productId: product.id,
          productName: product.name,
          fromUom,
          toUom,
          inputQuantity: quantity,
          conversionFactor: factor,
          convertedQuantity: Math.round(quantity * factor * 10000) / 10000,
        };
      }

      throw AppError.badRequest(`No conversion rule configured for CANDY product from ${fromUom} to ${toUom}`);
    }

    // 3. Cigarette rules: Base unit is PACKET (or legacy POCKET)
    const isPacket = (u: Uom) => u === Uom.PACKET || u === Uom.POCKET;

    // Helper: find factor from Uom to PACKET
    const getFactorToPacket = (u: Uom): number => {
      if (isPacket(u)) return 1;
      if (u === Uom.M) return 100; // Locked rule: 1 M = 100 Packet
      if (u === Uom.CASE) {
        // Find product-specific Case conversion
        const caseConv = product.uomConversions.find(
          (c) => c.fromUom === Uom.CASE && (isPacket(c.toUom) || c.toUom === Uom.M)
        );

        if (!caseConv) {
          throw AppError.badRequest(
            `Product "${product.name}" lacks a configured Case conversion factor. Please configure it in Product Master.`
          );
        }

        if (isPacket(caseConv.toUom)) {
          return caseConv.conversionFactor.toNumber();
        } else if (caseConv.toUom === Uom.M) {
          // 1 Case = factor M = factor * 100 Packets
          return caseConv.conversionFactor.toNumber() * 100;
        }
      }
      throw AppError.badRequest(`Unsupported UOM "${u}" for Cigarette product`);
    };

    const factorFrom = getFactorToPacket(fromUom);
    const factorTo = getFactorToPacket(toUom);

    // Quantity in Packets = quantity * factorFrom
    // Target Quantity = (quantity * factorFrom) / factorTo
    const effectiveFactor = factorFrom / factorTo;
    const convertedQuantity = Math.round(quantity * effectiveFactor * 10000) / 10000;

    return {
      productId: product.id,
      productName: product.name,
      fromUom,
      toUom,
      inputQuantity: quantity,
      conversionFactor: effectiveFactor,
      convertedQuantity,
    };
  }
}
