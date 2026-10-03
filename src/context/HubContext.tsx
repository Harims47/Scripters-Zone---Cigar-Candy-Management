import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Product,
  Person,
  DailyHandover,
  HandoverItem,
  ProductCategory,
  CouponDenominationEntry,
  OutstandingRecord,
  OutstandingPayment,
  ExpenseRecord,
  PurchaseOrder,
  StockInRecord,
  PurchaseInvoice,
  QuantityIssue,
  UserRole,
  AttendanceRecord,
  AttendanceStatus,
  SalesmanLedgerEntry,
  AdvanceRecord,
  SalaryRecord,
  InitialStockRecord,
  InventoryMovement,
  SalesTarget,
  HandoverStatus,
  ProductUOM
} from '../types';
import { toBaseQuantity } from '../utils/inventoryConversion';
import {
  ApiClient,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  AuthService,
  MasterDataService,
  InventoryService,
  IssueStockService,
  DailyHandoverService,
  SalesmanLedgerService,
  ExpensesService,
  AttendanceService,
  SalaryService,
  SalesTargetService,
  BackendProduct,
  BackendPerson,
  BackendDealer,
  BackendSupplier,
  BackendDailyHandover,
  BackendPurchaseInvoice,
  BackendIssueStock,
  BackendExpense,
  BackendAttendance,
  BackendSalary,
  BackendSalesTarget,
  BackendStockItem
} from '../services';

export interface ActiveUserSession {
  role: UserRole; // 'ADMIN' | 'SALESMAN' (Dealers have NO login)
  personId: string | null;
  name: string;
}

export interface HubContextType {
  // Authentication & Session
  isAuthenticated: boolean;
  isAuthBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  login: (session: ActiveUserSession) => void;
  logout: () => void;
  activeSession: ActiveUserSession;
  setActiveSession: (session: ActiveUserSession) => void;
  refreshAll: () => Promise<void>;

  // Domain Collections
  products: Product[];
  persons: Person[];
  quantityIssues: QuantityIssue[];
  handovers: DailyHandover[];
  outstandings: OutstandingRecord[];
  expenses: ExpenseRecord[];
  purchaseOrders: PurchaseOrder[];
  stockIns: StockInRecord[];
  purchaseInvoices: PurchaseInvoice[];
  suppliers: BackendSupplier[];

  // Phase 2 Collections
  attendance: AttendanceRecord[];
  salesmanLedger: SalesmanLedgerEntry[];
  advances: AdvanceRecord[];
  salaries: SalaryRecord[];
  initialStocks: InitialStockRecord[];
  inventoryMovements: InventoryMovement[];
  salesTargets: SalesTarget[];

  // Product Actions
  addProduct: (product: Omit<Product, 'id'>) => Promise<{ product?: Product; error?: string }>;
  updateProduct: (product: Product) => Promise<{ product?: Product; error?: string }>;
  deleteProduct: (id: string) => void;

  // Handover Actions (Core Workflow)
  addHandover: (handover: Omit<DailyHandover, 'id' | 'handoverNumber' | 'createdAt'>) => DailyHandover;
  confirmHandoverCollection: (
    handoverId: string,
    collection: {
      cashReceived: number;
      gpayReceived: number;
      notes?: string;
      adminName?: string;
    }
  ) => DailyHandover | null;
  deleteHandover: (id: string) => void;

  // Outstanding Payment Actions
  recordOutstandingPayment: (
    outstandingId: string,
    amount: number,
    notes?: string,
    recordedBy?: string
  ) => void;

  // Expense Actions
  addExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => ExpenseRecord;
  deleteExpense: (id: string) => void;

  // Inventory Actions
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'poNumber'>) => PurchaseOrder;
  updatePurchaseOrderStatus: (id: string, status: 'PENDING' | 'RECEIVED' | 'PARTIAL') => void;
  addStockIn: (stockIn: Omit<StockInRecord, 'id' | 'stockInNumber'>) => StockInRecord;
  addPurchaseInvoice: (inv: Omit<PurchaseInvoice, 'id' | 'invoiceNumber'>) => Promise<{ invoice?: PurchaseInvoice; error?: string }>;

  // Staff & Dealer Actions
  addPerson: (person: Omit<Person, 'id'> & { password?: string }) => Promise<{ person?: Person; error?: string }>;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;

  // Quantity Issue Actions
  addQuantityIssue: (issue: Omit<QuantityIssue, 'id' | 'issueNumber'>) => QuantityIssue;
  deleteQuantityIssue: (id: string) => void;

  // Phase 2: Attendance Actions
  markAttendance: (record: Omit<AttendanceRecord, 'id' | 'createdAt'>) => { record?: AttendanceRecord; error?: string };
  bulkMarkAttendance: (date: string, records: Array<{ personId: string; personName: string; personRole: string; status: AttendanceStatus; notes?: string }>) => void;
  updateAttendance: (record: AttendanceRecord) => void;
  deleteAttendance: (id: string) => void;

  // Phase 2: Salesman Financial Ledger & Advances
  addLedgerEntry: (entry: Omit<SalesmanLedgerEntry, 'id' | 'createdAt' | 'runningBalance'>) => SalesmanLedgerEntry;
  getSalesmanLedgerBalance: (salesmanId: string) => number;
  addAdvance: (advance: Omit<AdvanceRecord, 'id' | 'advanceNumber' | 'createdAt'>) => AdvanceRecord;

  // Phase 2: Salary Tracking
  addSalaryRecord: (salary: Omit<SalaryRecord, 'id' | 'createdAt'>) => { record?: SalaryRecord; error?: string };
  updateSalaryRecord: (salary: SalaryRecord) => void;

  // Phase 2: Initial Stock & Inventory Movements
  addInitialStock: (stock: Omit<InitialStockRecord, 'id' | 'createdAt'>) => { record?: InitialStockRecord; error?: string };
  addInventoryMovement: (movement: Omit<InventoryMovement, 'id' | 'createdAt' | 'runningStockBase'>) => InventoryMovement;
  getProductStockBase: (productId: string) => number;

  // Phase 2: Sales Targets
  addSalesTarget: (target: Omit<SalesTarget, 'id' | 'createdAt'>) => SalesTarget;
  updateSalesTarget: (target: SalesTarget) => void;
  deleteSalesTarget: (id: string) => void;

  // Reset demo
  resetDemoData: () => void;
}

const STORAGE_KEY = 'CANDY_CIGARETTE_FINAL_FLOW_V3';

const HubContext = createContext<HubContextType | undefined>(undefined);

// Safe date parser to guard against null/undefined in database fields
const safeDate = (val?: string | null): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  return String(val).includes('T') ? String(val).split('T')[0] : String(val);
};

// Mapping helper functions
const mapBackendProduct = (p: BackendProduct): Product => {
  const isCandy = p.category === 'CANDY';
  return {
    id: p.id,
    sku: p.sku || '',
    name: p.name,
    category: isCandy ? 'Candy' : 'Cigarette',
    subCategory: p.brand || 'GPI',
    brand: p.brand,
    uom: p.salesUom || (isCandy ? 'Jar' : 'Packet'),
    purchaseUOM: p.purchaseUom,
    salesUOM: p.salesUom,
    baseUOM: p.baseUom,
    rate: Number(p.salesRate),
    standardPurchasePrice: Number(p.standardPurchasePrice),
    emptyPocketValue: 0,
    couponValue: 0,
    active: p.active,
  };
};

