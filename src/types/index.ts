export type ProductCategory = 'Candy' | 'Cigarette';

export type ProductSubCategory = 'GPI' | 'IPM' | 'Fereo' | string;

export type ProductUOM = 'Jar' | 'Hanger' | 'Box' | 'Packet' | 'Pocket' | 'M' | 'Case' | string;

export type CandyUOM = 'Jar' | 'Hanger' | 'Box';

export type UserRole = 'ADMIN' | 'SALESMAN';

// Product Master (Section 4, 5, 6, 13, 14, 15, 16)
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  subCategory: ProductSubCategory; // GPI, IPM, Fereo
  brand: string;                   // Four Square, Cavanders, Marlboro, Funda Goli, etc.
  uom: ProductUOM;                 // Jar, Hanger, Box, Packet, M, Case
  rate: number;                    // Base selling rate
  emptyPocketValue: number;        // Product/brand specific empty packet value
  couponValue: number;             // Product/brand specific coupon value
  active: boolean;

  // Phase 2 UOM & Conversion extensions
  purchaseUOM?: ProductUOM;
  salesUOM?: ProductUOM;
  baseUOM?: ProductUOM;            // 'Packet' for Cigarette, 'Jar'/'Hanger'/'Box' for Candy
  caseConversionFactor?: number;   // Configurable: e.g. 50 (if 1 Case = 50 M) or 5000 (if 1 Case = 5000 Packets)
  caseConversionUnit?: 'M' | 'Packet' | 'Pocket';
  standardPurchasePrice?: number;  // Standard reference purchase price
}

export interface Person {
  id: string;
  name: string;
  phone: string;
  role: 'SALESMAN' | 'DEALER';
  avatarColor?: string;
  notes?: string;
  baseSalary?: number;             // For salary calculations
  username?: string;
  createdAt?: string;
}

export type HandoverStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'COLLECTED'
  | 'SHORT'
  | 'EXCESS'
  | 'COMPLETED'
  | 'SETTLED'
  | 'OUTSTANDING'
  | 'CANCELLED';

// Handover Item within the Daily Handover Table (Section 8, 12, 14, 48)
export interface HandoverItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  subCategory: ProductSubCategory;
  brand: string;
  uom: ProductUOM;
  opening: number;
  closing: number;
  sales: number;              // opening - closing
  free: number;               // operational free quantity
  chargeable: number;         // sales - free
  rate: number;
  grossAmount: number;        // chargeable * rate
  freeItemValue: number;      // free * rate (reporting only)
  discount: number;           // manual item discount for that day
  netAmount: number;          // grossAmount - discount

  // Product-specific Empty Pocket & Coupon collection (Section 20, 21)
  emptyPocketsCollected?: number;
  emptyPocketValue?: number;
  emptyPocketBenefit?: number; // emptyPocketsCollected * emptyPocketValue
  couponsCollected?: number;
  couponValue?: number;
  couponBenefit?: number;      // couponsCollected * couponValue
}

// Coupon Denomination Entry (Item 7: Denomination x Quantity)
export interface CouponDenominationEntry {
  id: string;
  denomination: number; // ₹ denomination: e.g. 5, 2, 1
  quantity: number;     // Number of coupons
  total: number;        // denomination * quantity
}

// Daily Handover Document (Section 7, 8, 13, 14, 15, 16, 18, 20, 21)
export interface DailyHandover {
  id: string;
  handoverNumber: string;
  type: 'SALESMAN' | 'DEALER';
  personId: string;
  personName: string;
  date: string; // YYYY-MM-DD
  // Dealer transactions require customer details (Section 23, 24)
  customerName?: string;
  customerPhone?: string;
  
  // Product Table
  items: HandoverItem[];

  // Quantity totals
  salesQuantity?: number;
  freeQuantity?: number;
  chargeableQuantity?: number;

  // Sales Summary (Section 13, 15)
  grossSales: number;         // Gross Sales = sum(chargeable * rate)
  totalDiscount: number;      // Sum of all item-level discounts
  totalItemDiscounts?: number;// Sum of product-level discounts
  freeItemValue: number;      // Informational reporting only
  netSales: number;           // Gross Sales - totalDiscount

  // Empty Packet Section (Section 16, 20, 21 - Deduction/Rebate)
  emptyPocketsCollected: number;
  emptyPacketsCollected?: number;
  emptyPocketRate?: number;
  emptyPocketBenefit: number;
  emptyPacketBenefit?: number;
  emptyPocketAmount: number;  // Compatibility alias to emptyPocketBenefit

  // Coupon Section (Section 17, 20, 21 - Deduction/Rebate)
  couponsCollected: number;
  couponRate?: number;
  couponBenefit: number;
  couponAmount: number;       // Compatibility alias to couponBenefit
  couponDenominations?: CouponDenominationEntry[]; // Multiple denomination rows

  // Final Reconciliation (Section 18, 10, 11, 12, Phase 1E)
  expectedHandover: number;   // Gross Sales - totalDiscount - Empty Packet Benefit - Coupon Benefit
  totalExpected: number;      // Compatibility alias to expectedHandover
  amountReceived: number;     // Amount handed over / Total Received
  outstanding: number;        // Expected - Received (if Expected > Received, else 0)
  excess: number;             // Received - Expected (if Received > Expected, else 0)
  difference?: number;        // Expected - Received
  status: HandoverStatus;

  // Phase 1E: Split Collection & Audit Preservation
  cashReceived?: number;      // Actual Cash collected by Admin
  gpayReceived?: number;      // Actual GPay collected by Admin
  submittedAt?: string;       // Timestamp when Salesman submitted sheet
  collectedBy?: string;       // Admin / User who verified and recorded collection
  collectedAt?: string;       // Timestamp when Admin confirmed collection

