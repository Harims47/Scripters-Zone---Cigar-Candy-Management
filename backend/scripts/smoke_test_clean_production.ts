import { buildApp } from '../src/app.js';
import assert from 'node:assert';

async function smokeTest() {
  console.log('🧪 Running Post-Cleanup Production Smoke Test on Clean Database...\n');

  const app = await buildApp();
  await app.ready();

  // 1. Health check
  const healthRes = await app.inject({
    method: 'GET',
    url: '/api/v1/health',
  });
  assert.strictEqual(healthRes.statusCode, 200, 'Health check must return 200');
  console.log('  ✔ 1. API Health Check: PASS (200 OK)');

  // 2. Admin Login
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    },
  });
  assert.strictEqual(loginRes.statusCode, 200, 'Admin login must return 200');
  const loginBody = JSON.parse(loginRes.body);
  assert.strictEqual(loginBody.success, true, 'Login response must be success');
  assert.strictEqual(loginBody.data.user.role, 'ADMIN', 'User role must be ADMIN');
  const token = loginBody.data.accessToken;
  assert(token, 'Access token must be returned');
  console.log('  ✔ 2. Admin Login Authentication: PASS (Role=ADMIN)');

  const headers = { authorization: `Bearer ${token}` };

  // 3. /auth/me check
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers,
  });
  assert.strictEqual(meRes.statusCode, 200);
  const meBody = JSON.parse(meRes.body);
  const meUser = meBody.data?.user || meBody.data;
  assert.strictEqual(meUser.username, 'admin');
  console.log('  ✔ 3. /auth/me Verification: PASS (admin)');

  // 4. Products Endpoint
  const prodsRes = await app.inject({ method: 'GET', url: '/api/v1/products', headers });
  assert.strictEqual(prodsRes.statusCode, 200);
  const prods = JSON.parse(prodsRes.body).data?.products || JSON.parse(prodsRes.body).data;
  assert(Array.isArray(prods) && prods.length === 0, `Products must be empty (got ${prods?.length})`);
  console.log('  ✔ 4. Master Products Catalog: PASS (0 products)');

  // 5. Dealers Endpoint
  const dealersRes = await app.inject({ method: 'GET', url: '/api/v1/dealers', headers });
  assert.strictEqual(dealersRes.statusCode, 200);
  const dealers = JSON.parse(dealersRes.body).data?.dealers || JSON.parse(dealersRes.body).data;
  assert(Array.isArray(dealers) && dealers.length === 0, `Dealers must be empty (got ${dealers?.length})`);
  console.log('  ✔ 5. Dealers Master: PASS (0 dealers)');

  // 6. Suppliers Endpoint
  const suppliersRes = await app.inject({ method: 'GET', url: '/api/v1/suppliers', headers });
  assert.strictEqual(suppliersRes.statusCode, 200);
  const suppliers = JSON.parse(suppliersRes.body).data?.suppliers || JSON.parse(suppliersRes.body).data;
  assert(Array.isArray(suppliers) && suppliers.length === 0, `Suppliers must be empty (got ${suppliers?.length})`);
  console.log('  ✔ 6. Suppliers Master: PASS (0 suppliers)');

  // 7. Salesmen Endpoint
  const salesmenRes = await app.inject({ method: 'GET', url: '/api/v1/persons?type=SALESMAN', headers });
  assert.strictEqual(salesmenRes.statusCode, 200);
  const salesmen = JSON.parse(salesmenRes.body).data?.persons || JSON.parse(salesmenRes.body).data;
  assert(Array.isArray(salesmen) && salesmen.length === 0, `Salesmen must be empty (got ${salesmen?.length})`);
  console.log('  ✔ 7. Salesmen Master: PASS (0 salesmen)');

  // 8. Inventory Stock
  const stockRes = await app.inject({ method: 'GET', url: '/api/v1/inventory/stock', headers });
  assert.strictEqual(stockRes.statusCode, 200);
  const stock = JSON.parse(stockRes.body).data?.stock || JSON.parse(stockRes.body).data;
  assert(Array.isArray(stock) && stock.length === 0, `Inventory stock must be empty (got ${stock?.length})`);
  console.log('  ✔ 8. Inventory Stock: PASS (0 stock items)');

  // 9. Purchase Invoices
  const invRes = await app.inject({ method: 'GET', url: '/api/v1/purchase-invoices', headers });
  assert.strictEqual(invRes.statusCode, 200);
  const invoices = JSON.parse(invRes.body).data?.invoices || JSON.parse(invRes.body).data;
  assert(Array.isArray(invoices) && invoices.length === 0, `Invoices must be empty (got ${invoices?.length})`);
  console.log('  ✔ 9. Purchase Invoices: PASS (0 invoices)');

  // 10. Sales Targets
  const targetsRes = await app.inject({ method: 'GET', url: '/api/v1/sales-targets', headers });
  assert.strictEqual(targetsRes.statusCode, 200);
  const targets = JSON.parse(targetsRes.body).data?.salesTargets || JSON.parse(targetsRes.body).data;
  assert(Array.isArray(targets) && targets.length === 0, `Sales targets must be empty (got ${targets?.length})`);
  console.log('  ✔ 10. Sales Targets: PASS (0 targets)');

  // 11. Issue Stock
  const issuesRes = await app.inject({ method: 'GET', url: '/api/v1/issue-stock', headers });
  assert.strictEqual(issuesRes.statusCode, 200);
  const issues = JSON.parse(issuesRes.body).data?.issues || JSON.parse(issuesRes.body).data;
  assert(Array.isArray(issues) && issues.length === 0, `Issue stocks must be empty (got ${issues?.length})`);
  console.log('  ✔ 11. Issue Stock: PASS (0 issues)');

  // 12. Daily Handovers
  const handoversRes = await app.inject({ method: 'GET', url: '/api/v1/daily-handovers', headers });
  assert.strictEqual(handoversRes.statusCode, 200);
  const handovers = JSON.parse(handoversRes.body).data?.handovers || JSON.parse(handoversRes.body).data;
  assert(Array.isArray(handovers) && handovers.length === 0, `Handovers must be empty (got ${handovers?.length})`);
  console.log('  ✔ 12. Daily Handovers: PASS (0 handovers)');

  // 13. Salesman Ledger
  const ledgerRes = await app.inject({ method: 'GET', url: '/api/v1/salesman-ledger', headers });
  assert.strictEqual(ledgerRes.statusCode, 200);
  const ledgerTxs = JSON.parse(ledgerRes.body).data?.transactions || [];
  assert(Array.isArray(ledgerTxs) && ledgerTxs.length === 0, `Ledger txs must be empty (got ${ledgerTxs?.length})`);
  console.log('  ✔ 13. Salesman Ledger: PASS (0 transactions)');

  // 14. Expenses
  const expensesRes = await app.inject({ method: 'GET', url: '/api/v1/expenses', headers });
  assert.strictEqual(expensesRes.statusCode, 200);
  const expenses = JSON.parse(expensesRes.body).data?.expenses || JSON.parse(expensesRes.body).data;
  assert(Array.isArray(expenses) && expenses.length === 0, `Expenses must be empty (got ${expenses?.length})`);
  console.log('  ✔ 14. Operating Expenses: PASS (0 expenses)');

  // 15. Attendance
  const attRes = await app.inject({ method: 'GET', url: '/api/v1/attendance', headers });
  assert.strictEqual(attRes.statusCode, 200);
  const attendances = JSON.parse(attRes.body).data?.attendances || JSON.parse(attRes.body).data;
  assert(Array.isArray(attendances) && attendances.length === 0, `Attendance must be empty (got ${attendances?.length})`);
  console.log('  ✔ 15. Attendance: PASS (0 attendances)');

  // 16. Salary
  const salRes = await app.inject({ method: 'GET', url: '/api/v1/salaries', headers });
  assert.strictEqual(salRes.statusCode, 200);
  const salaries = JSON.parse(salRes.body).data?.salaries || JSON.parse(salRes.body).data;
  assert(Array.isArray(salaries) && salaries.length === 0, `Salaries must be empty (got ${salaries?.length})`);
  console.log('  ✔ 16. Salaries: PASS (0 salaries)');

  // 17. Admin Dashboard
  const dashRes = await app.inject({ method: 'GET', url: '/api/v1/dashboard/admin', headers });
  assert.strictEqual(dashRes.statusCode, 200);
  const dashData = JSON.parse(dashRes.body).data;
  assert.strictEqual(dashData.salesSummary?.grossSales || 0, 0, 'Dashboard gross sales must be 0');
  assert.strictEqual(dashData.salesSummary?.netSales || 0, 0, 'Dashboard net sales must be 0');
  assert.strictEqual(dashData.cumulativeItemsSold?.totalNetValue || 0, 0, 'Cumulative items sold must be 0');
  console.log('  ✔ 17. Admin Dashboard KPIs: PASS (all metrics naturally 0)');

  // 18. Sales Ledger Summary
  const sLedgerRes = await app.inject({ method: 'GET', url: '/api/v1/sales-ledger/summary', headers });
  assert.strictEqual(sLedgerRes.statusCode, 200);
  const sLedger = JSON.parse(sLedgerRes.body).data;
  assert.strictEqual(sLedger.totalGrossSales, 0, 'Gross sales must be 0');
  assert.strictEqual(sLedger.totalNetSales, 0, 'Net sales must be 0');
  console.log('  ✔ 18. Sales Ledger Summary: PASS (Gross=₹0, Net=₹0)');

  // 19. Management P&L
  const pnlRes = await app.inject({
    method: 'GET',
    url: '/api/v1/reports/pnl?fromDate=2026-01-01&toDate=2026-12-31',
    headers,
  });
  assert.strictEqual(pnlRes.statusCode, 200);
  const pnl = JSON.parse(pnlRes.body).data;
  assert.strictEqual(pnl.netRevenue, 0, 'Net revenue must be 0');
  assert.strictEqual(pnl.grossProfit, 0, 'Gross profit must be 0');
  assert.strictEqual(pnl.operatingExpenses?.total || 0, 0, 'OpEx must be 0');
  console.log('  ✔ 19. Management P&L: PASS (Net Revenue=₹0, Gross Profit=₹0, OpEx=₹0)');

  console.log('\n============================================================');
  console.log('🎉 ALL 19 SMOKE TESTS PASSED ON CLEAN PRODUCTION DATABASE!');
  console.log('============================================================');

  await app.close();
}

smokeTest()
  .catch((e) => {
    console.error('Smoke test failed:', e);
    process.exit(1);
  });
