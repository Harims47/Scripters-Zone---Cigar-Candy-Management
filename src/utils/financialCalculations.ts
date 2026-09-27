import { DailyHandover, ExpenseRecord, HandoverItem } from '../types';

/**
 * Checks if a handover is finalized/eligible for financial reporting.
 * Excludes DRAFT and CANCELLED handovers.
 */
export function isEligibleHandover(h: DailyHandover): boolean {
  return h.status !== 'CANCELLED' && h.status !== 'DRAFT';
}

/**
 * Calculates Gross Sales for a handover:
 * SUM(chargeable quantity * recorded rate)
 */
export function getHandoverGrossSales(h: DailyHandover): number {
  if (h.items && h.items.length > 0) {
    return h.items.reduce((sum, item) => {
      const chargeable = item.chargeable ?? Math.max(0, (item.sales || 0) - (item.free || 0));
      return sum + chargeable * (item.rate || 0);
    }, 0);
  }
  return h.grossSales || 0;
}

/**
 * Calculates Total Item-Level Discounts for a handover:
 * SUM(item.discount)
 */
export function getHandoverTotalDiscount(h: DailyHandover): number {
  if (h.items && h.items.length > 0) {
    return h.items.reduce((sum, item) => sum + (item.discount || 0), 0);
  }
  return h.totalDiscount || 0;
}

/**
 * Calculates Empty Packet benefit for a handover:
 * Actual recorded amount
 */
export function getHandoverEmptyPacketBenefit(h: DailyHandover): number {
  return h.emptyPacketBenefit ?? h.emptyPocketBenefit ?? h.emptyPocketAmount ?? 0;
}

/**
 * Calculates Coupon benefit for a handover:
 * SUM(denomination * quantity) or recorded couponBenefit
 */
export function getHandoverCouponBenefit(h: DailyHandover): number {
  if (h.couponDenominations && h.couponDenominations.length > 0) {
    return h.couponDenominations.reduce((sum, c) => sum + (c.denomination * c.quantity), 0);
  }
  return h.couponBenefit ?? h.couponAmount ?? 0;
}

/**
 * Sales Ledger Net Sales definition:
 * Net Sales = Gross Sales - Total Discount - Empty Packet - Coupon
 * (Expected Handover)
 */
export function getSalesLedgerNetSales(h: DailyHandover): number {
  const gross = getHandoverGrossSales(h);
  const disc = getHandoverTotalDiscount(h);
  const ep = getHandoverEmptyPacketBenefit(h);
  const cpn = getHandoverCouponBenefit(h);
  return gross - disc - ep - cpn;
}

/**
 * P&L Net Revenue definition:
 * Net Revenue = Gross Sales - Company-Borne Discount
 * (Excludes Empty Packet and Coupon deductions, which are OpEx)
 */
export function getPnLNetRevenue(grossSales: number, totalDiscounts: number): number {
  return grossSales - totalDiscounts;
}

export interface DerivedExpenseEntry {
  id: string;
  date: string;
  category: 'Empty Packet' | 'Coupon' | 'Discount';
  categoryLabel: string;
  description: string;
  amount: number;
  paidBy?: string;
  reference: string;
  recipientName: string;
  recipientType: 'SALESMAN' | 'DEALER';
  source: 'Daily Handover';
  isDerived: true;
  notes: string;
}

/**
 * Automatically derives expense entries from eligible recorded handovers.
 * - Empty Packet
 * - Coupon
 * - Discount
 */
export function deriveExpensesFromHandovers(
  handovers: DailyHandover[],
  startDate?: string,
  endDate?: string
): DerivedExpenseEntry[] {
  const derived: DerivedExpenseEntry[] = [];

  const eligible = handovers.filter((h) => {
    if (!isEligibleHandover(h)) return false;
    if (startDate && h.date < startDate) return false;
    if (endDate && h.date > endDate) return false;
    return true;
  });

  eligible.forEach((h) => {
    const epBenefit = getHandoverEmptyPacketBenefit(h);
    if (epBenefit > 0) {
      derived.push({
        id: `derived-ep-${h.id}`,
        date: h.date,
        category: 'Empty Packet',
        categoryLabel: 'Empty Packet — From Sales',
        description: `Empty Packet Scrap Benefit (${h.type.toLowerCase()} handover)`,
        amount: epBenefit,
        paidBy: `${h.personName} (${h.type === 'SALESMAN' ? 'Sales Rep' : 'Dealer'})`,
        reference: h.handoverNumber,
        recipientName: h.personName,
        recipientType: h.type,
        source: 'Daily Handover',
        isDerived: true,
        notes: `Auto-derived from ${h.type} handover ${h.handoverNumber}. Read-only.`
      });
    }

    const cpnBenefit = getHandoverCouponBenefit(h);
    if (cpnBenefit > 0) {
      derived.push({
        id: `derived-cpn-${h.id}`,
        date: h.date,
        category: 'Coupon',
        categoryLabel: 'Coupon — From Sales',
        description: `Coupon Rebate Benefit (${h.type.toLowerCase()} handover)`,
        amount: cpnBenefit,
        paidBy: `${h.personName} (${h.type === 'SALESMAN' ? 'Sales Rep' : 'Dealer'})`,
        reference: h.handoverNumber,
        recipientName: h.personName,
        recipientType: h.type,
        source: 'Daily Handover',
        isDerived: true,
        notes: `Auto-derived from ${h.type} handover ${h.handoverNumber}. Read-only.`
      });
    }

    const disc = getHandoverTotalDiscount(h);
    if (disc > 0) {
      derived.push({
        id: `derived-disc-${h.id}`,
        date: h.date,
        category: 'Discount',
        categoryLabel: 'Discount — From Sales',
        description: `Company-Borne Item Discount (${h.type.toLowerCase()} handover)`,
        amount: disc,
        paidBy: `Company Absorbed (${h.personName})`,
        reference: h.handoverNumber,
        recipientName: h.personName,
        recipientType: h.type,
        source: 'Daily Handover',
        isDerived: true,
        notes: `Company-borne sales discount from ${h.type} handover ${h.handoverNumber}. Absorbed by company.`
      });
    }
  });

  return derived;
}