  notes?: string;
  createdAt: string;
}

// Outstanding Payment Tracking (Section 17, 18, 19, 23)
export interface OutstandingPayment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
  recordedBy?: string;
}

export interface OutstandingRecord {
  id: string;
  handoverId: string;
  handoverNumber: string;
  personId: string;
  personName: string;
  personRole: 'SALESMAN' | 'DEALER';
  date: string;
  expectedAmount: number;
  initialReceived: number;
  originalOutstanding: number;
  remainingAmount: number;
  status: 'OUTSTANDING' | 'PARTIALLY PAID' | 'SETTLED';
  payments: OutstandingPayment[];
}

// Expense Management (Section 25, 26, 27)
export type ExpenseCategory =
  | 'Office'
  | 'House'
  | 'GPI'
  | 'Empty Packet'
  | 'Empty Pocket'
  | 'Coupon'
  | 'Discount';

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidBy?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

// Inventory Modules (Section 37, 39, 40, 41)
export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  date: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'RECEIVED' | 'PARTIAL';
  notes?: string;
}

export interface StockInRecord {
  id: string;
  stockInNumber: string;
  poId?: string;
  poNumber?: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedDate: string;
  notes?: string;
}

export interface PurchaseInvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  gross: number;
  discount?: number; // Item-level discount (Item 18)
  net?: number;      // gross - discount
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplier: string;
  date: string;
  items: PurchaseInvoiceItem[];
  grossAmount: number;
  discount: number; // Purchase invoice total item discount (Item 18)
  netAmount: number;
  notes?: string;
}

// Quantity Issue (Stock issued by admin to salesman before day's run)
export interface QuantityIssue {
  id: string;
  issueNumber: string;
  personId: string;
  personName: string;
  personRole: 'SALESMAN' | 'DEALER';
  productId: string;
  sku?: string;
  productName: string;
  category: ProductCategory;
  subCategory?: string;
  brand: string;
  uom: ProductUOM;
  quantityIssued: number;
  date: string;
  notes?: string;
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

// ==========================================
// PHASE 2 DOMAIN MODELS
// ==========================================

// Staff Attendance (Simplified to PRESENT / ABSENT per Item 20)
export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface AttendanceRecord {
  id: string;
  personId: string;
  personName: string;
  personRole: 'SALESMAN' | 'DEALER' | string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  createdAt?: string;
}

// Salesman Financial Ledger (Section 5, 6, 7, 8)
export type LedgerTransactionType =
  | 'HANDOVER_SHORTAGE'
  | 'ADVANCE'
  | 'RECOVERY'
  | 'SALARY_DEDUCTION'
  | 'MANUAL_ADJUSTMENT';

export interface SalesmanLedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  salesmanId: string;
  salesmanName: string;
  type: LedgerTransactionType;
  reference: string; // Handover #, Advance #, Salary #, etc.
  description: string;
  debit: number;      // Increases recoverable balance (e.g. shortages, advances)
  credit: number;     // Decreases recoverable balance (e.g. cash repayments, salary deductions)
  runningBalance: number;
  notes?: string;
  createdAt: string;
}

// Salesman Advances (Section 7)
export interface AdvanceRecord {
  id: string;
  advanceNumber: string;
  salesmanId: string;
  salesmanName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  reason: string;
  reference?: string; // Removed from UI per Item 10
  notes?: string;
  ledgerTransactionId?: string;
  createdAt: string;
}

// Salary Tracking (Section 8)
export interface SalaryRecord {
  id: string;
  personId: string;
  personName: string;
  month: string; // YYYY-MM
  baseSalary: number;
  lopDeduction?: number;         // Loss of Pay (LOP) Deduction
  attendanceAdjustment?: number;
  otherDeductions?: number;
  ledgerRecovery: number;        // Linked to salesman financial ledger
  netSalary: number;
  paidAmount: number;
  paymentDate: string;
  status: 'PAID' | string;       // Always PAID per Item 22
  notes?: string;
  ledgerTransactionId?: string;
  createdAt: string;
}

// Initial Stock (Section 17)
export interface InitialStockRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  uom: ProductUOM;
  unitCost: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// Inventory Movement / Ledger (Section 18)
export type InventoryTransactionType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'STOCK_ISSUE'
  | 'SALES_HANDOVER'
  | 'ADJUSTMENT';

export interface InventoryMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  transactionType: InventoryTransactionType;
  reference: string;
  displayQuantity: number;
  displayUOM: ProductUOM;
  baseQuantity: number; // Normalized in base units (Packet or Jar)
  runningStockBase: number;
  unitCost?: number;
  notes?: string;
  createdAt: string;
}

// Sales Targets (Section 21, 22, 23, 24)
export type TargetPeriod = 'DAILY' | 'MONTHLY';
export type TargetType = 'VALUE' | 'QUANTITY';

export interface ProductTargetItem {
  productId: string;
  productName: string;
  targetQuantity: number;
}

export interface SalesTarget {
  id: string;
  salesmanId: string;
  salesmanName: string;
  date: string; // YYYY-MM-DD for DAILY, YYYY-MM for MONTHLY
  period: TargetPeriod;
  targetType: TargetType;
  targetValue?: number; // In ₹
  productId?: string;
  productName?: string;
  targetQuantity?: number;
  targetUOM?: ProductUOM;
  productTargets?: ProductTargetItem[]; // Product-level target quantities per Item 11
  notes?: string;
  createdAt: string;
}

