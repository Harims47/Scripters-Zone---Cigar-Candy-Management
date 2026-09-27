import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `pre_cleanup_backup_${timestamp}.json`);

  console.log(`Starting pre-cleanup database export to: ${backupFile}`);

  const backupData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      sourceDatabase: process.env.DATABASE_URL?.split('@')[1] || 'localhost',
    },
    tables: {
      users: await prisma.user.findMany(),
      persons: await prisma.person.findMany(),
      products: await prisma.product.findMany(),
      productUomConversions: await prisma.productUomConversion.findMany(),
      initialStocks: await prisma.initialStock.findMany(),
      suppliers: await prisma.supplier.findMany(),
      purchaseInvoices: await prisma.purchaseInvoice.findMany(),
      purchaseInvoiceItems: await prisma.purchaseInvoiceItem.findMany(),
      stockMovements: await prisma.stockMovement.findMany(),
      salesTargets: await prisma.salesTarget.findMany(),
      salesTargetProducts: await prisma.salesTargetProduct.findMany(),
      issueStocks: await prisma.issueStock.findMany(),
      issueStockItems: await prisma.issueStockItem.findMany(),
      dailyHandovers: await prisma.dailyHandover.findMany(),
      dailyHandoverItems: await prisma.dailyHandoverItem.findMany(),
      dailyHandoverEmptyPackets: await prisma.dailyHandoverEmptyPacket.findMany(),
      dailyHandoverCoupons: await prisma.dailyHandoverCoupon.findMany(),
      salesmanLedgerTransactions: await prisma.salesmanLedgerTransaction.findMany(),
      expenses: await prisma.expense.findMany(),
      salesmanAttendances: await prisma.salesmanAttendance.findMany(),
      salesmanSalaries: await prisma.salesmanSalary.findMany(),
    }
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');

  const stats = fs.statSync(backupFile);
  console.log(`✔ Pre-cleanup backup created successfully!`);
  console.log(`  File: ${backupFile}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);

  for (const [table, rows] of Object.entries(backupData.tables)) {
    console.log(`  - ${table}: ${rows.length} rows`);
  }
}

createBackup()
  .catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
