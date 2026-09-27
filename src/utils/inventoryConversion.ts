import { Product, ProductCategory, ProductUOM } from '../types';

/**
 * Authoritative Inventory UOM Conversion Engine
 *
 * Business Rules (Section 2, 3):
 * 1. Base Units:
 *    - Candy: JAR
 *    - Cigarette: PACKET
 * 2. Cigarette Conversions:
 *    - 1 M = 100 PACKETS (Constant standard)
 *    - 1 CASE = Configurable per product (via caseConversionFactor & caseConversionUnit)
 * 3. Candy Conversions:
 *    - JAR is the base unit.
 */

export const UOM_OPTIONS: Record<ProductCategory, ProductUOM[]> = {
  Cigarette: ['Packet', 'M', 'Case'],
  Candy: ['Jar', 'Hanger', 'Box']
};

export interface ConversionResult {
  baseQuantity: number;
  baseUOM: ProductUOM;
  error?: string;
}

/**
 * Normalize any input quantity in a given UOM to the product's base unit (Packet or Jar).
 */
export function toBaseQuantity(
  product: Product,
  quantity: number,
  inputUOM?: ProductUOM
): ConversionResult {
  const uom = (inputUOM || product.uom || (product.category === 'Candy' ? 'Jar' : 'Packet')) as ProductUOM;
  const numQty = Number(quantity) || 0;

  if (product.category === 'Candy') {
    return {
      baseQuantity: numQty,
      baseUOM: 'Jar'
    };
  }

  // Cigarette category: Base unit is Packet
  const baseUOM: ProductUOM = 'Packet';

  const normalizedUOM = uom.toLowerCase();

  if (
    normalizedUOM === 'packet' ||
    normalizedUOM === 'packets' ||
    normalizedUOM === 'pocket' ||
    normalizedUOM === 'pockets'
  ) {
    return {
      baseQuantity: numQty,
      baseUOM
    };
  }

  if (normalizedUOM === 'm') {
    // 1 M = 100 Packets
    return {
      baseQuantity: numQty * 100,
      baseUOM
    };
  }

  if (normalizedUOM === 'case' || normalizedUOM === 'cases') {
    const factor = product.caseConversionFactor;
    if (!factor || factor <= 0) {
      return {
        baseQuantity: 0,
        baseUOM,
        error: `Missing Case conversion factor for product "${product.name}". Please configure it in Product Master.`
      };
    }

    if (product.caseConversionUnit === 'M') {
      // 1 Case = factor M = factor * 100 Packets
      return {
        baseQuantity: numQty * factor * 100,
        baseUOM
      };
    } else {
      // 1 Case = factor Packets
      return {
        baseQuantity: numQty * factor,
        baseUOM
      };
    }
  }

  // Fallback if unknown UOM
  return {
    baseQuantity: numQty,
    baseUOM
  };
}

/**
 * Convert base quantity (Packets or Jars) into a target display UOM.
 */
export function fromBaseQuantity(
  product: Product,
  baseQuantity: number,
  targetUOM: ProductUOM
): number {
  const safeBase = Number(baseQuantity) || 0;
  if (!product || !targetUOM || product.category === 'Candy' || targetUOM.toLowerCase() === 'jar') {
    return safeBase;
  }

  const normalizedTarget = targetUOM.toLowerCase();

  if (
    normalizedTarget === 'packet' ||
    normalizedTarget === 'packets' ||
    normalizedTarget === 'pocket' ||
    normalizedTarget === 'pockets'
  ) {
    return safeBase;
  }

  if (normalizedTarget === 'm') {
    return safeBase / 100;
  }

  if (normalizedTarget === 'case' || normalizedTarget === 'cases') {
    const factor = Number(product.caseConversionFactor) || 0;
    if (factor <= 0) return 0;

    if (product.caseConversionUnit === 'M') {
      // 1 Case = factor * 100 Packets
      return safeBase / (factor * 100);
    } else {
      return safeBase / factor;
    }
  }

  return safeBase;
}

/**
 * Format quantity display with UOM and base equivalent if different.
 */
export function formatQuantityWithBase(
  product: Product,
  quantity: number,
  uom: ProductUOM
): string {
  const { baseQuantity } = toBaseQuantity(product, quantity, uom);
  if (
    uom.toLowerCase() === 'packet' ||
    uom.toLowerCase() === 'pocket' ||
    uom.toLowerCase() === 'jar'
  ) {
    return `${quantity} ${uom}`;
  }
  return `${quantity} ${uom} (${baseQuantity} ${product.category === 'Candy' ? 'Jar' : 'Packet'})`;
}