const mapBackendPerson = (p: BackendPerson): Person => ({
  id: p.id,
  name: p.name,
  phone: p.phone || '',
  role: 'SALESMAN',
  active: p.active,
  avatarColor: '#4f46e5',
  notes: p.user?.username ? `@${p.user.username}` : (p.address || ''),
  username: p.user?.username || (p as any).username || undefined,
  createdAt: (p as any).createdAt || new Date().toISOString(),
});

const mapBackendDealer = (d: BackendDealer): Person => ({
  id: d.id,
  name: d.name,
  phone: d.phone || '',
  role: 'DEALER',
  active: d.active,
  avatarColor: '#0284c7',
  notes: d.address || '',
  createdAt: d.createdAt || new Date().toISOString(),
});
const mapBackendHandover = (h: BackendDailyHandover): DailyHandover => {
  const personId = h.salesmanId || h.dealerId || '';
  const personName = h.salesman?.name || h.dealer?.name || h.salesmanName || h.dealerName || '';

  const items: HandoverItem[] = (h.items || []).map((it) => {
    const opening = Number(it.openingQuantity);
    const closing = Number(it.closingQuantity);
    const sales = Number(it.salesQuantity);
    const free = Number(it.freeQuantity);
    const chargeable = Number(it.chargeableQuantity);
    const rate = Number(it.rate);
    const grossAmount = Number(it.grossAmount);
    const freeItemValue = Number(it.freeItemValue);
    const discount = Number(it.discount);
    const netAmount = Number(it.netAmount);

    return {
      productId: it.productId,
      productName: it.product?.name || it.productName || '',
      category: (it.product?.category ? (it.product.category === 'CANDY' ? 'Candy' : 'Cigarette') : 'Candy') as ProductCategory,
      subCategory: it.product?.brand || '',
      brand: it.product?.brand || '',
      uom: it.uom,
      opening,
      closing,
      sales,
      free,
      chargeable,
      rate,
      grossAmount,
      freeItemValue,
      discount,
      netAmount,
    };
  });

  const emptyPacketsCount = (h.emptyPackets || []).reduce((acc, ep) => acc + Number(ep.quantity), 0);
  const couponDenominations: CouponDenominationEntry[] = (h.coupons || []).map((c) => ({
    id: c.id || `cpn-${c.denomination}`,
    denomination: Number(c.denomination),
    quantity: Number(c.quantity),
    total: Number(c.amount),
  }));

  const expectedHandover = Number(h.expectedHandover);
  const collectionTotal = Number(h.collectionTotal);
  const outstanding = Number(h.outstanding);
  const excess = Number(h.excess);

  return {
    id: h.id,
    handoverNumber: `HND-${safeDate(h.handoverDate).replace(/-/g, '')}-${h.id.slice(0, 4)}`,
    type: h.recipientType,
    personId,
    personName,
    date: safeDate(h.handoverDate),
    customerName: h.customerName || undefined,
    customerPhone: h.customerPhone || undefined,
    items,
    grossSales: Number(h.grossSales),
    totalDiscount: Number(h.totalItemDiscount),
    freeItemValue: Number(h.freeItemValue),
    netSales: Number(h.netSales),
    emptyPocketsCollected: emptyPacketsCount,
    emptyPocketAmount: Number(h.emptyPacketBenefit),
    emptyPocketBenefit: Number(h.emptyPacketBenefit),
    couponsCollected: (h.coupons || []).reduce((acc, c) => acc + Number(c.quantity), 0),
    couponAmount: Number(h.couponBenefit),
    couponBenefit: Number(h.couponBenefit),
    couponDenominations,
    expectedHandover,
    totalExpected: expectedHandover,
    cashReceived: Number(h.cashCollected),
    gpayReceived: Number(h.gpayCollected),
    amountReceived: collectionTotal,
    difference: expectedHandover - collectionTotal,
    outstanding,
    excess,
    status: h.status as any,
    notes: h.notes || undefined,
    createdAt: h.createdAt || new Date().toISOString(),
  };
};

const mapBackendInvoice = (inv: BackendPurchaseInvoice): PurchaseInvoice => {
  const items = (inv.items || []).map((it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.actualRate ?? it.purchaseCost ?? 0);
    const gross = Number(it.grossTotal ?? it.grossAmount ?? (qty * rate));
    const discount = Number(it.discount ?? 0);
    const net = Number(it.netTotal ?? it.netAmount ?? Math.max(0, gross - discount));
    return {
      productId: it.productId,
      productName: it.productName || '',
      quantity: qty,
      rate,
      gross,
      discount,
      net,
    };
  });

  const grossAmount = Number(
    inv.grossTotal ?? inv.totalGross ?? items.reduce((sum, it) => sum + it.gross, 0)
  );
  const discount = Number(
    inv.totalItemDiscount ?? inv.totalDiscount ?? items.reduce((sum, it) => sum + it.discount, 0)
  );
  const netAmount = Number(
    inv.netTotal ?? inv.totalNet ?? Math.max(0, grossAmount - discount)
  );

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplier: inv.supplier?.name || inv.supplierName || 'Central Supplier',
    date: safeDate(inv.invoiceDate),
    items,
    grossAmount,
    discount,
    netAmount,
    notes: '',
  };
};

const mapBackendIssueStockList = (issues: BackendIssueStock[], prods: Product[] = []): QuantityIssue[] => {
  const result: QuantityIssue[] = [];
  for (const issue of issues) {
    const issueNum = `ISS-${safeDate(issue.issueDate).replace(/-/g, '')}-${issue.id.slice(0, 4)}`;
    const personId = issue.salesmanId || issue.dealerId || '';
    const personName = issue.salesman?.name || issue.dealer?.name || issue.salesmanName || issue.dealerName || '';
    const personRole = issue.recipientType as 'SALESMAN' | 'DEALER';
    const date = safeDate(issue.issueDate);

    for (const it of issue.items || []) {
      const p = prods.find((prod) => prod.id === it.productId);
      result.push({
        id: it.id || `${issue.id}-${it.productId}`,
        issueStockId: issue.id,
        issueNumber: issueNum,
        personId,
        personName,
        personRole,
        productId: it.productId,
        sku: p?.sku,
        productName: it.product?.name || it.productName || p?.name || '',
        category: p?.category || 'Candy',
        subCategory: p?.subCategory,
        brand: p?.brand || '',
        uom: it.uom,
        quantityIssued: Number(it.quantity),
        date,
      });
    }
  }
  return result;
};

const mapBackendExpense = (exp: BackendExpense): ExpenseRecord => ({
  id: exp.id,
  date: safeDate(exp.expenseDate),
  category: exp.category === 'OFFICE' ? 'Office' : exp.category === 'HOUSE' ? 'House' : 'GPI',
  amount: Number(exp.amount),
  description: exp.notes,
  paidBy: exp.createdBy || 'Central Office',
  reference: exp.id.slice(0, 8),
  notes: exp.notes,
  createdAt: exp.createdAt || new Date().toISOString(),
});

const mapBackendAttendance = (att: BackendAttendance): AttendanceRecord => ({
  id: att.id,
  date: safeDate(att.attendanceDate),
  personId: att.salesmanId,
  personName: att.salesman?.name || att.salesmanName || '',
  personRole: 'SALESMAN',
  status: att.status,
  notes: att.notes || undefined,
  createdAt: att.createdAt || new Date().toISOString(),
});