export interface CumulativeItemSoldRow {
  productId: string;
  productName: string;
  category?: string;
  brand?: string;
  salesQuantity: number;
  freeQuantity: number;
  chargeableQuantity: number;
  grossSalesValue: number;
  itemDiscount: number;
  netItemSalesValue: number;
}

/**
 * Calculates Cumulative Items Sold across eligible handovers.
 */
export function calculateCumulativeItemsSold(
  handovers: DailyHandover[],
  startDate?: string,
  endDate?: string
): {
  items: CumulativeItemSoldRow[];
  totalSalesQty: number;
  totalFreeQty: number;
  totalChargeableQty: number;
  totalGrossValue: number;
  totalItemDiscount: number;
  totalNetItemsSoldValue: number;
} {
  const map = new Map<string, CumulativeItemSoldRow>();

  const eligible = handovers.filter((h) => {
    if (!isEligibleHandover(h)) return false;
    if (startDate && h.date < startDate) return false;
    if (endDate && h.date > endDate) return false;
    return true;
  });

  eligible.forEach((h) => {
    (h.items || []).forEach((it) => {
      const salesQty = it.sales || 0;
      const freeQty = it.free || 0;
      const chargeableQty = it.chargeable ?? Math.max(0, salesQty - freeQty);
      const grossVal = it.grossAmount ?? (chargeableQty * (it.rate || 0));
      const discount = it.discount || 0;
      const netVal = it.netAmount ?? (grossVal - discount);

      const existing = map.get(it.productId) || {
        productId: it.productId,
        productName: it.productName,
        category: it.category,
        brand: it.brand,
        salesQuantity: 0,
        freeQuantity: 0,
        chargeableQuantity: 0,
        grossSalesValue: 0,
        itemDiscount: 0,
        netItemSalesValue: 0
      };

      existing.salesQuantity += salesQty;
      existing.freeQuantity += freeQty;
      existing.chargeableQuantity += chargeableQty;
      existing.grossSalesValue += grossVal;
      existing.itemDiscount += discount;
      existing.netItemSalesValue += netVal;

      map.set(it.productId, existing);
    });
  });

  const items = Array.from(map.values()).sort((a, b) => b.netItemSalesValue - a.netItemSalesValue);

  const totalSalesQty = items.reduce((sum, r) => sum + r.salesQuantity, 0);
  const totalFreeQty = items.reduce((sum, r) => sum + r.freeQuantity, 0);
  const totalChargeableQty = items.reduce((sum, r) => sum + r.chargeableQuantity, 0);
  const totalGrossValue = items.reduce((sum, r) => sum + r.grossSalesValue, 0);
  const totalItemDiscount = items.reduce((sum, r) => sum + r.itemDiscount, 0);
  const totalNetItemsSoldValue = items.reduce((sum, r) => sum + r.netItemSalesValue, 0);

  return {
    items,
    totalSalesQty,
    totalFreeQty,
    totalChargeableQty,
    totalGrossValue,
    totalItemDiscount,
    totalNetItemsSoldValue
  };
}

/**
 * Calculates Management P&L according to Change Set 2 specification:
 * Gross Sales = SUM(chargeable * recorded rate)
 * - Company-Borne Discounts = SUM(item discounts)
 * = NET REVENUE
 * 
 * - Total Operating Expenses:
 *   1. Office (manual)
 *   2. House (manual)
 *   3. GPI (manual)
 *   4. Empty Packet (from Daily Handover)
 *   5. Coupon (from Daily Handover)
 *   (Discount is NOT deducted here again!)
 * = GROSS PROFIT (Management Profit)
 */
export function calculateManagementProfitAndLoss(
  handovers: DailyHandover[],
  manualExpenses: ExpenseRecord[],
  startDate: string,
  endDate: string
) {
  const eligibleHandovers = handovers.filter((h) => {
    return isEligibleHandover(h) && h.date >= startDate && h.date <= endDate;
  });

  const periodManualExpenses = manualExpenses.filter((e) => {
    return e.date >= startDate && e.date <= endDate;
  });

  // Sales figures
  let grossSales = 0;
  let totalDiscounts = 0;
  let emptyPacketBenefit = 0;
  let couponBenefit = 0;

  eligibleHandovers.forEach((h) => {
    grossSales += getHandoverGrossSales(h);
    totalDiscounts += getHandoverTotalDiscount(h);
    emptyPacketBenefit += getHandoverEmptyPacketBenefit(h);
    couponBenefit += getHandoverCouponBenefit(h);
  });

  const netRevenue = grossSales - totalDiscounts;

  // Manual operating expenses
  const officeExpense = periodManualExpenses
    .filter((e) => e.category === 'Office')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const houseExpense = periodManualExpenses
    .filter((e) => e.category === 'House')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const gpiExpense = periodManualExpenses
    .filter((e) => e.category === 'GPI')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalOperatingExpenses =
    officeExpense + houseExpense + gpiExpense + emptyPacketBenefit + couponBenefit;

  const grossProfit = netRevenue - totalOperatingExpenses;

  return {
    grossSales,
    totalDiscounts,
    netRevenue,
    expenses: {
      office: officeExpense,
      house: houseExpense,
      gpi: gpiExpense,
      emptyPacket: emptyPacketBenefit,
      coupon: couponBenefit,
      total: totalOperatingExpenses
    },
    grossProfit
  };
}
