import { HandoverItem, HandoverStatus } from '../types';

export interface RowCalculationResult {
  sales: number;
  free: number;
  chargeable: number;
  grossAmount: number;
  freeItemValue: number;
  discount: number;
  netAmount: number;
}

/**
 * Calculates single row values based on Authoritative Business Rules (Section 2, 3, 4, 5, 6):
 * 1. Sales = Opening - Closing
 * 2. Chargeable Quantity = Sales - Free
 * 3. Gross Sales = Chargeable Quantity × Rate
 * 4. Free Item Value = Free Quantity × Rate (informational reporting only, DO NOT subtract again)
 * 5. Net Sales = Gross Sales - Manual Discount
 */
export function calculateRow(
  opening: number,
  closing: number,
  free: number,
  rate: number,
  discount: number
): RowCalculationResult {
  const safeOpening = Math.max(0, Number(opening) || 0);
  const safeClosing = Math.max(0, Number(closing) || 0);
  const safeFree = Math.max(0, Number(free) || 0);
  const safeRate = Math.max(0, Number(rate) || 0);
  const safeDiscount = Math.max(0, Number(discount) || 0);

  const sales = Math.max(0, safeOpening - safeClosing);
  const chargeable = Math.max(0, sales - safeFree);
  const grossAmount = chargeable * safeRate;
  const freeItemValue = safeFree * safeRate;
  const netAmount = Math.max(0, grossAmount - safeDiscount);

  return {
    sales,
    free: safeFree,
    chargeable,
    grossAmount,
    freeItemValue,
    discount: safeDiscount,
    netAmount
  };
}

export interface HandoverCalculationTotals {
  salesQuantity: number;
  freeQuantity: number;
  chargeableQuantity: number;
  grossAmount: number;
  freeItemValue: number;
  manualDiscount: number;
  totalDiscount: number;
  totalItemDiscounts: number;
  netSales: number;
  emptyPocketBenefit: number;
  emptyPacketBenefit: number;
  couponBenefit: number;
  expectedHandover: number;
  amountHandedOver: number;
  outstanding: number;
  excess: number;
  status: HandoverStatus;

  // Compatibility aliases
  grossSales: number;
  emptyPocketAmount: number;
  emptyPacketAmount: number;
  couponAmount: number;
  totalExpected: number;
}

export interface HandoverCalculationInput {
  items: HandoverItem[];
  amountReceived: number | string;
  // Item 7: Denomination-based coupon entry support
  couponDenominations?: Array<{ denomination: number; quantity: number; total?: number }>;
  couponBenefit?: number;
  // Product-level or manual empty packet benefit
  emptyPocketBenefit?: number;
  emptyPacketBenefit?: number;
  // Optional legacy top-level overrides
  emptyPocketsCollected?: number;
  emptyPocketRate?: number;
  couponsCollected?: number;
  couponRate?: number;
}

/**
 * Authoritative Handover Calculation Engine (Section 1, 9, 10, 11, 12, 13, 20, 21, 28)
 *
 * Formula:
 * Gross Sales = SUM(chargeable * rate)
 * Total Item Discount = SUM(product.discount)
 * Net Sales = max(0, Gross Sales - Total Item Discount)
 * Expected Handover = max(0, Net Sales - Empty Packet Benefit - Coupon Benefit)
 *
 * Outstanding = Expected Handover - Amount Handed Over (if Handed Over < Expected)
 * Excess = Amount Handed Over - Expected Handover (if Handed Over > Expected)
 * Settled = Outstanding === 0 && Excess === 0
 */