const mapBackendSalary = (sal: BackendSalary): SalaryRecord => ({
  id: sal.id,
  personId: sal.salesmanId,
  personName: sal.salesman?.name || sal.salesmanName || '',
  month: safeDate(sal.salaryMonth).slice(0, 7),
  baseSalary: Number(sal.baseSalary),
  lopDeduction: Number((sal as any).lopDeduction || 0),
  ledgerRecovery: Number(sal.salaryRecovery),
  netSalary: Number(sal.netSalary),
  paidAmount: Number(sal.netSalary),
  paymentDate: safeDate(sal.paidDate || sal.createdAt),
  status: 'PAID',
  createdAt: sal.createdAt || new Date().toISOString(),
});

const mapBackendTarget = (tgt: BackendSalesTarget): SalesTarget => ({
  id: tgt.id,
  salesmanId: tgt.salesmanId,
  salesmanName: tgt.salesmanName || '',
  date: safeDate(tgt.targetDate),
  period: 'DAILY',
  targetType: 'VALUE',
  targetValue: Number(tgt.dailyRevenueTarget),
  active: (tgt as any).active !== undefined ? (tgt as any).active : true,
  productTargets: (tgt.productTargets || []).map((pt) => ({
    productId: pt.productId,
    productName: pt.productName || '',
    targetQuantity: Number(pt.targetQuantity),
  })),
  createdAt: tgt.createdAt || new Date().toISOString(),
});

