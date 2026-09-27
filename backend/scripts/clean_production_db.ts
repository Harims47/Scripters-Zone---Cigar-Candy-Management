import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

interface EntityCounts {
  adminUsers: number;
  salesmanUsers: number;
  adminPersons: number;
  dealers: number;
  salesmenPersons: number;
  staffPersons: number;
  suppliers: number;
  products: number;
  productUomConversions: number;
  initialStocks: number;
  purchaseInvoices: number;
  purchaseInvoiceItems: number;
  stockMovements: number;
  salesTargets: number;
  salesTargetProducts: number;
  issueStocks: number;
  issueStockItems: number;
  dailyHandovers: number;
  dailyHandoverItems: number;
  dailyHandoverEmptyPackets: number;
  dailyHandoverCoupons: number;
  salesmanLedgerTransactions: number;
  expenses: number;
  salesmanAttendances: number;
  salesmanSalaries: number;
}

async function getCounts(): Promise<EntityCounts> {
  return {
    adminUsers: await prisma.user.count({ where: { role: UserRole.ADMIN } }),
    salesmanUsers: await prisma.user.count({ where: { role: UserRole.SALESMAN } }),
    adminPersons: await prisma.person.count({ where: { user: { role: UserRole.ADMIN } } }),
    dealers: await prisma.person.count({ where: { type: 'DEALER' } }),
    salesmenPersons: await prisma.person.count({ where: { type: 'SALESMAN' } }),
    staffPersons: await prisma.person.count({ where: { type: 'STAFF', user: { role: { not: UserRole.ADMIN } } } }),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    productUomConversions: await prisma.productUomConversion.count(),
    initialStocks: await prisma.initialStock.count(),
    purchaseInvoices: await prisma.purchaseInvoice.count(),
    purchaseInvoiceItems: await prisma.purchaseInvoiceItem.count(),
    stockMovements: await prisma.stockMovement.count(),
    salesTargets: await prisma.salesTarget.count(),
    salesTargetProducts: await prisma.salesTargetProduct.count(),
    issueStocks: await prisma.issueStock.count(),
    issueStockItems: await prisma.issueStockItem.count(),
    dailyHandovers: await prisma.dailyHandover.count(),
    dailyHandoverItems: await prisma.dailyHandoverItem.count(),
    dailyHandoverEmptyPackets: await prisma.dailyHandoverEmptyPacket.count(),
    dailyHandoverCoupons: await prisma.dailyHandoverCoupon.count(),
    salesmanLedgerTransactions: await prisma.salesmanLedgerTransaction.count(),
    expenses: await prisma.expense.count(),
    salesmanAttendances: await prisma.salesmanAttendance.count(),
    salesmanSalaries: await prisma.salesmanSalary.count(),
  };
}

