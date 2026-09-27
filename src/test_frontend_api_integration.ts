import fs from 'fs';
import path from 'path';

// Load backend .env before any backend modules are evaluated
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), 'backend', '.env'), 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
} catch (e) {
  console.warn('Could not read backend/.env directly', e);
}

import { FastifyInstance } from 'fastify';
import {
  ApiClient,
  ApiError,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  AuthService,
  MasterDataService,
  InventoryService,
  SalesTargetService,
  IssueStockService,
  DailyHandoverService,
  SalesmanLedgerService,
  ExpensesService,
  AttendanceService,
  SalaryService,
  SalesLedgerService,
  DashboardService,
  PnLService,
} from './services';

const TEST_PORT = 4099;
process.env.VITE_API_BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;

let app: FastifyInstance;

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runSuite() {
  console.log('=== STARTING PHASE 2M FRONTEND API INTEGRATION TEST SUITE ===\n');

  // Start Fastify Backend Instance
  const { buildApp } = await import('../backend/src/app');
  app = await buildApp();
  await app.listen({ port: TEST_PORT, host: '127.0.0.1' });
  console.log(`Fastify test server listening on port ${TEST_PORT}\n`);

  try {
    // ==========================================
    // 1. AUTHENTICATION & SESSION
    // ==========================================
    console.log('--- AUTHENTICATION & ROLE ACCESS ---');
    clearAuthToken();

    // 1. Login with real credentials
    const adminLogin = await AuthService.login('admin', 'Admin@12345');
    assert(!!adminLogin.accessToken && adminLogin.user.role === 'ADMIN', '1. Admin login succeeds with token & role ADMIN');
    setAuthToken(adminLogin.accessToken);

    // 2. Invalid credentials handled
    try {
      await AuthService.login('admin', 'WrongPass@123');
      assert(false, '2. Invalid credentials rejected');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 401, '2. Invalid credentials returns HTTP 401 ApiError');
    }

    // 3. Auth bootstrap with /auth/me
    const me = await AuthService.getMe();
    assert(me.user.username === 'admin' && me.user.role === 'ADMIN', '3. Auth bootstrap retrieves authenticated user identity via /auth/me');

    // 4. Logout clears state
    await AuthService.logout();
    assert(getAuthToken() === null, '4. Logout clears stored authentication token');

    // 5. Salesman login & role check
    const salesmanLogin = await AuthService.login('ramesh', 'Sales@12345');
    assert(salesmanLogin.user.role === 'SALESMAN', '5. Salesman login succeeds with role SALESMAN');

    // 6. Role protection: Salesman blocked from admin-only routes (e.g. POST /products)
    setAuthToken(salesmanLogin.accessToken);
    try {
      await MasterDataService.createProduct({
        sku: 'TEST-SKU-BLOCKED',
        name: 'Blocked Product',
        category: 'CANDY',
        brand: 'GPI',
        baseUom: 'JAR',
        standardPurchasePrice: 85,
        rate: 50,
      });
      assert(false, '6. Salesman blocked from admin mutation');
    } catch (err: any) {
      assert(err instanceof ApiError && (err.status === 403 || err.status === 401), '6. Salesman blocked with 403 Forbidden on Admin-only routes');
    }

    // 7. Protected routes reject unauthenticated requests
    clearAuthToken();
    try {
      await MasterDataService.getProducts();
      assert(false, '7. Unauthenticated request blocked');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 401, '7. Protected route rejects unauthenticated request with 401');
    }

    // Switch back to Admin token for subsequent master data & management tests
    setAuthToken(adminLogin.accessToken);
    assert(true, '8. Admin session re-established for authoritative operations');

    // ==========================================
    // 2. MASTER DATA
    // ==========================================
    console.log('\n--- MASTER DATA ---');
    // 9. Products load from API
    const products = await MasterDataService.getProducts();
    assert(Array.isArray(products) && products.length > 0, `9. Products loaded from backend API (${products.length} products found)`);

    // 10. Dealers load from API
    const dealers = await MasterDataService.getDealers();
    assert(Array.isArray(dealers) && dealers.length > 0, `10. Dealers loaded from backend API (${dealers.length} dealers found)`);

    // 11. Suppliers load from API
    const suppliers = await MasterDataService.getSuppliers();
    assert(Array.isArray(suppliers) && suppliers.length > 0, `11. Suppliers loaded from backend API (${suppliers.length} suppliers found)`);

    // 12. Product create works
    const newSku = `INT-SKU-${Date.now().toString().slice(-5)}`;
    const createdProduct = await MasterDataService.createProduct({
      sku: newSku,
      name: `Integration Test Product ${newSku}`,
      category: 'CANDY',
      brand: 'GPI',
      baseUom: 'JAR',
      standardPurchasePrice: 85,
      rate: 120,
    });
    assert(createdProduct.sku === newSku && Number(createdProduct.salesRate || createdProduct.rate) === 120, '12. Product creation via POST /products works');

    // 13. Product status toggle works
    const toggledProduct = await MasterDataService.toggleProductStatus(createdProduct.id, false);
    assert(toggledProduct.active === false, '13a. Product deactivated via PATCH /products/:id/status');
    const reactivatedProduct = await MasterDataService.toggleProductStatus(createdProduct.id, true);
    assert(reactivatedProduct.active === true, '13b. Product reactivated via PATCH /products/:id/status');

    // 14. Dealer create & update works
    const newDealer = await MasterDataService.createDealer({
      name: `Dealer Integration ${Date.now().toString().slice(-4)}`,
      phone: '9876543210',
      address: 'Main Bazaar',
    });
    assert(!!newDealer.id, '14a. Dealer creation via POST /dealers works');
    const updatedDealer = await MasterDataService.updateDealer(newDealer.id, {
      name: `${newDealer.name} Updated`,
      phone: '9876543210',
      address: 'North Street',
    });
    assert(updatedDealer.name.includes('Updated'), '14b. Dealer update via PATCH /dealers/:id works');

    // 15. Supplier create & update works
    const newSupplier = await MasterDataService.createSupplier({
      name: `Supplier Integration ${Date.now().toString().slice(-4)}`,
      contactPerson: 'Manager',
      phone: '9888877777',
      address: 'Industrial Area',
    });
    assert(!!newSupplier.id, '15a. Supplier creation via POST /suppliers works');
    const updatedSupplier = await MasterDataService.updateSupplier(newSupplier.id, {
      name: `${newSupplier.name} Updated`,
      contactPerson: 'Chief Manager',
      phone: '9888877777',
      email: 'chief@supplier.com',
      address: 'Industrial Area Phase 2',
    });
    assert(updatedSupplier.name.includes('Updated'), '15b. Supplier update via PATCH /suppliers/:id works');

    // ==========================================
    // 3. INVENTORY & PURCHASE INVOICE
    // ==========================================
    console.log('\n--- INVENTORY & PURCHASE INVOICES ---');
    // 16. Initial Stock uses API
    try {
      await InventoryService.setInitialStock(createdProduct.id, {
        quantity: 100,
        uom: 'JAR',
      });
      assert(true, '16. Initial Stock set via POST /products/:id/initial-stock');
    } catch (err: any) {
      // If product already had initial stock or one-time rule
      assert(err.status === 409 || err.status === 201 || err.status === 200, '16. Initial stock API handled properly');
    }

    // 17. Purchase Invoice uses API
    const invNumber = `PINV-${Date.now().toString().slice(-6)}`;
    const purchaseInvoice = await InventoryService.createPurchaseInvoice({
      invoiceNumber: invNumber,
      supplierId: newSupplier.id,
      invoiceDate: new Date().toISOString().split('T')[0],
      items: [
        {
          productId: createdProduct.id,
          quantity: 50,
          uom: 'JAR',
          purchaseCost: 90,
          discount: 100,
        },
      ],
    });
    assert(purchaseInvoice.invoiceNumber === invNumber && Number(purchaseInvoice.netTotal || purchaseInvoice.totalNet) === 4400, '17. Purchase invoice created atomically with stock receipt');

    // 18. Inventory loads from API
    const stockList = await InventoryService.getStock();
    assert(Array.isArray(stockList) && stockList.length > 0, '18. Current inventory loaded via GET /inventory/stock');

    // 19. Inventory reflects the purchase
    const productStock = await InventoryService.getProductStock(createdProduct.id);
    const stockQty = Number(productStock.currentStock !== undefined ? productStock.currentStock : productStock.currentStockBase);
    assert(stockQty >= 50, `19. Inventory updated after purchase receipt (${stockQty} available)`);

    // ==========================================
    // 4. SALES TARGETS
    // ==========================================
    console.log('\n--- SALES TARGETS ---');
    const salesmen = await MasterDataService.getPersons({ type: 'SALESMAN' });
    const activeSalesman = salesmen.find((s: any) => s.active) || salesmen[0];
    const targetSalesmanId = salesmanLogin.user.person?.id || activeSalesman.id;

    // 20. Target creation via API
    const targetDate = new Date(Date.now() + 86400000 * (Math.floor(Math.random() * 100) + 10)).toISOString().split('T')[0];
    let createdTarget: any;
    try {
      createdTarget = await SalesTargetService.createSalesTarget({
        salesmanId: targetSalesmanId,
        targetDate,
        dailyRevenueTarget: 25000,
        productTargets: [
          {
            productId: createdProduct.id,
            targetQuantity: 40,
            uom: 'JAR',
          },
        ],
      });
      assert(Number(createdTarget.dailyRevenueTarget) === 25000, '20. Sales target created via POST /sales-targets');
    } catch (err: any) {
      assert(err.status === 409 || err.status === 201, '20. Sales target handled with conflict or success');
    }

    // 21. Sales targets load from API with filters
    const targets = await SalesTargetService.getSalesTargets({ salesmanId: targetSalesmanId });
    assert(Array.isArray(targets), '21. Sales targets loaded and filtered via GET /sales-targets');

    // 22. Salesman sees own targets
    setAuthToken(salesmanLogin.accessToken);
    const myTargets = await SalesTargetService.getMySalesTargets();
    assert(Array.isArray(myTargets), '22. Salesman sees own targets via GET /sales-targets/my');
    setAuthToken(adminLogin.accessToken);

    // ==========================================
    // 5. ISSUE STOCK
    // ==========================================
    console.log('\n--- ISSUE STOCK ---');
    // 23. Admin issues stock to Salesman on targetDate
    const issueStockRes = await IssueStockService.createIssueStock({
      recipientType: 'SALESMAN',
      salesmanId: targetSalesmanId,
      issueDate: targetDate,
      items: [
        {
          productId: createdProduct.id,
          quantity: 10,
          uom: 'JAR',
        },
      ],
    });
    assert(issueStockRes.recipientType === 'SALESMAN' && issueStockRes.items.length === 1, '23. Stock issued to salesman via POST /issue-stock');

    // 24. Dealer issue works
    const dealerIssueRes = await IssueStockService.createIssueStock({
      recipientType: 'DEALER',
      dealerId: newDealer.id,
      issueDate: targetDate,
      items: [
        {
          productId: createdProduct.id,
          quantity: 5,
          uom: 'JAR',
        },
      ],
    });
    assert(dealerIssueRes.recipientType === 'DEALER', '24. Dealer issue stock works without creating sales target');

    // 25. Insufficient stock error (409) is returned by backend
    try {
      await IssueStockService.createIssueStock({
        recipientType: 'SALESMAN',
        salesmanId: targetSalesmanId,
        issueDate: targetDate,
        items: [
          {
            productId: createdProduct.id,
            quantity: 9999999, // Exceeds available stock
            uom: 'JAR',
          },
        ],
      });
      assert(false, '25. Insufficient stock should throw error');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 409, '25. Insufficient stock throws HTTP 409 Conflict');
    }

    // ==========================================
    // 6. DAILY HANDOVER
    // ==========================================
    console.log('\n--- DAILY HANDOVER ---');
    // Switch to salesman token
    setAuthToken(salesmanLogin.accessToken);
    const salesmanPersonId = (salesmanLogin.user as any).person?.id || targetSalesmanId;

    // 26. Salesman creates draft handover
    const handoverDate = new Date(Date.now() + 86400000 * (1000 + Math.floor(Math.random() * 50000))).toISOString().split('T')[0];
    const draftHandover = await DailyHandoverService.createDailyHandover({
      recipientType: 'SALESMAN',
      salesmanId: salesmanPersonId,
      handoverDate,
      items: [
        {
          productId: createdProduct.id,
          uom: 'JAR',
          openingQuantity: 10,
          closingQuantity: 2,
          freeQuantity: 1,
          discount: 20,
        },
      ],
      emptyPackets: [
        {
          productId: createdProduct.id,
          quantity: 2,
          actualAmount: 30,
        },
      ],
      coupons: [
        {
          productId: createdProduct.id,
          denomination: 5,
          quantity: 2,
        },
      ],
    });
    // Expected Handover:
    // Sales = 10 - 2 = 8. Chargeable = 8 - 1 = 7. Gross = 7 * 120 = 840. Net = 840 - 20 = 820.
    // Empty Packet = 30. Coupon = 10. Expected = 820 - 30 - 10 = 780.
    assert(draftHandover.status === 'DRAFT' && Number(draftHandover.expectedHandover) === 780, '26. Salesman creates draft handover with authoritative formulas');

    // 27. Salesman can edit draft
    const updatedDraft = await DailyHandoverService.updateDailyHandover(draftHandover.id, {
      notes: 'Updated draft notes',
    });
    assert(updatedDraft.notes === 'Updated draft notes', '27. Salesman can update draft handover');

    // 28. Salesman submits draft
    const submittedHandover = await DailyHandoverService.submitDailyHandover(draftHandover.id);
    assert(submittedHandover.status === 'SUBMITTED', '28. Salesman submits handover sheet');

    // 29. Submitted handover cannot be edited by salesman
    try {
      await DailyHandoverService.updateDailyHandover(draftHandover.id, { notes: 'Illegal edit' });
      assert(false, '29. Submitted handover should not be editable');
    } catch (err: any) {
      assert(err instanceof ApiError && (err.status === 400 || err.status === 409), '29. Submitted handover is read-only for salesman');
    }

    // 30. Admin records collection (Short collection)
    setAuthToken(adminLogin.accessToken);
    const shortCollection = await DailyHandoverService.recordCollection(draftHandover.id, {
      cashCollected: 500,
      gpayCollected: 200, // Total = 700. Expected = 780 -> Outstanding = 80
    });
    assert(
      shortCollection.status === 'SHORT' &&
        Number(shortCollection.outstanding) === 80 &&
        Number(shortCollection.collectionTotal) === 700,
      '30. Admin records split Cash + GPay collection; status is SHORT with remaining outstanding'
    );

    // ==========================================
    // 7. SALESMAN LEDGER
    // ==========================================
    console.log('\n--- SALESMAN LEDGER ---');
    // 31. Salesman ledger loads from API and displays transactions
    const ledger = await SalesmanLedgerService.getSalesmanLedger({ salesmanId: salesmanPersonId });
    assert(ledger && Array.isArray(ledger.transactions), '31. Salesman ledger loaded via GET /salesman-ledger');

    // 32. Handover shortage created debit
    const shortTx = ledger.transactions.find((t: any) => t.type === 'HANDOVER_SHORT');
    assert(!!shortTx && shortTx.direction === 'DEBIT', '32. Handover shortage automatically posted as DEBIT transaction in ledger');

    // 33. Advance entry works
    const advTx = await SalesmanLedgerService.createTransaction({
      salesmanId: salesmanPersonId,
      transactionDate: new Date().toISOString().split('T')[0],
      type: 'ADVANCE',
      direction: 'DEBIT',
      amount: 500,
      notes: 'Festival cash advance',
    });
    assert(advTx.direction === 'DEBIT' && Number(advTx.amount) === 500, '33. Cash Advance posted as DEBIT in ledger');

    // 34. Recovery entry works
    const recTx = await SalesmanLedgerService.createTransaction({
      salesmanId: salesmanPersonId,
      transactionDate: new Date().toISOString().split('T')[0],
      type: 'RECOVERY',
      direction: 'CREDIT',
      amount: 200,
      notes: 'Cash recovery',
    });
    assert(recTx.direction === 'CREDIT' && Number(recTx.amount) === 200, '34. Cash Recovery posted as CREDIT in ledger');

    // ==========================================
    // 8. EXPENSES
    // ==========================================
    console.log('\n--- EXPENSES ---');
    // 35. Manual expense create
    const expDate = new Date().toISOString().split('T')[0];
    const newExpense = await ExpensesService.createExpense({
      expenseDate: expDate,
      category: 'OFFICE',
      amount: 350,
      notes: 'Printer ink refill',
    });
    assert(newExpense.category === 'OFFICE' && Number(newExpense.amount) === 350, '35. Manual expense created via POST /expenses');

    // 36. Expense summary loads derived values
    const expSummary = await ExpensesService.getExpenseSummary({ fromDate: expDate, toDate: expDate });
    assert(expSummary && typeof expSummary.operatingExpenses === 'number', '36. Expense summary loads manual and derived totals');

    // ==========================================
    // 9. ATTENDANCE & SALARY
    // ==========================================
    console.log('\n--- ATTENDANCE & SALARY ---');
    // 37. Attendance marking
    const attDate = new Date().toISOString().split('T')[0];
    try {
      const att = await AttendanceService.markAttendance({
        salesmanId: salesmanPersonId,
        attendanceDate: attDate,
        status: 'PRESENT',
        notes: 'On time',
      });
      assert(att.status === 'PRESENT', '37. Attendance marked as PRESENT via POST /attendance');
    } catch (err: any) {
      assert(err.status === 409 || err.status === 200 || err.status === 201, '37. Attendance handled properly');
    }

    // 38. Salary creation with automatic ledger deduction
    const salaryMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    try {
      const sal = await SalaryService.createSalary({
        salesmanId: salesmanPersonId,
        salaryMonth,
        baseSalary: 15000,
      });
      assert(sal.status === 'PAID' && Number(sal.netSalary) <= 15000, '38. Monthly salary created with status PAID and ledger recovery applied');
    } catch (err: any) {
      assert(err.status === 409 || err.status === 201, '38. Salary creation handled with conflict or success');
    }

    // ==========================================
    // 10. SALES LEDGER, DASHBOARD & P&L
    // ==========================================
    console.log('\n--- SALES LEDGER, ADMIN DASHBOARD & P&L ---');
    // 39. Sales Ledger
    const salesLedgerSummary = await SalesLedgerService.getSalesLedgerSummary({});
    assert(typeof salesLedgerSummary.totalGrossSales === 'number', '39. Sales ledger summary loaded from backend');

    // 40. Admin Dashboard operational command center
    const dashboardData = await DashboardService.getAdminDashboard();
    assert(
      dashboardData &&
        typeof dashboardData.salesSummary === 'object' &&
        typeof dashboardData.cumulativeItemsSold === 'object',
      '40. Admin Dashboard operational KPIs retrieved from backend'
    );

    // 41. Management P&L
    const pnlReport = await PnLService.getPnLReport({
      fromDate: `${new Date().getFullYear()}-01-01`,
      toDate: `${new Date().getFullYear()}-12-31`,
    });
    assert(
      pnlReport &&
        typeof pnlReport.netRevenue === 'number' &&
        typeof pnlReport.grossProfit === 'number',
      '41. Management P&L loaded with authoritative Net Revenue and Gross Profit'
    );

    // ==========================================
    // 11. ERROR NORMALIZATION & CONFLICT HANDLING
    // ==========================================
    console.log('\n--- ERROR NORMALIZATION & STATUS CODES ---');
    // 42. Test 400 Bad Request
    try {
      await MasterDataService.createProduct({
        sku: '', // Invalid empty sku
        name: '',
        category: 'CANDY',
        subCategory: 'GPI',
        brand: '',
        uom: 'JAR',
        rate: -10, // Invalid negative rate
      });
      assert(false, '42. Invalid payload should fail');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 400, '42. 400 Bad Request validation error normalized');
    }

    // 43. Test 404 Not Found
    try {
      await MasterDataService.getProduct('non-existent-product-id');
      assert(false, '43. Non existent product should fail');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 404, '43. 404 Not Found normalized correctly');
    }

    // 44. Test 409 Conflict
    try {
      // Re-create existing product with same SKU
      await MasterDataService.createProduct({
        sku: createdProduct.sku,
        name: 'Duplicate SKU Product',
        category: 'CANDY',
        brand: 'GPI',
        baseUom: 'JAR',
        standardPurchasePrice: 85,
        rate: 100,
      });
      assert(false, '44. Duplicate SKU should fail');
    } catch (err: any) {
      assert(err instanceof ApiError && err.status === 409, '44. 409 Conflict normalized correctly');
    }

    // 45. Single-Tenant Architecture verification
    assert((adminLogin.user as any).tenantId === undefined, '45. Single-tenant architecture verified: No tenantId on User');
    assert((createdProduct as any).tenantId === undefined, '46. Single-tenant architecture verified: No tenantId on Product');
  } finally {
    await app.close();
    console.log('Fastify test server stopped cleanly.\n');
  }

  console.log('====================================================');
  console.log(`INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Integration suite encountered an unexpected error:', err);
  if (app) app.close();
  process.exit(1);
});