// Helper to compute derived outstandings with salesman recoveries and payments applied FIFO
export const buildDerivedOutstandings = (
  handovers: DailyHandover[],
  ledgerEntries: SalesmanLedgerEntry[],
  advances: AdvanceRecord[] = []
): OutstandingRecord[] => {
  const shortHandovers = handovers.filter(
    (h) => (h.outstanding && h.outstanding > 0) || h.status === 'SHORT' || h.status === 'OUTSTANDING'
  );

  // Group credit transactions per salesman chronologically
  const creditsBySalesman = new Map<
    string,
    Array<{ id: string; date: string; amount: number; remainingCredit: number; notes?: string; reference?: string }>
  >();

  ledgerEntries
    .filter((e) => e.credit > 0)
    .sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    })
    .forEach((e) => {
      const list = creditsBySalesman.get(e.salesmanId) || [];
      list.push({
        id: e.id,
        date: e.date,
        amount: e.credit,
        remainingCredit: e.credit,
        notes: e.notes || e.description,
        reference: e.reference,
      });
      creditsBySalesman.set(e.salesmanId, list);
    });

  // Sort short handovers chronologically
  const sortedShortHandovers = [...shortHandovers].sort((a, b) => {
    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  const handoverOutstandings = sortedShortHandovers.map((h) => {
    const originalOutstanding = Number(h.outstanding || 0);
    const payments: OutstandingPayment[] = [];
    let recoveredSoFar = 0;

    if (h.type === 'SALESMAN') {
      const availableCredits = creditsBySalesman.get(h.personId) || [];

      // Pass 1: match specific reference if any (dailyHandoverId or handoverNumber)
      for (const cred of availableCredits) {
        if (cred.remainingCredit <= 0) continue;
        if (cred.reference === h.id || cred.reference === h.handoverNumber) {
          const needed = originalOutstanding - recoveredSoFar;
          if (needed > 0) {
            const allocate = Math.min(needed, cred.remainingCredit);
            recoveredSoFar += allocate;
            cred.remainingCredit -= allocate;
            payments.push({
              id: cred.id,
              date: cred.date,
              amount: allocate,
              notes: cred.notes,
              recordedBy: 'Admin',
            });
          }
        }
      }

      // Pass 2: match general recoveries/credits FIFO
      for (const cred of availableCredits) {
        if (cred.remainingCredit <= 0) continue;
        const needed = originalOutstanding - recoveredSoFar;
        if (needed > 0) {
          const allocate = Math.min(needed, cred.remainingCredit);
          recoveredSoFar += allocate;
          cred.remainingCredit -= allocate;
          payments.push({
            id: cred.id,
            date: cred.date,
            amount: allocate,
            notes: cred.notes,
            recordedBy: 'Admin',
          });
        }
      }
    }

    const remainingAmount = Math.max(0, originalOutstanding - recoveredSoFar);
    const status: 'OUTSTANDING' | 'PARTIALLY PAID' | 'SETTLED' =
      remainingAmount === 0
        ? 'SETTLED'
        : recoveredSoFar > 0
        ? 'PARTIALLY PAID'
        : 'OUTSTANDING';

    return {
      id: `out-${h.id}`,
      handoverId: h.id,
      handoverNumber: h.handoverNumber,
      personId: h.personId,
      personName: h.personName,
      personRole: h.type as 'SALESMAN' | 'DEALER',
      date: h.date,
      expectedAmount: h.expectedHandover || (h as any).totalExpected || 0,
      initialReceived: h.amountReceived || (h.cashReceived || 0) + (h.gpayReceived || 0),
      originalOutstanding,
      remainingAmount,
      status,
      payments,
    };
  });

  // Process Advances: each advance is an outstanding receivable until recovered/deducted
  const sortedAdvances = [...advances].sort((a, b) => {
    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  const advanceOutstandings = sortedAdvances.map((adv) => {
    const originalOutstanding = Number(adv.amount || 0);
    const payments: OutstandingPayment[] = [];
    let recoveredSoFar = 0;

    const availableCredits = creditsBySalesman.get(adv.salesmanId) || [];

    // Pass 1: match specific reference if any
    for (const cred of availableCredits) {
      if (cred.remainingCredit <= 0) continue;
      if (cred.reference === adv.id || cred.reference === adv.advanceNumber) {
        const needed = originalOutstanding - recoveredSoFar;
        if (needed > 0) {
          const allocate = Math.min(needed, cred.remainingCredit);
          recoveredSoFar += allocate;
          cred.remainingCredit -= allocate;
          payments.push({
            id: cred.id,
            date: cred.date,
            amount: allocate,
            notes: cred.notes,
            recordedBy: 'Admin',
          });
        }
      }
    }

    // Pass 2: match general remaining credits FIFO
    for (const cred of availableCredits) {
      if (cred.remainingCredit <= 0) continue;
      const needed = originalOutstanding - recoveredSoFar;
      if (needed > 0) {
        const allocate = Math.min(needed, cred.remainingCredit);
        recoveredSoFar += allocate;
        cred.remainingCredit -= allocate;
        payments.push({
          id: cred.id,
          date: cred.date,
          amount: allocate,
          notes: cred.notes,
          recordedBy: 'Admin',
        });
      }
    }

    const remainingAmount = Math.max(0, originalOutstanding - recoveredSoFar);
    const status: 'OUTSTANDING' | 'PARTIALLY PAID' | 'SETTLED' =
      remainingAmount === 0
        ? 'SETTLED'
        : recoveredSoFar > 0
        ? 'PARTIALLY PAID'
        : 'OUTSTANDING';

    return {
      id: `out-adv-${adv.id}`,
      handoverId: adv.id,
      handoverNumber: adv.advanceNumber || `ADV-${adv.id.slice(0, 8)}`,
      personId: adv.salesmanId,
      personName: adv.salesmanName,
      personRole: 'SALESMAN' as const,
      date: adv.date,
      expectedAmount: adv.amount,
      initialReceived: 0,
      originalOutstanding,
      remainingAmount,
      status,
      payments,
    };
  });

  return [...handoverOutstandings, ...advanceOutstandings];
};

export const HubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth & Session: Strictly In-Memory React State + Backend /auth/me Session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<ActiveUserSession>({
    role: 'ADMIN',
    personId: null,
    name: 'Central Admin',
  });

  // Domain Collections
  const [products, setProducts] = useState<Product[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [quantityIssues, setQuantityIssues] = useState<QuantityIssue[]>([]);
  const [handovers, setHandovers] = useState<DailyHandover[]>([]);
  const [outstandings, setOutstandings] = useState<OutstandingRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stockIns, setStockIns] = useState<StockInRecord[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salesmanLedger, setSalesmanLedger] = useState<SalesmanLedgerEntry[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [initialStocks, setInitialStocks] = useState<InitialStockRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);

  const clearError = () => setError(null);

  const login = (session: ActiveUserSession) => {
    setActiveSession(session);
    setIsAuthenticated(true);
    refreshAll();
  };

  const logout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setActiveSession({ role: 'ADMIN', personId: null, name: 'Central Admin' });
  };

  // Listen for unauthorized 401 callbacks
  useEffect(() => {
    ApiClient.onUnauthorized(() => {
      logout();
    });
  }, []);

  // Fetch all authoritative backend data
  const refreshAll = useCallback(async () => {
    if (!isAuthenticated && !getAuthToken()) return;
    setIsLoading(true);
    setError(null);

    try {
      const isSalesman = activeSession.role === 'SALESMAN';

      // Concurrently query backend services
      const [
        prodsRes,
        dealersRes,
        salesmenRes,
        suppliersRes,
        stockRes,
        invoicesRes,
        issuesRes,
        handoversRes,
        targetsRes,
        ledgerRes,
        expensesRes,
        attendanceRes,
        salariesRes,
      ] = await Promise.allSettled([
        MasterDataService.getProducts(),
        MasterDataService.getDealers(),
        MasterDataService.getPersons({ type: 'SALESMAN' }),
        MasterDataService.getSuppliers(),
        InventoryService.getStock(),
        InventoryService.getPurchaseInvoices(),
        IssueStockService.getIssueStock(),
        DailyHandoverService.getDailyHandovers(),
        isSalesman ? SalesTargetService.getMySalesTargets() : SalesTargetService.getSalesTargets(),
        isSalesman ? SalesmanLedgerService.getMyLedger() : SalesmanLedgerService.getSalesmanLedger(),
        ExpensesService.getExpenses(),
        AttendanceService.getAttendance(),
        isSalesman ? SalaryService.getMySalaries() : SalaryService.getSalaries(),
      ]);

      // 1. Products & Initial Stocks
      let currentProds: Product[] = [];
      if (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value)) {
        currentProds = prodsRes.value.map(mapBackendProduct);
        setProducts(currentProds);

        // Populate initialStocks from products returned by backend
        const loadedInitialStocks: InitialStockRecord[] = [];
        prodsRes.value.forEach((p: BackendProduct) => {
          if (p.initialStock) {
            const uomStr = (p.initialStock.uom || 'PACKET').toUpperCase();
            const mappedUom: ProductUOM =
              uomStr === 'JAR'
                ? 'Jar'
                : uomStr === 'HANGER'
                ? 'Hanger'
                : uomStr === 'BOX'
                ? 'Box'
                : uomStr === 'CASE'
                ? 'Case'
                : uomStr === 'M'
                ? 'M'
                : 'Packet';

            loadedInitialStocks.push({
              id: p.initialStock.id,
              productId: p.id,
              productName: p.name,
              quantity: Number(p.initialStock.quantity || 0),
              uom: mappedUom,
              unitCost: Number(p.standardPurchasePrice || 0),
              date: safeDate(p.initialStock.createdAt),
              notes: 'Baseline Opening Stock',
              createdAt: p.initialStock.createdAt || new Date().toISOString(),
            });
          }
        });
        setInitialStocks(loadedInitialStocks);
      }

      // 2. Persons (Dealers + Salesmen)
      const combinedPersons: Person[] = [];
      if (salesmenRes.status === 'fulfilled' && Array.isArray(salesmenRes.value)) {
        combinedPersons.push(...salesmenRes.value.map(mapBackendPerson));
      }
      if (dealersRes.status === 'fulfilled' && Array.isArray(dealersRes.value)) {
        combinedPersons.push(...dealersRes.value.map(mapBackendDealer));
      }
      combinedPersons.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPersons(combinedPersons);

      // 2b. Suppliers
      if (suppliersRes.status === 'fulfilled' && Array.isArray(suppliersRes.value)) {
        setSuppliers(suppliersRes.value);
      }

      // 3. Purchase Invoices
      if (invoicesRes.status === 'fulfilled' && Array.isArray(invoicesRes.value)) {
        setPurchaseInvoices(invoicesRes.value.map(mapBackendInvoice));
      }

      // 4. Quantity Issues
      if (issuesRes.status === 'fulfilled' && Array.isArray(issuesRes.value)) {
        setQuantityIssues(mapBackendIssueStockList(issuesRes.value, currentProds));
      }

      // 5. Salesman Ledger & Advances (Processed first so recoveries link to handovers & advances)
      let parsedLedgerTxs: SalesmanLedgerEntry[] = [];
      let derivedAdvances: AdvanceRecord[] = [];
      if (ledgerRes.status === 'fulfilled' && ledgerRes.value?.transactions) {
        parsedLedgerTxs = ledgerRes.value.transactions.map((t: any) => ({
          id: t.id,
          date: safeDate(t.transactionDate),
          salesmanId: t.salesmanId,
          salesmanName: t.salesmanName || '',
          type: t.type === 'HANDOVER_SHORT' ? 'HANDOVER_SHORTAGE' : t.type,
          reference: t.referenceId || t.id.slice(0, 8),
          description: t.notes || t.type,
          debit: t.direction === 'DEBIT' ? Number(t.amount) : 0,
          credit: t.direction === 'CREDIT' ? Number(t.amount) : 0,
          runningBalance: Number(t.runningBalance || 0),
          notes: t.notes || undefined,
          createdAt: t.createdAt || new Date().toISOString(),
        }));
        setSalesmanLedger(parsedLedgerTxs);

        derivedAdvances = parsedLedgerTxs
          .filter((t) => t.type === 'ADVANCE')
          .map((t) => ({
            id: t.id,
            advanceNumber: `ADV-${t.date.replace(/-/g, '')}`,
            salesmanId: t.salesmanId,
            salesmanName: t.salesmanName,
            date: t.date,
            amount: t.debit,
            reason: t.description || 'Cash Advance',
            notes: t.notes,
            createdAt: t.createdAt,
          }));
        setAdvances(derivedAdvances);
      }

      // 6. Daily Handovers & Reconciled Outstandings
      if (handoversRes.status === 'fulfilled' && Array.isArray(handoversRes.value)) {
        const mappedHandovers = handoversRes.value.map(mapBackendHandover);
        setHandovers(mappedHandovers);

        // Derive Outstandings with recoveries and repayments accurately reflected, including advances
        const derivedOutstandings = buildDerivedOutstandings(mappedHandovers, parsedLedgerTxs, derivedAdvances);
        setOutstandings(derivedOutstandings);
      }

      // 7. Sales Targets
      if (targetsRes.status === 'fulfilled' && Array.isArray(targetsRes.value)) {
        setSalesTargets(targetsRes.value.map(mapBackendTarget));
      }

      // 8. Expenses
      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)) {
        setExpenses(expensesRes.value.map(mapBackendExpense));
      }

      // 9. Attendance
      if (attendanceRes.status === 'fulfilled' && Array.isArray(attendanceRes.value)) {
        setAttendance(attendanceRes.value.map(mapBackendAttendance));
      }

      // 10. Salaries
      if (salariesRes.status === 'fulfilled' && Array.isArray(salariesRes.value)) {
        setSalaries(salariesRes.value.map(mapBackendSalary));
      }

      // 11. Inventory Movements derived from Stock Items
      if (stockRes.status === 'fulfilled' && Array.isArray(stockRes.value)) {
        const movements: InventoryMovement[] = stockRes.value.map((st: BackendStockItem) => {
          const qty = Number(st.currentStock !== undefined ? st.currentStock : (st.currentStockBase !== undefined ? st.currentStockBase : 0));
          return {
            id: `stk-${st.productId}`,
            date: safeDate(st.lastUpdated),
            productId: st.productId,
            productName: st.productName,
            transactionType: 'PURCHASE',
            reference: 'MASTER_STOCK',
            displayQuantity: qty,
            displayUOM: (st.baseUom || 'PACKET') as ProductUOM,
            baseQuantity: qty,
            runningStockBase: qty,
            notes: `Available base stock`,
            createdAt: st.lastUpdated || new Date().toISOString(),
          };
        });
        setInventoryMovements(movements);
      }
    } catch (err: any) {
      console.error('Error refreshing backend data:', err);
      setError(err.message || 'Failed to refresh data from server');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeSession.role]);

  // Auth Bootstrap on App Startup: Strictly authoritative via backend /auth/me
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const me = await AuthService.getMe();
        if (me?.user) {
          const session: ActiveUserSession = {
            role: me.user.role,
            personId: me.user.person?.id || null,
            name: me.user.person?.name || me.user.username,
          };
          setActiveSession(session);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        clearAuthToken();
        setIsAuthenticated(false);
      } finally {
        setIsAuthBootstrapping(false);
      }
    };

    bootstrapAuth();
  }, []);

  // When authenticated, trigger initial refresh
  useEffect(() => {
    if (isAuthenticated) {
      refreshAll();
    }
  }, [isAuthenticated, refreshAll]);

  // Actions
  const addProduct = async (p: Omit<Product, 'id'>): Promise<{ product?: Product; error?: string }> => {
    const tempId = `prod-temp-${Date.now()}`;
    const optimistic: Product = { ...p, id: tempId };
    setProducts((prev) => [optimistic, ...prev]);

    try {
      const created = await MasterDataService.createProduct({
        name: p.name,
        sku: p.sku || undefined,
        category: p.category === 'Candy' ? 'CANDY' : 'CIGARETTE',
        brand: p.brand || p.subCategory || 'General',
        baseUom: (p.baseUOM || (p.category === 'Candy' ? 'JAR' : 'PACKET')).toUpperCase(),
        salesUom: (p.salesUOM || p.uom || 'PACKET').toUpperCase(),
        purchaseUom: (p.purchaseUOM || (p.category === 'Candy' ? 'JAR' : 'CASE')).toUpperCase(),
        standardPurchasePrice: Number(p.standardPurchasePrice || 0),
        rate: Number(p.rate || 0),
        caseConversionFactor: p.category === 'Cigarette' && p.caseConversionFactor ? Number(p.caseConversionFactor) : undefined,
        caseConversionUnit: p.category === 'Cigarette' && p.caseConversionUnit ? (p.caseConversionUnit.toUpperCase() as 'M' | 'PACKET') : undefined,
      });

      if (created && created.id) {
        setProducts((prev) => prev.map((item) => (item.id === tempId ? mapBackendProduct(created) : item)));
      }
      await refreshAll();
      clearError();
      return { product: created ? mapBackendProduct(created) : optimistic };
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setProducts((prev) => prev.filter((item) => item.id !== tempId));
      return { error: err.message || 'Failed to create product' };
    }
  };

  const updateProduct = async (p: Product): Promise<{ product?: Product; error?: string }> => {
    setProducts((prev) => prev.map((item) => (item.id === p.id ? p : item)));
    const targetProduct = products.find((item) => item.id === p.id || (item.name === p.name && !item.id.startsWith('prod-temp-')));
    const effectiveId = targetProduct && !targetProduct.id.startsWith('prod-temp-') ? targetProduct.id : p.id;

    try {
      await MasterDataService.updateProduct(effectiveId, {
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        standardPurchasePrice: p.standardPurchasePrice,
        rate: p.rate,
        active: p.active,
      });
      await refreshAll();
      clearError();
      return { product: p };
    } catch (err: any) {
      console.error('Failed to update product:', err);
      return { error: err.message || 'Failed to update product' };
    }
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
    MasterDataService.deleteProduct(id)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete product:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const addPerson = async (p: Omit<Person, 'id'> & { password?: string }): Promise<{ person?: Person; error?: string }> => {
    const tempId = `pers-temp-${Date.now()}`;
    const optimistic: Person = { ...p, id: tempId };
    setPersons((prev) => [optimistic, ...prev]);

    try {
      if (p.role === 'DEALER') {
        const dealer = await MasterDataService.createDealer({ name: p.name, phone: p.phone, address: p.notes });
        await refreshAll();
        return { person: mapBackendDealer(dealer) };
      } else {
        const person = await MasterDataService.createPerson({
          name: p.name,
          phone: p.phone,
          address: p.notes,
          type: 'SALESMAN',
          username: p.username,
          password: p.password,
        });
        await refreshAll();
        return { person: mapBackendPerson(person) };
      }
    } catch (err: any) {
      setPersons((prev) => prev.filter((i) => i.id !== tempId));
      const msg = err.message || 'Failed to create person';
      setError(msg);
      return { error: msg };
    }
  };

  const updatePerson = (p: Person) => {
    setPersons((prev) => prev.map((i) => (i.id === p.id ? p : i)));
    if (p.role === 'DEALER') {
      MasterDataService.updateDealer(p.id, { name: p.name, phone: p.phone, address: p.notes })
        .then(() => refreshAll())
        .catch((err) => setError(err.message));
    } else {
      MasterDataService.updatePerson(p.id, { name: p.name, phone: p.phone, address: p.notes, active: true })
        .then(() => refreshAll())
        .catch((err) => setError(err.message));
    }
  };

  const deletePerson = (id: string) => {
    const target = persons.find((p) => p.id === id);
    setPersons((prev) => prev.filter((i) => i.id !== id));
    const deletePromise =
      target?.role === 'DEALER'
        ? MasterDataService.deleteDealer(id)
        : MasterDataService.deletePerson(id);

    deletePromise
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete person:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const addPurchaseInvoice = async (inv: Omit<PurchaseInvoice, 'id' | 'invoiceNumber'>): Promise<{ invoice?: PurchaseInvoice; error?: string }> => {
    const rawNumber = inv.notes?.trim() || `INV-${Date.now().toString().slice(-6)}`;
    const tempNumber = rawNumber.startsWith('INV-') ? rawNumber : `INV-${rawNumber}`;
    const tempId = `inv-temp-${Date.now()}`;
    const optimistic: PurchaseInvoice = { ...inv, id: tempId, invoiceNumber: tempNumber };
    setPurchaseInvoices((prev) => [optimistic, ...prev]);

    // Optimistically update inventory movements immediately so Live Stock on Hand updates in REAL-TIME!
    const optimisticMovements: InventoryMovement[] = inv.items.map((it, idx) => {
      const prod = products.find((p) => p.id === it.productId);
      const baseQty = prod ? toBaseQuantity(prod, it.quantity, prod.uom).baseQuantity : it.quantity;
      return {
        id: `mov-inv-${Date.now()}-${idx}`,
        date: inv.date || new Date().toISOString().split('T')[0],
        productId: it.productId,
        productName: it.productName || prod?.name || '',
        transactionType: 'PURCHASE',
        reference: tempNumber,
        displayQuantity: it.quantity,
        displayUOM: (prod?.uom || 'PACKET') as ProductUOM,
        baseQuantity: baseQty,
        runningStockBase: baseQty,
        notes: `Purchase Invoice: ${tempNumber}`,
        createdAt: new Date().toISOString(),
      };
    });
    setInventoryMovements((prev) => [...optimisticMovements, ...prev]);

    try {
      // 1. Resolve or create Supplier
      let targetSupplier = suppliers.find(
        (s) => s.id === inv.supplier || s.name.toLowerCase() === inv.supplier.trim().toLowerCase()
      );

      if (!targetSupplier) {
        try {
          const createdSup = await MasterDataService.createSupplier({
            name: inv.supplier.trim() || 'Central Supplier',
          });
          targetSupplier = createdSup;
          setSuppliers((prev) => [createdSup, ...prev]);
        } catch {
          // If supplier already exists or error, try fetching suppliers
          const fresh = await MasterDataService.getSuppliers();
          setSuppliers(fresh);
          targetSupplier = fresh.find(
            (s: any) => s.name.toLowerCase() === inv.supplier.trim().toLowerCase()
          ) || fresh[0];
        }
      }

      if (!targetSupplier?.id) {
        throw new Error('Unable to resolve supplier for purchase invoice');
      }

      // 2. Call backend to create purchase invoice and atomic stock movements
      await InventoryService.createPurchaseInvoice({
        invoiceNumber: tempNumber,
        supplierId: targetSupplier.id,
        invoiceDate: inv.date,
        items: inv.items.map((it) => {
          const prod = products.find((p) => p.id === it.productId);
          const uomRaw = prod?.uom || 'JAR';
          const uomBackend = uomRaw.toUpperCase() === 'POCKET' ? 'PACKET' : uomRaw.toUpperCase();
          return {
            productId: it.productId,
            quantity: it.quantity,
            uom: uomBackend as any,
            actualRate: it.rate,
            discount: it.discount || 0,
          };
        }),
      });

      // 3. Sync real server records
      await refreshAll();
      return { invoice: optimistic };
    } catch (err: any) {
      console.error('Error creating purchase invoice:', err);
      setPurchaseInvoices((prev) => prev.filter((i) => i.id !== tempId));
      setInventoryMovements((prev) => prev.filter((m) => !optimisticMovements.some((om) => om.id === m.id)));
      setError(err.message || 'Failed to create purchase invoice');
      return { error: err.message || 'Failed to create purchase invoice' };
    }
  };

  const addQuantityIssue = (issue: Omit<QuantityIssue, 'id' | 'issueNumber'>): QuantityIssue => {
    const tempNumber = `ISS-${Date.now().toString().slice(-6)}`;
    const tempId = `iss-temp-${Date.now()}`;
    const optimistic: QuantityIssue = { ...issue, id: tempId, issueNumber: tempNumber };
    setQuantityIssues((prev) => [optimistic, ...prev]);

    const uomRaw = issue.uom || 'JAR';
    const uomBackend = uomRaw.toUpperCase() === 'POCKET' ? 'PACKET' : uomRaw.toUpperCase();

    IssueStockService.createIssueStock({
      recipientType: issue.personRole,
      salesmanId: issue.personRole === 'SALESMAN' ? issue.personId : undefined,
      dealerId: issue.personRole === 'DEALER' ? issue.personId : undefined,
      issueDate: issue.date,
      items: [{
        productId: issue.productId,
        quantity: issue.quantityIssued,
        uom: uomBackend as any,
      }],
    })
      .then(() => refreshAll())
      .catch((err) => {
        setQuantityIssues((prev) => prev.filter((i) => i.id !== tempId));
        console.error('Failed to issue stock:', err.message);
      });

    return optimistic;
  };

  const addHandover = (h: Omit<DailyHandover, 'id' | 'handoverNumber' | 'createdAt'>): DailyHandover => {
    const tempNumber = `HND-${Date.now().toString().slice(-6)}`;
    const tempId = `hnd-temp-${Date.now()}`;
    const optimistic: DailyHandover = { ...h, id: tempId, handoverNumber: tempNumber, createdAt: new Date().toISOString() };
    setHandovers((prev) => [optimistic, ...prev]);

    DailyHandoverService.createDailyHandover({
      recipientType: h.type,
      salesmanId: h.type === 'SALESMAN' ? h.personId : undefined,
      dealerId: h.type === 'DEALER' ? h.personId : undefined,
      handoverDate: h.date,
      customerName: h.customerName,
      customerPhone: h.customerPhone,
      notes: h.notes,
      items: h.items.map((it) => ({
        productId: it.productId,
        uom: (it.uom || 'JAR').toUpperCase(),
        openingQuantity: it.opening,
        closingQuantity: it.closing,
        freeQuantity: it.free,
        discount: it.discount,
      })),
      emptyPackets: h.emptyPocketAmount > 0 ? [{ quantity: h.emptyPocketsCollected || 1, actualAmount: h.emptyPocketAmount }] : [],
      coupons: (h.couponDenominations || []).map((c) => ({
        denomination: c.denomination,
        quantity: c.quantity,
      })),
      collection: (h.amountReceived !== undefined && h.amountReceived > 0)
        ? {
            cashCollected: h.cashReceived || h.amountReceived,
            gpayCollected: h.gpayReceived || 0,
          }
        : undefined,
    })
      .then((created) => {
        if (h.type === 'SALESMAN' && h.status === 'SUBMITTED') {
          // Submit draft immediately if salesman submitted
          DailyHandoverService.submitDailyHandover(created.id).finally(() => refreshAll());
        } else {
          refreshAll();
        }
      })
      .catch((err) => {
        setHandovers((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return optimistic;
  };

  const confirmHandoverCollection = (
    handoverId: string,
    collection: {
      cashReceived: number;
      gpayReceived: number;
      notes?: string;
      adminName?: string;
    }
  ): DailyHandover | null => {
    const existing = handovers.find((h) => h.id === handoverId);
    if (!existing) return null;

    DailyHandoverService.recordCollection(handoverId, {
      cashCollected: collection.cashReceived,
      gpayCollected: collection.gpayReceived,
      notes: collection.notes,
    })
      .then(() => refreshAll())
      .catch((err) => setError(err.message));

    const total = collection.cashReceived + collection.gpayReceived;
    const diff = existing.expectedHandover - total;
    const updated: DailyHandover = {
      ...existing,
      cashReceived: collection.cashReceived,
      gpayReceived: collection.gpayReceived,
      amountReceived: total,
      difference: diff,
      outstanding: Math.max(0, diff),
      excess: Math.max(0, -diff),
      status: diff > 0 ? 'SHORT' : (diff < 0 ? 'EXCESS' : 'SETTLED'),
    };

    setHandovers((prev) => prev.map((h) => (h.id === handoverId ? updated : h)));
    return updated;
  };

  const deleteHandover = (id: string) => {
    setHandovers((prev) => prev.filter((h) => h.id !== id));
    DailyHandoverService.deleteDailyHandover(id)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete handover:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const recordOutstandingPayment = (
    outstandingId: string,
    amount: number,
    notes?: string,
    _recordedBy?: string
  ) => {
    const out = outstandings.find((o) => o.id === outstandingId);
    if (!out) return;

    if (out.personRole === 'SALESMAN') {
      SalesmanLedgerService.createTransaction({
        salesmanId: out.personId,
        transactionDate: new Date().toISOString().split('T')[0],
        type: 'RECOVERY',
        direction: 'CREDIT',
        amount,
        notes: notes || `Direct recovery for handover ${out.handoverNumber}`,
      })
        .then(() => refreshAll())
        .catch((err) => setError(err.message));
    } else {
      if (out.handoverId) {
        DailyHandoverService.recordCollection(out.handoverId, {
          cashCollected: amount,
          gpayCollected: 0,
          notes,
        })
          .then(() => refreshAll())
          .catch((err) => setError(err.message));
      }
    }
  };

  const addExpense = (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>): ExpenseRecord => {
    const tempId = `exp-temp-${Date.now()}`;
    const optimistic: ExpenseRecord = { ...expense, id: tempId, createdAt: new Date().toISOString() };
    setExpenses((prev) => [optimistic, ...prev]);

    ExpensesService.createExpense({
      expenseDate: expense.date,
      category: expense.category.toUpperCase() as any,
      amount: expense.amount,
      notes: expense.notes || expense.description || 'Expense',
    })
      .then(() => refreshAll())
      .catch((err) => {
        setExpenses((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return optimistic;
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((i) => i.id !== id));
    ExpensesService.deleteExpense(id)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete expense:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const markAttendance = (record: Omit<AttendanceRecord, 'id' | 'createdAt'>): { record?: AttendanceRecord; error?: string } => {
    const tempId = `att-temp-${Date.now()}`;
    const optimistic: AttendanceRecord = { ...record, id: tempId, createdAt: new Date().toISOString() };
    setAttendance((prev) => [optimistic, ...prev]);

    AttendanceService.markAttendance({
      salesmanId: record.personId,
      attendanceDate: record.date,
      status: record.status,
      notes: record.notes,
    })
      .then(() => refreshAll())
      .catch((err) => {
        setAttendance((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return { record: optimistic };
  };

  const bulkMarkAttendance = (
    date: string,
    records: Array<{ personId: string; personName: string; personRole: string; status: AttendanceStatus; notes?: string }>
  ) => {
    records.forEach((r) => {
      markAttendance({
        date,
        personId: r.personId,
        personName: r.personName,
        personRole: r.personRole,
        status: r.status,
        notes: r.notes,
      });
    });
  };

  const updateAttendance = (record: AttendanceRecord) => {
    setAttendance((prev) => prev.map((a) => (a.id === record.id ? record : a)));
  };

  const deleteAttendance = (id: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    AttendanceService.deleteAttendance(id)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete attendance:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const addLedgerEntry = (entry: Omit<SalesmanLedgerEntry, 'id' | 'createdAt' | 'runningBalance'>): SalesmanLedgerEntry => {
    const tempId = `led-temp-${Date.now()}`;
    const optimistic: SalesmanLedgerEntry = { ...entry, id: tempId, runningBalance: 0, createdAt: new Date().toISOString() };
    setSalesmanLedger((prev) => [optimistic, ...prev]);

    SalesmanLedgerService.createTransaction({
      salesmanId: entry.salesmanId,
      transactionDate: entry.date,
      type: (entry.type === 'HANDOVER_SHORTAGE' ? 'HANDOVER_SHORT' : entry.type) as any,
      direction: entry.debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: entry.debit > 0 ? entry.debit : entry.credit,
      notes: entry.notes || entry.description,
    })
      .then(() => refreshAll())
      .catch((err) => {
        setSalesmanLedger((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return optimistic;
  };

  const getSalesmanLedgerBalance = (salesmanId: string): number => {
    const smEntries = salesmanLedger.filter((e) => e.salesmanId === salesmanId);
    const debits = smEntries.reduce((s, e) => s + (e.debit || 0), 0);
    const credits = smEntries.reduce((s, e) => s + (e.credit || 0), 0);
    return Math.max(0, debits - credits);
  };

  const addAdvance = (advance: Omit<AdvanceRecord, 'id' | 'advanceNumber' | 'createdAt'>): AdvanceRecord => {
    const tempId = `adv-temp-${Date.now()}`;
    const optimistic: AdvanceRecord = { ...advance, id: tempId, advanceNumber: `ADV-${Date.now()}`, createdAt: new Date().toISOString() };
    setAdvances((prev) => [optimistic, ...prev]);

    SalesmanLedgerService.createTransaction({
      salesmanId: advance.salesmanId,
      transactionDate: advance.date,
      type: 'ADVANCE',
      direction: 'DEBIT',
      amount: advance.amount,
      notes: advance.notes || advance.reason,
    })
      .then(() => refreshAll())
      .catch((err) => {
        setAdvances((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return optimistic;
  };

  const addSalaryRecord = (salary: Omit<SalaryRecord, 'id' | 'createdAt'>): { record?: SalaryRecord; error?: string } => {
    const tempId = `sal-temp-${Date.now()}`;
    const optimistic: SalaryRecord = { ...salary, id: tempId, createdAt: new Date().toISOString() };
    setSalaries((prev) => [optimistic, ...prev]);

    // Backend calculates net = baseSalary - salaryRecovery.
    // When LOP deduction is provided, baseSalary sent to backend reflects effective base.
    const effectiveBaseSalary = Math.max(1, Number(salary.baseSalary) - Number(salary.lopDeduction || 0));

    SalaryService.createSalary({
      salesmanId: salary.personId,
      salaryMonth: salary.month,
      baseSalary: effectiveBaseSalary,
    })
      .then(() => refreshAll())
      .catch((err) => {
        setSalaries((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return { record: optimistic };
  };

  const updateSalaryRecord = (salary: SalaryRecord) => {
    setSalaries((prev) => prev.map((s) => (s.id === salary.id ? salary : s)));
  };

  const addInitialStock = (stock: Omit<InitialStockRecord, 'id' | 'createdAt'>): { record?: InitialStockRecord; error?: string } => {
    const tempId = `ini-temp-${Date.now()}`;
    const optimistic: InitialStockRecord = { ...stock, id: tempId, createdAt: new Date().toISOString() };
    setInitialStocks((prev) => [optimistic, ...prev]);

    // Optimistically update movements in state immediately so React updates Live Stock on Hand instantly without refresh!
    const product = products.find((p) => p.id === stock.productId);
    const baseQty = product ? toBaseQuantity(product, stock.quantity, stock.uom).baseQuantity : stock.quantity;
    const optimisticMovement: InventoryMovement = {
      id: `mov-init-${Date.now()}-${stock.productId}`,
      date: stock.date || new Date().toISOString().split('T')[0],
      productId: stock.productId,
      productName: stock.productName || product?.name || '',
      transactionType: 'OPENING_STOCK',
      reference: 'INIT_STOCK',
      displayQuantity: stock.quantity,
      displayUOM: stock.uom || (product?.category === 'Candy' ? 'Jar' : 'Packet'),
      baseQuantity: baseQty,
      runningStockBase: baseQty,
      notes: stock.notes || 'Baseline Opening Stock',
      createdAt: new Date().toISOString(),
    };
    setInventoryMovements((prev) => [optimisticMovement, ...prev.filter((m) => m.productId !== stock.productId)]);

    InventoryService.setInitialStock(stock.productId, {
      quantity: stock.quantity,
      uom: (stock.uom || 'JAR').toUpperCase(),
    })
      .then(() => refreshAll())
      .catch((err) => {
        setInitialStocks((prev) => prev.filter((i) => i.id !== tempId));
        setInventoryMovements((prev) => prev.filter((m) => m.id !== optimisticMovement.id));
        setError(err.message);
      });

    return { record: optimistic };
  };

  const addInventoryMovement = (movement: Omit<InventoryMovement, 'id' | 'createdAt' | 'runningStockBase'>): InventoryMovement => {
    const currentBaseStock = getProductStockBase(movement.productId);
    const runningStockBase = currentBaseStock + (movement.baseQuantity || 0);
    const newMovement: InventoryMovement = {
      ...movement,
      id: `mov-${Date.now()}`,
      runningStockBase,
      createdAt: new Date().toISOString(),
    };
    setInventoryMovements((prev) => [newMovement, ...prev]);
    return newMovement;
  };

  const getProductStockBase = (productId: string): number => {
    const prodMovements = inventoryMovements.filter((m) => m.productId === productId);
    if (prodMovements.length > 0) {
      return prodMovements.reduce((sum, m) => sum + (m.baseQuantity || 0), 0);
    }
    const init = initialStocks.find((s) => s.productId === productId);
    if (init) {
      const prod = products.find((p) => p.id === productId);
      return prod ? toBaseQuantity(prod, init.quantity, init.uom).baseQuantity : init.quantity;
    }
    return 0;
  };

  const addSalesTarget = (target: Omit<SalesTarget, 'id' | 'createdAt'>): SalesTarget => {
    const tempId = `tgt-temp-${Date.now()}`;
    const effectiveDate = (!target.date || target.date === 'Daily (Fixed)' || isNaN(Date.parse(target.date)))
      ? new Date().toISOString().split('T')[0]
      : target.date.split('T')[0];

    const optimistic: SalesTarget = {
      ...target,
      date: effectiveDate,
      id: tempId,
      period: target.period || 'DAILY',
      targetType: target.targetType || 'VALUE',
      createdAt: new Date().toISOString(),
    };
    setSalesTargets((prev) => [optimistic, ...prev]);

    SalesTargetService.createSalesTarget({
      salesmanId: target.salesmanId,
      targetDate: effectiveDate,
      dailyRevenueTarget: target.targetValue || 0,
      productTargets: (target.productTargets || []).map((pt) => {
        const prod = products.find((p) => p.id === pt.productId);
        const uomRaw = prod?.uom || 'JAR';
        const uomBackend = uomRaw.toUpperCase() === 'POCKET' ? 'PACKET' : uomRaw.toUpperCase();
        return {
          productId: pt.productId,
          targetQuantity: pt.targetQuantity,
          uom: uomBackend as any,
        };
      }),
    })
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Error creating sales target:', err);
        setSalesTargets((prev) => prev.filter((i) => i.id !== tempId));
        setError(err.message);
      });

    return optimistic;
  };

  const updateSalesTarget = (target: SalesTarget) => {
    setSalesTargets((prev) => prev.map((t) => (t.id === target.id ? target : t)));
    const effectiveDate = (!target.date || target.date === 'Daily (Fixed)' || isNaN(Date.parse(target.date)))
      ? new Date().toISOString().split('T')[0]
      : target.date.split('T')[0];

    const prodTargets = (target.productTargets || []).map((pt) => {
      const prod = products.find((p) => p.id === pt.productId);
      const uomRaw = prod?.uom || 'JAR';
      const uomBackend = uomRaw.toUpperCase() === 'POCKET' ? 'PACKET' : uomRaw.toUpperCase();
      return {
        productId: pt.productId,
        targetQuantity: pt.targetQuantity,
        uom: uomBackend as any,
      };
    });

    if (target.id.startsWith('tgt-temp-')) {
      SalesTargetService.createSalesTarget({
        salesmanId: target.salesmanId,
        targetDate: effectiveDate,
        dailyRevenueTarget: target.targetValue || 0,
        productTargets: prodTargets,
      })
        .then(() => refreshAll())
        .catch((err) => setError(err.message));
    } else {
      SalesTargetService.updateSalesTarget(target.id, {
        dailyRevenueTarget: target.targetValue,
        targetDate: effectiveDate,
        productTargets: prodTargets,
      })
        .then(() => refreshAll())
        .catch((err) => setError(err.message));
    }
  };

  const deleteSalesTarget = (id: string) => {
    setSalesTargets((prev) => prev.filter((t) => t.id !== id));
    SalesTargetService.deleteSalesTarget(id)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete sales target:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, 'id' | 'poNumber'>): PurchaseOrder => {
    const newPo: PurchaseOrder = {
      ...po,
      id: `po-${Date.now()}`,
      poNumber: `PO-${Date.now().toString().slice(-4)}`,
    };
    setPurchaseOrders((prev) => [newPo, ...prev]);
    return newPo;
  };

  const updatePurchaseOrderStatus = (id: string, status: 'PENDING' | 'RECEIVED' | 'PARTIAL') => {
    setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const addStockIn = (stockIn: Omit<StockInRecord, 'id' | 'stockInNumber'>): StockInRecord => {
    const newStockIn: StockInRecord = {
      ...stockIn,
      id: `stk-${Date.now()}`,
      stockInNumber: `STK-${Date.now().toString().slice(-4)}`,
    };
    setStockIns((prev) => [newStockIn, ...prev]);
    return newStockIn;
  };

  const deleteQuantityIssue = (id: string) => {
    const target = quantityIssues.find((q) => q.id === id);
    const deleteId = target?.issueStockId || id;
    setQuantityIssues((prev) =>
      prev.filter((q) => q.id !== id && (!target?.issueStockId || q.issueStockId !== target.issueStockId))
    );
    IssueStockService.deleteIssueStock(deleteId)
      .then(() => refreshAll())
      .catch((err) => {
        console.error('Failed to delete quantity issue:', err);
        setError(err.message);
        refreshAll();
      });
  };

  const resetDemoData = () => {
    refreshAll();
  };

  return (
    <HubContext.Provider
      value={{
        isAuthenticated,
        isAuthBootstrapping,
        isLoading,
        error,
        clearError,
        login,
        logout,
        activeSession,
        setActiveSession,
        refreshAll,

        products,
        persons,
        quantityIssues,
        handovers,
        outstandings,
        expenses,
        purchaseOrders,
        stockIns,
        purchaseInvoices,
        suppliers,
        attendance,
        salesmanLedger,
        advances,
        salaries,
        initialStocks,
        inventoryMovements,
        salesTargets,

        addProduct,
        updateProduct,
        deleteProduct,
        addHandover,
        confirmHandoverCollection,
        deleteHandover,
        recordOutstandingPayment,
        addExpense,
        deleteExpense,
        addPurchaseOrder,
        updatePurchaseOrderStatus,
        addStockIn,
        addPurchaseInvoice,
        addPerson,
        updatePerson,
        deletePerson,
        addQuantityIssue,
        deleteQuantityIssue,
        markAttendance,
        bulkMarkAttendance,
        updateAttendance,
        deleteAttendance,
        addLedgerEntry,
        getSalesmanLedgerBalance,
        addAdvance,
        addSalaryRecord,
        updateSalaryRecord,
        addInitialStock,
        addInventoryMovement,
        getProductStockBase,
        addSalesTarget,
        updateSalesTarget,
        deleteSalesTarget,
        resetDemoData,
      }}
    >
      {children}
    </HubContext.Provider>
  );
};

export const useHub = (): HubContextType => {
  const context = useContext(HubContext);
  if (!context) {
    throw new Error('useHub must be used within a HubProvider');
  }
  return context;
};