async function cleanProductionDatabase() {
  console.log('============================================================');
  console.log('🚀 FINAL PRODUCTION DATABASE CLEANUP IN PROGRESS');
  console.log('============================================================\n');

  // 1. Identify and verify Admin account
  const adminUsers = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    include: { person: true }
  });

  if (adminUsers.length === 0) {
    throw new Error('ABORT: No Administrator user found in database! Cleanup stopped.');
  }

  if (adminUsers.length > 1) {
    console.warn(`WARNING: Found ${adminUsers.length} Admin users. Preserving primary Admin: ${adminUsers[0].username}`);
  }

  const primaryAdmin = adminUsers[0];
  const adminUserId = primaryAdmin.id;
  const adminUsername = primaryAdmin.username;
  const adminRole = primaryAdmin.role;
  const adminPersonId = primaryAdmin.personId;
  const adminPasswordHash = primaryAdmin.passwordHash;

  console.log('🛡️ Preserving Administrator Account:');
  console.log(`  - Admin User ID:    ${adminUserId}`);
  console.log(`  - Admin Username:   ${adminUsername}`);
  console.log(`  - Admin Role:       ${adminRole}`);
  console.log(`  - Linked Person ID: ${adminPersonId || 'None'}`);
  console.log(`  - Password Hash:    [SECURED - ${adminPasswordHash.length} bytes verified]\n`);

  // 2. Measure Counts Before Cleanup
  console.log('📊 Gathering database state before cleanup...');
  const countsBefore = await getCounts();

  // 3. Execute Deletion within Single Atomic Transaction
  console.log('⚡ Executing atomic cleanup transaction (child-to-parent order)...');

  const deleteStats = await prisma.$transaction(async (tx) => {
    // Phase 2I: Salesman Ledger (child of dailyHandover and person)
    const delSalesmanLedger = await tx.salesmanLedgerTransaction.deleteMany({});

    // Phase 2H: Daily Handover Children
    const delEmptyPackets = await tx.dailyHandoverEmptyPacket.deleteMany({});
    const delCoupons = await tx.dailyHandoverCoupon.deleteMany({});
    const delHandoverItems = await tx.dailyHandoverItem.deleteMany({});

    // Phase 2H: Daily Handovers
    const delHandovers = await tx.dailyHandover.deleteMany({});

    // Phase 2F: Sales Target Children & Targets
    const delTargetProducts = await tx.salesTargetProduct.deleteMany({});
    const delSalesTargets = await tx.salesTarget.deleteMany({});

    // Phase 2E & 2G: Stock Movements (references Product, PurchaseInvoice, IssueStock)
    const delStockMovements = await tx.stockMovement.deleteMany({});

    // Phase 2G: Issue Stock Items & Issue Stocks
    const delIssueStockItems = await tx.issueStockItem.deleteMany({});
    const delIssueStocks = await tx.issueStock.deleteMany({});

    // Phase 2E: Purchase Invoice Items & Purchase Invoices
    const delPurchaseInvoiceItems = await tx.purchaseInvoiceItem.deleteMany({});
    const delPurchaseInvoices = await tx.purchaseInvoice.deleteMany({});

    // Phase 2E: Suppliers
    const delSuppliers = await tx.supplier.deleteMany({});

    // Catalog & Conversions & Initial Stocks
    const delInitialStocks = await tx.initialStock.deleteMany({});
    const delUomConversions = await tx.productUomConversion.deleteMany({});
    const delProducts = await tx.product.deleteMany({});

    // Phase 2K: Salary & Attendance
    const delSalaries = await tx.salesmanSalary.deleteMany({});
    const delAttendances = await tx.salesmanAttendance.deleteMany({});

    // Phase 2J: Expenses
    const delExpenses = await tx.expense.deleteMany({});

    // Users: Delete ALL users EXCEPT Admin
    const delUsers = await tx.user.deleteMany({
      where: { id: { not: adminUserId } }
    });

    // Persons: Delete ALL persons EXCEPT Admin's linked Person
    const delPersons = adminPersonId
      ? await tx.person.deleteMany({ where: { id: { not: adminPersonId } } })
      : await tx.person.deleteMany({});

    return {
      delSalesmanLedger: delSalesmanLedger.count,
      delEmptyPackets: delEmptyPackets.count,
      delCoupons: delCoupons.count,
      delHandoverItems: delHandoverItems.count,
      delHandovers: delHandovers.count,
      delTargetProducts: delTargetProducts.count,
      delSalesTargets: delSalesTargets.count,
      delStockMovements: delStockMovements.count,
      delIssueStockItems: delIssueStockItems.count,
      delIssueStocks: delIssueStocks.count,
      delPurchaseInvoiceItems: delPurchaseInvoiceItems.count,
      delPurchaseInvoices: delPurchaseInvoices.count,
      delSuppliers: delSuppliers.count,
      delInitialStocks: delInitialStocks.count,
      delUomConversions: delUomConversions.count,
      delProducts: delProducts.count,
      delSalaries: delSalaries.count,
      delAttendances: delAttendances.count,
      delExpenses: delExpenses.count,
      delUsers: delUsers.count,
      delPersons: delPersons.count,
    };
  }, { timeout: 60000 });

  console.log('✔ Cleanup transaction committed successfully!\n');

  // 4. Verify Admin Account Survival & Integrity
  const verifiedAdmin = await prisma.user.findUnique({
    where: { id: adminUserId },
    include: { person: true }
  });

  if (!verifiedAdmin) {
    throw new Error('FATAL ERROR: Admin account was deleted! Rollback failed.');
  }

  if (verifiedAdmin.role !== UserRole.ADMIN) {
    throw new Error(`FATAL ERROR: Admin role was altered to ${verifiedAdmin.role}!`);
  }

  if (verifiedAdmin.passwordHash !== adminPasswordHash) {
    throw new Error('FATAL ERROR: Admin password hash was modified during cleanup!');
  }

  console.log('✅ Admin Account Verified Post-Cleanup:');
  console.log(`  - Admin User ID:    ${verifiedAdmin.id} (MATCH)`);
  console.log(`  - Username:         ${verifiedAdmin.username} (MATCH)`);
  console.log(`  - Role:             ${verifiedAdmin.role} (MATCH)`);
  console.log(`  - Linked Person ID: ${verifiedAdmin.personId} (MATCH)`);
  console.log(`  - Person Name:      ${verifiedAdmin.person?.name || 'None'}`);
  console.log(`  - Password Hash:    [UNCHANGED & VERIFIED]\n`);

  // 5. Gather Counts After Cleanup
  const countsAfter = await getCounts();

  // 6. Report Comparison Table
  console.log('========================================================================================');
  console.log('ENTITY RECORD COUNT VERIFICATION TABLE');
  console.log('========================================================================================');
  console.log('| Entity                     | Before | Deleted | Remaining | Expected Status           |');
  console.log('|----------------------------|-------:|--------:|----------:|:--------------------------|');

  const reportRows: Array<{ entity: string; before: number; deleted: number; after: number; expected: string }> = [
    { entity: 'ADMIN Users', before: countsBefore.adminUsers, deleted: 0, after: countsAfter.adminUsers, expected: '1 (PRESERVED)' },
    { entity: 'SALESMAN Users', before: countsBefore.salesmanUsers, deleted: deleteStats.delUsers, after: countsAfter.salesmanUsers, expected: '0 (PURGED)' },
    { entity: 'Admin Linked Person', before: countsBefore.adminPersons, deleted: 0, after: countsAfter.adminPersons, expected: '1 (PRESERVED)' },
    { entity: 'Dealers', before: countsBefore.dealers, deleted: countsBefore.dealers, after: countsAfter.dealers, expected: '0 (PURGED)' },
    { entity: 'Salesmen Persons', before: countsBefore.salesmenPersons, deleted: countsBefore.salesmenPersons, after: countsAfter.salesmenPersons, expected: '0 (PURGED)' },
    { entity: 'Non-Admin Staff Persons', before: countsBefore.staffPersons, deleted: countsBefore.staffPersons, after: countsAfter.staffPersons, expected: '0 (PURGED)' },
    { entity: 'Suppliers', before: countsBefore.suppliers, deleted: deleteStats.delSuppliers, after: countsAfter.suppliers, expected: '0 (PURGED)' },
    { entity: 'Products', before: countsBefore.products, deleted: deleteStats.delProducts, after: countsAfter.products, expected: '0 (PURGED)' },
    { entity: 'UOM Conversions', before: countsBefore.productUomConversions, deleted: deleteStats.delUomConversions, after: countsAfter.productUomConversions, expected: '0 (PURGED)' },
    { entity: 'Initial Stocks', before: countsBefore.initialStocks, deleted: deleteStats.delInitialStocks, after: countsAfter.initialStocks, expected: '0 (PURGED)' },
    { entity: 'Purchase Invoices', before: countsBefore.purchaseInvoices, deleted: deleteStats.delPurchaseInvoices, after: countsAfter.purchaseInvoices, expected: '0 (PURGED)' },
    { entity: 'Purchase Invoice Items', before: countsBefore.purchaseInvoiceItems, deleted: deleteStats.delPurchaseInvoiceItems, after: countsAfter.purchaseInvoiceItems, expected: '0 (PURGED)' },
    { entity: 'Stock Movements', before: countsBefore.stockMovements, deleted: deleteStats.delStockMovements, after: countsAfter.stockMovements, expected: '0 (PURGED)' },
    { entity: 'Sales Targets', before: countsBefore.salesTargets, deleted: deleteStats.delSalesTargets, after: countsAfter.salesTargets, expected: '0 (PURGED)' },
    { entity: 'Sales Target Products', before: countsBefore.salesTargetProducts, deleted: deleteStats.delTargetProducts, after: countsAfter.salesTargetProducts, expected: '0 (PURGED)' },
    { entity: 'Issue Stocks', before: countsBefore.issueStocks, deleted: deleteStats.delIssueStocks, after: countsAfter.issueStocks, expected: '0 (PURGED)' },
    { entity: 'Issue Stock Items', before: countsBefore.issueStockItems, deleted: deleteStats.delIssueStockItems, after: countsAfter.issueStockItems, expected: '0 (PURGED)' },
    { entity: 'Daily Handovers', before: countsBefore.dailyHandovers, deleted: deleteStats.delHandovers, after: countsAfter.dailyHandovers, expected: '0 (PURGED)' },
    { entity: 'Handover Items', before: countsBefore.dailyHandoverItems, deleted: deleteStats.delHandoverItems, after: countsAfter.dailyHandoverItems, expected: '0 (PURGED)' },
    { entity: 'Empty Packet Records', before: countsBefore.dailyHandoverEmptyPackets, deleted: deleteStats.delEmptyPackets, after: countsAfter.dailyHandoverEmptyPackets, expected: '0 (PURGED)' },
    { entity: 'Coupon Records', before: countsBefore.dailyHandoverCoupons, deleted: deleteStats.delCoupons, after: countsAfter.dailyHandoverCoupons, expected: '0 (PURGED)' },
    { entity: 'Salesman Ledger Records', before: countsBefore.salesmanLedgerTransactions, deleted: deleteStats.delSalesmanLedger, after: countsAfter.salesmanLedgerTransactions, expected: '0 (PURGED)' },
    { entity: 'Expenses', before: countsBefore.expenses, deleted: deleteStats.delExpenses, after: countsAfter.expenses, expected: '0 (PURGED)' },
    { entity: 'Attendance Records', before: countsBefore.salesmanAttendances, deleted: deleteStats.delAttendances, after: countsAfter.salesmanAttendances, expected: '0 (PURGED)' },
    { entity: 'Salary Records', before: countsBefore.salesmanSalaries, deleted: deleteStats.delSalaries, after: countsAfter.salesmanSalaries, expected: '0 (PURGED)' },
  ];

  for (const row of reportRows) {
    const ent = row.entity.padEnd(26);
    const bef = String(row.before).padStart(6);
    const del = String(row.deleted).padStart(7);
    const aft = String(row.after).padStart(9);
    console.log(`| ${ent} | ${bef} | ${del} | ${aft} | ${row.expected.padEnd(25)} |`);
  }
  console.log('========================================================================================\n');

  // Strict Final Assertions
  const businessCountsTotal =
    countsAfter.salesmanUsers +
    countsAfter.dealers +
    countsAfter.salesmenPersons +
    countsAfter.staffPersons +
    countsAfter.suppliers +
    countsAfter.products +
    countsAfter.productUomConversions +
    countsAfter.initialStocks +
    countsAfter.purchaseInvoices +
    countsAfter.purchaseInvoiceItems +
    countsAfter.stockMovements +
    countsAfter.salesTargets +
    countsAfter.salesTargetProducts +
    countsAfter.issueStocks +
    countsAfter.issueStockItems +
    countsAfter.dailyHandovers +
    countsAfter.dailyHandoverItems +
    countsAfter.dailyHandoverEmptyPackets +
    countsAfter.dailyHandoverCoupons +
    countsAfter.salesmanLedgerTransactions +
    countsAfter.expenses +
    countsAfter.salesmanAttendances +
    countsAfter.salesmanSalaries;

  if (businessCountsTotal !== 0) {
    throw new Error(`CRITICAL: Expected 0 remaining business records, but found ${businessCountsTotal}!`);
  }

  if (countsAfter.adminUsers !== 1) {
    throw new Error(`CRITICAL: Expected exactly 1 Admin user, but found ${countsAfter.adminUsers}!`);
  }

  console.log('🎉 SUCCESS: DATABASE IS 100% CLEAN FOR FIRST PRODUCTION DEPLOYMENT.');
  console.log('   ONLY the Administrator authentication account remains.');
}

cleanProductionDatabase()
  .catch((err) => {
    console.error('❌ Database cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