export function calculateHandover(input: HandoverCalculationInput): HandoverCalculationTotals {
  const { items, amountReceived } = input;

  let salesQuantity = 0;
  let freeQuantity = 0;
  let chargeableQuantity = 0;
  let grossAmount = 0;
  let freeItemValue = 0;
  let totalItemDiscounts = 0;

  let itemPocketBenefitSum = 0;
  let itemCouponBenefitSum = 0;
  let hasItemLevelBenefits = false;

  for (const item of items) {
    salesQuantity += item.sales || 0;
    freeQuantity += item.free || 0;
    chargeableQuantity += item.chargeable ?? Math.max(0, (item.sales || 0) - (item.free || 0));
    grossAmount += item.grossAmount || 0;
    freeItemValue += item.freeItemValue ?? ((item.free || 0) * (item.rate || 0));
    totalItemDiscounts += Math.max(0, Number(item.discount) || 0);

    if (item.emptyPocketBenefit !== undefined || item.couponBenefit !== undefined) {
      hasItemLevelBenefits = true;
      itemPocketBenefitSum += Math.max(0, Number(item.emptyPocketBenefit) || 0);
      itemCouponBenefitSum += Math.max(0, Number(item.couponBenefit) || 0);
    }
  }

  // Net sales is Gross Sales minus sum of all item-level discounts
  const netSales = Math.max(0, grossAmount - totalItemDiscounts);

  // Calculate Empty Packet Benefit
  let emptyPacketBenefit = 0;
  if (input.emptyPacketBenefit !== undefined || input.emptyPocketBenefit !== undefined) {
    emptyPacketBenefit = Math.max(0, Number(input.emptyPacketBenefit ?? input.emptyPocketBenefit) || 0);
  } else if (hasItemLevelBenefits && itemPocketBenefitSum > 0) {
    emptyPacketBenefit = itemPocketBenefitSum;
  } else if (input.emptyPocketsCollected !== undefined) {
    const qty = Math.max(0, Number(input.emptyPocketsCollected) || 0);
    const rate = Math.max(0, Number(input.emptyPocketRate) || 0);
    emptyPacketBenefit = qty * rate;
  }

  // Calculate Coupon Benefit (Item 7: Denomination x Quantity support)
  let couponBenefit = 0;
  if (input.couponDenominations && input.couponDenominations.length > 0) {
    couponBenefit = input.couponDenominations.reduce((sum, row) => {
      const denom = Math.max(0, Number(row.denomination) || 0);
      const qty = Math.max(0, Number(row.quantity) || 0);
      const rowTotal = row.total !== undefined ? Math.max(0, Number(row.total) || 0) : denom * qty;
      return sum + rowTotal;
    }, 0);
  } else if (input.couponBenefit !== undefined) {
    couponBenefit = Math.max(0, Number(input.couponBenefit) || 0);
  } else if (hasItemLevelBenefits && itemCouponBenefitSum > 0) {
    couponBenefit = itemCouponBenefitSum;
  } else if (input.couponsCollected !== undefined) {
    const qty = Math.max(0, Number(input.couponsCollected) || 0);
    const rate = Math.max(0, Number(input.couponRate) || 0);
    couponBenefit = qty * rate;
  }

  // Authoritative Expected Handover:
  // Net Sales - Empty Packet Benefit - Coupon Benefit
  const expectedHandover = Math.max(0, netSales - emptyPacketBenefit - couponBenefit);
  const safeReceived = Math.max(0, Number(amountReceived) || 0);

  let outstanding = 0;
  let excess = 0;
  let status: HandoverStatus = 'SETTLED';

  if (safeReceived < expectedHandover) {
    outstanding = expectedHandover - safeReceived;
    status = 'OUTSTANDING';
  } else if (safeReceived > expectedHandover) {
    excess = safeReceived - expectedHandover;
    status = 'EXCESS';
  } else {
    status = 'SETTLED';
  }

  return {
    salesQuantity,
    freeQuantity,
    chargeableQuantity,
    grossAmount,
    freeItemValue,
    manualDiscount: totalItemDiscounts,
    totalDiscount: totalItemDiscounts,
    totalItemDiscounts,
    netSales,
    emptyPocketBenefit: emptyPacketBenefit,
    emptyPacketBenefit,
    couponBenefit,
    expectedHandover,
    amountHandedOver: safeReceived,
    outstanding,
    excess,
    status,

    // Aliases
    grossSales: grossAmount,
    emptyPocketAmount: emptyPacketBenefit,
    emptyPacketAmount: emptyPacketBenefit,
    couponAmount: couponBenefit,
    totalExpected: expectedHandover
  };
}

/**
 * Backward compatibility wrapper matching previous function signature
 */
export function calculateHandoverTotals(
  items: HandoverItem[],
  emptyPocketsCollected: number,
  emptyPocketRate: number,
  couponsCollected: number,
  couponRate: number,
  amountReceived: number
): HandoverCalculationTotals {
  return calculateHandover({
    items,
    emptyPocketsCollected,
    emptyPocketRate,
    couponsCollected,
    couponRate,
    amountReceived
  });
}
