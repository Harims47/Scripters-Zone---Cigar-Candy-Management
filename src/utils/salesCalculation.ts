export interface SalesCalculationInput {
  quantity: number;
  sellingRate: number;
  emptyPacketQty?: number;
  emptyPacketRate?: number;
  emptyPocketQty?: number;
  emptyPocketRate?: number;
  couponQty?: number;
  couponRate?: number;
  itemDiscount?: number;
}

export interface SalesCalculationResult {
  grossAmount: number;
  emptyPacketDiscount: number;
  emptyPocketDiscount?: number;
  couponDiscount: number;
  itemDiscount: number;
  totalDiscount: number;
  netAmount: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Centralized sales calculation engine for Candy & Cigarette Sales Management.
 * Business Rules:
 * - Gross Amount = Quantity × Selling Rate
 * - Empty Packet Discount = Empty Packets × Packet Discount Rate (if applicable)
 * - Coupon Discount = Coupons × Product Coupon Discount Rate
 * - Total Discount = Item Discount + Empty Packet Discount + Coupon Discount
 * - Net Amount = Gross Amount - Total Discount
 * - Validates against negative numbers and discount > gross amount.
 */
export function calculateSalesBreakdown(input: SalesCalculationInput): SalesCalculationResult {
  const qty = Number(input.quantity) || 0;
  const rate = Number(input.sellingRate) || 0;
  const packetQty = Number(input.emptyPacketQty ?? input.emptyPocketQty) || 0;
  const packetRate = Number(input.emptyPacketRate ?? input.emptyPocketRate) || 0;
  const cpnQty = Number(input.couponQty) || 0;
  const cpnRate = Number(input.couponRate) || 0;
  const itmDisc = Number(input.itemDiscount) || 0;

  if (qty < 0 || rate < 0 || packetQty < 0 || packetRate < 0 || cpnQty < 0 || cpnRate < 0 || itmDisc < 0) {
    return {
      grossAmount: 0,
      emptyPacketDiscount: 0,
      emptyPocketDiscount: 0,
      couponDiscount: 0,
      itemDiscount: 0,
      totalDiscount: 0,
      netAmount: 0,
      isValid: false,
      errorMessage: 'Quantities and discounts cannot be negative numbers.'
    };
  }

  const grossAmount = Math.round(qty * rate * 100) / 100;
  const emptyPacketDiscount = Math.round(packetQty * packetRate * 100) / 100;
  const couponDiscount = Math.round(cpnQty * cpnRate * 100) / 100;
  const itemDiscount = Math.round(itmDisc * 100) / 100;

  const totalDiscount = Math.round((emptyPacketDiscount + couponDiscount + itemDiscount) * 100) / 100;
  const netAmount = Math.round((grossAmount - totalDiscount) * 100) / 100;

  if (totalDiscount > grossAmount && grossAmount > 0) {
    return {
      grossAmount,
      emptyPacketDiscount,
      emptyPocketDiscount: emptyPacketDiscount,
      couponDiscount,
      itemDiscount,
      totalDiscount,
      netAmount: 0,
      isValid: false,
      errorMessage: `Total discount (₹${totalDiscount.toLocaleString('en-IN')}) cannot exceed Gross Sales (₹${grossAmount.toLocaleString('en-IN')}).`
    };
  }

  return {
    grossAmount,
    emptyPacketDiscount,
    emptyPocketDiscount: emptyPacketDiscount,
    couponDiscount,
    itemDiscount,
    totalDiscount,
    netAmount: Math.max(0, netAmount),
    isValid: true
  };
}
