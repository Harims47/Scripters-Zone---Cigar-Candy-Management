import { PrismaClient, UserRole, PersonType, ProductCategory, Uom, LedgerTransactionType, LedgerDirection, LedgerReferenceType, ExpenseCategory, AttendanceStatus, SalaryStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (Single-Tenant Master Data)...');

  // 1. Password Hashing with Argon2id
  const adminPasswordHash = await argon2.hash('Admin@12345', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const salesmanPasswordHash = await argon2.hash('Sales@12345', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // 2. Admin Person & User
  let adminPerson = await prisma.person.findFirst({
    where: { phone: '+919876500001' },
  });
  if (!adminPerson) {
    adminPerson = await prisma.person.create({
      data: {
        name: 'System Administrator',
        phone: '+919876500001',
        type: PersonType.STAFF,
        active: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      personId: adminPerson.id,
      isActive: true,
    },
    create: {
      username: 'admin',
      email: 'admin@crackershub.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      personId: adminPerson.id,
      isActive: true,
    },
  });
  console.log('  ✔ Admin user ready: username="admin", password="Admin@12345"');

  // 3. Salesman Person & User
  let salesmanPerson = await prisma.person.findFirst({
    where: { phone: '+919876500002' },
  });
  if (!salesmanPerson) {
    salesmanPerson = await prisma.person.create({
      data: {
        name: 'Ramesh Kumar',
        phone: '+919876500002',
        type: PersonType.SALESMAN,
        active: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { username: 'ramesh' },
    update: {
      passwordHash: salesmanPasswordHash,
      role: UserRole.SALESMAN,
      personId: salesmanPerson.id,
      isActive: true,
    },
    create: {
      username: 'ramesh',
      email: 'ramesh@crackershub.local',
      passwordHash: salesmanPasswordHash,
      role: UserRole.SALESMAN,
      personId: salesmanPerson.id,
      isActive: true,
    },
  });
  console.log('  ✔ Salesman user ready: username="ramesh", password="Sales@12345"');

  // 4. Dealer Master Records (BUSINESS RULE: Dealers MUST NOT have User accounts)
  const dealers = [
    { name: 'Sri Murugan Stores', phone: '+919876511111', address: 'Main Bazaar, Tenkasi' },
    { name: 'Ayyappa Agencies', phone: '+919876522222', address: 'Bus Stand Road, Sivakasi' },
    { name: 'Lakshmi Traders', phone: '+919876533333', address: 'Gandhi Market, Madurai' },
  ];

  for (const dealer of dealers) {
    const existing = await prisma.person.findFirst({ where: { phone: dealer.phone } });
    if (!existing) {
      await prisma.person.create({
        data: {
          name: dealer.name,
          phone: dealer.phone,
          address: dealer.address,
          type: PersonType.DEALER,
          active: true,
        },
      });
    }
  }
  console.log(`  ✔ Seeded ${dealers.length} Dealer business records (Zero login accounts created).`);

  // 5. Cigarette Products Master (NO emptyPocketRate / couponRate on master)
  const cigaretteProducts = [
    {
      sku: 'CIG-FS-001',
      name: 'Four Square Special',
      brand: 'Four Square',
      category: ProductCategory.CIGARETTE,
      baseUom: Uom.POCKET,
      salesUom: Uom.POCKET,
      purchaseUom: Uom.CASE,
      standardPurchasePrice: '85.00',
      salesRate: '100.00',
      conversions: [
        { fromUom: Uom.M, toUom: Uom.POCKET, conversionFactor: '100.0000' },
        { fromUom: Uom.CASE, toUom: Uom.POCKET, conversionFactor: '600.0000' },
      ],
    },
    {
      sku: 'CIG-CAV-001',
      name: 'Cavanders Gold',
      brand: 'Cavanders',
      category: ProductCategory.CIGARETTE,
      baseUom: Uom.POCKET,
      salesUom: Uom.POCKET,
      purchaseUom: Uom.CASE,
      standardPurchasePrice: '42.00',
      salesRate: '50.00',
      conversions: [
        { fromUom: Uom.M, toUom: Uom.POCKET, conversionFactor: '100.0000' },
        { fromUom: Uom.CASE, toUom: Uom.POCKET, conversionFactor: '500.0000' },
      ],
    },
    {
      sku: 'CIG-MAR-001',
      name: 'Marlboro Red Lights',
      brand: 'Marlboro',
      category: ProductCategory.CIGARETTE,
      baseUom: Uom.POCKET,
      salesUom: Uom.POCKET,
      purchaseUom: Uom.CASE,
      standardPurchasePrice: '155.00',
      salesRate: '180.00',
      conversions: [
        { fromUom: Uom.M, toUom: Uom.POCKET, conversionFactor: '100.0000' },
        { fromUom: Uom.CASE, toUom: Uom.POCKET, conversionFactor: '600.0000' },
      ],
    },
  ];

  // 6. Candy Products Master
  const candyProducts = [
    {
      sku: 'CND-GPI-001',
      name: 'GPI Mixed Fruit Candy',
      brand: 'GPI',
      category: ProductCategory.CANDY,
      baseUom: Uom.JAR,
      salesUom: Uom.JAR,
      purchaseUom: Uom.CASE,
      standardPurchasePrice: '120.00',
      salesRate: '160.00',
      conversions: [
        { fromUom: Uom.CASE, toUom: Uom.JAR, conversionFactor: '24.0000' },
      ],
    },
    {
      sku: 'CND-FER-001',
      name: 'Fereo Choco Drops',
      brand: 'Fereo',
      category: ProductCategory.CANDY,
      baseUom: Uom.JAR,
      salesUom: Uom.JAR,
      purchaseUom: Uom.CASE,
      standardPurchasePrice: '210.00',
      salesRate: '280.00',
      conversions: [
        { fromUom: Uom.CASE, toUom: Uom.JAR, conversionFactor: '12.0000' },
      ],
    },
  ];

  const allProducts = [...cigaretteProducts, ...candyProducts];

  for (const prodData of allProducts) {
    const { conversions, ...prodFields } = prodData;

    let product = await prisma.product.findUnique({
      where: { sku: prodFields.sku },
    });

    if (!product) {
      product = await prisma.product.create({
        data: prodFields,
      });
    } else {
      product = await prisma.product.update({
        where: { id: product.id },
        data: prodFields,
      });
    }

    for (const conv of conversions) {
      await prisma.productUomConversion.upsert({
        where: {
          productId_fromUom_toUom: {
            productId: product.id,
            fromUom: conv.fromUom,
            toUom: conv.toUom,
          },
        },
        update: {
          conversionFactor: conv.conversionFactor,
        },
        create: {
          productId: product.id,
          fromUom: conv.fromUom,
          toUom: conv.toUom,
          conversionFactor: conv.conversionFactor,
        },
      });
    }
  }

  console.log(`  ✔ Seeded ${allProducts.length} Products with product-specific UOM conversions.`);

  // 7. Phase 2E: Suppliers Master (Suppliers do NOT log in, NO user accounts)
  const suppliers = [
    {
      name: 'ITC Limited Supply Depot',
      phone: '+919876544441',
      address: 'Industrial Area, Sivakasi',
      active: true,
    },
    {
      name: 'Godfrey Phillips Distributors',
      phone: '+919876544442',
      address: 'Central Wholesale Complex, Madurai',
      active: true,
    },
  ];

  const seededSuppliers: any[] = [];
  for (const sup of suppliers) {
    let supplier = await prisma.supplier.findFirst({ where: { name: sup.name } });
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: sup });
    }
    seededSuppliers.push(supplier);
  }
  console.log(`  ✔ Seeded ${seededSuppliers.length} Suppliers.`);

  // 8. Phase 2E: Initial Stock & Purchase Invoice with Stock Receipts
  const cavanders = await prisma.product.findUnique({ where: { sku: 'CIG-CAV-001' } });
  const gpiCandy = await prisma.product.findUnique({ where: { sku: 'CND-GPI-001' } });

  if (cavanders && gpiCandy && seededSuppliers.length > 0) {
    const itcSupplier = seededSuppliers[0];
    const invoiceNum = 'INV-ITC-2026-001';

    const existingInvoice = await prisma.purchaseInvoice.findUnique({
      where: {
        supplierId_invoiceNumber: {
          supplierId: itcSupplier.id,
          invoiceNumber: invoiceNum,
        },
      },
    });

    if (!existingInvoice) {
      // Cavanders: 10 M @ 4200 = 42,000, discount = 200, net = 41,800. Base Qty: 1000 PACKET
      // GPI Candy: 50 JAR @ 115 = 5,750, discount = 50, net = 5,700. Base Qty: 50 JAR
      const invoice = await prisma.purchaseInvoice.create({
        data: {
          supplierId: itcSupplier.id,
          invoiceNumber: invoiceNum,
          invoiceDate: new Date('2026-09-25T10:00:00.000Z'),
          grossTotal: '47750.00',
          totalItemDiscount: '250.00',
          netTotal: '47500.00',
          status: 'RECEIVED',
          createdBy: 'admin',
          items: {
            create: [
              {
                productId: cavanders.id,
                quantity: '10.00',
                uom: Uom.M,
                actualRate: '4200.00',
                discount: '200.00',
                grossTotal: '42000.00',
                netTotal: '41800.00',
              },
              {
                productId: gpiCandy.id,
                quantity: '50.00',
                uom: Uom.JAR,
                actualRate: '115.00',
                discount: '50.00',
                grossTotal: '5750.00',
                netTotal: '5700.00',
              },
            ],
          },
        },
      });

      // Stock movements for the received items
      await prisma.stockMovement.createMany({
        data: [
          {
            productId: cavanders.id,
            movementType: 'RECEIPT',
            quantity: '10.00',
            uom: Uom.M,
            baseQuantity: '1000.00',
            purchaseInvoiceId: invoice.id,
            createdBy: 'admin',
          },
          {
            productId: gpiCandy.id,
            movementType: 'RECEIPT',
            quantity: '50.00',
            uom: Uom.JAR,
            baseQuantity: '50.00',
            purchaseInvoiceId: invoice.id,
            createdBy: 'admin',
          },
        ],
      });

      console.log(`  ✔ Seeded Purchase Invoice ${invoiceNum} with 2 items and stock receipt movements.`);
    }
  }

  // 9. Phase 2F: Sales Targets for Salesman Ramesh
  const rameshUser = await prisma.user.findUnique({
    where: { username: 'ramesh' },
    include: { person: true },
  });

  if (rameshUser && rameshUser.person && cavanders && gpiCandy) {
    const salesmanPersonId = rameshUser.person.id;

    // Target 1: 2026-09-25, Revenue: ₹40,000, Cavanders: 80 M
    const targetDate1 = new Date(Date.UTC(2026, 8, 25)); // 2026-09-25
    const existingTarget1 = await prisma.salesTarget.findUnique({
      where: {
        salesmanId_targetDate: {
          salesmanId: salesmanPersonId,
          targetDate: targetDate1,
        },
      },
    });

    if (!existingTarget1) {
      await prisma.salesTarget.create({
        data: {
          salesmanId: salesmanPersonId,
          targetDate: targetDate1,
          dailyRevenueTarget: '40000.00',
          active: true,
          createdBy: 'admin',
          productTargets: {
            create: [
              {
                productId: cavanders.id,
                targetQuantity: '80.00',
                uom: Uom.M,
              },
            ],
          },
        },
      });
    }

    // Target 2: 2026-09-26, Revenue: ₹50,000, Cavanders: 100 M, GPI Candy: 50 JAR
    const targetDate2 = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26
    const existingTarget2 = await prisma.salesTarget.findUnique({
      where: {
        salesmanId_targetDate: {
          salesmanId: salesmanPersonId,
          targetDate: targetDate2,
        },
      },
    });

    if (!existingTarget2) {
      await prisma.salesTarget.create({
        data: {
          salesmanId: salesmanPersonId,
          targetDate: targetDate2,
          dailyRevenueTarget: '50000.00',
          active: true,
          createdBy: 'admin',
          productTargets: {
            create: [
              {
                productId: cavanders.id,
                targetQuantity: '100.00',
                uom: Uom.M,
              },
              {
                productId: gpiCandy.id,
                targetQuantity: '50.00',
                uom: Uom.JAR,
              },
            ],
          },
        },
      });
    }

    console.log('  ✔ Seeded Sales Targets for salesman Ramesh (2026-09-25, 2026-09-26).');
  }

  // 10. Phase 2G: Issue Stock (Stock Out to Salesman Ramesh & Dealer)
  const dealerMurugan = await prisma.person.findFirst({
    where: { name: 'Sri Murugan Stores', type: PersonType.DEALER },
  });

  if (rameshUser && rameshUser.person && cavanders && gpiCandy && dealerMurugan) {
    const issueDate = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26

    // 10a. Salesman Issue: Ramesh (2 M Cavanders = 200 Packets)
    const existingSalesmanIssue = await prisma.issueStock.findFirst({
      where: {
        recipientType: 'SALESMAN',
        salesmanId: rameshUser.person.id,
        issueDate,
      },
    });

    if (!existingSalesmanIssue) {
      const issue1 = await prisma.issueStock.create({
        data: {
          recipientType: 'SALESMAN',
          salesmanId: rameshUser.person.id,
          issueDate,
          totalIssuedValue: '10000.00', // 200 pkts * ₹50
          createdBy: 'admin',
          items: {
            create: [
              {
                productId: cavanders.id,
                quantity: '2.00',
                uom: Uom.M,
                salesRate: '50.00',
                issuedValue: '10000.00',
                baseQuantity: '200.00',
              },
            ],
          },
        },
      });

      await prisma.stockMovement.create({
        data: {
          productId: cavanders.id,
          movementType: 'ISSUE',
          quantity: '2.00',
          uom: Uom.M,
          baseQuantity: '200.00',
          issueStockId: issue1.id,
          createdBy: 'admin',
        },
      });
    }

    // 10b. Dealer Issue: Sri Murugan Stores (10 JAR GPI Candy)
    const existingDealerIssue = await prisma.issueStock.findFirst({
      where: {
        recipientType: 'DEALER',
        dealerId: dealerMurugan.id,
        issueDate,
      },
    });

    if (!existingDealerIssue) {
      const issue2 = await prisma.issueStock.create({
        data: {
          recipientType: 'DEALER',
          dealerId: dealerMurugan.id,
          issueDate,
          totalIssuedValue: '1600.00', // 10 jars * ₹160
          createdBy: 'admin',
          items: {
            create: [
              {
                productId: gpiCandy.id,
                quantity: '10.00',
                uom: Uom.JAR,
                salesRate: '160.00',
                issuedValue: '1600.00',
                baseQuantity: '10.00',
              },
            ],
          },
        },
      });

      await prisma.stockMovement.create({
        data: {
          productId: gpiCandy.id,
          movementType: 'ISSUE',
          quantity: '10.00',
          uom: Uom.JAR,
          baseQuantity: '10.00',
          issueStockId: issue2.id,
          createdBy: 'admin',
        },
      });
    }

    console.log('  ✔ Seeded Issue Stock for salesman Ramesh and dealer Sri Murugan Stores.');
  }

  // 11. Phase 2H: Daily Handover (Salesman Ramesh & Dealer Sri Murugan Stores)
  if (rameshUser && rameshUser.person && cavanders && gpiCandy && dealerMurugan) {
    const handoverDate = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26

    // 11a. Salesman Handover: Ramesh
    const existingSalesmanHandover = await prisma.dailyHandover.findUnique({
      where: {
        salesmanId_handoverDate: {
          salesmanId: rameshUser.person.id,
          handoverDate,
        },
      },
    });

    if (!existingSalesmanHandover) {
      await prisma.dailyHandover.create({
        data: {
          recipientType: 'SALESMAN',
          salesmanId: rameshUser.person.id,
          handoverDate,
          status: 'SETTLED',
          grossSales: '5030.00',
          totalItemDiscount: '80.00',
          netSales: '4950.00',
          freeItemValue: '250.00',
          emptyPacketBenefit: '50.00',
          couponBenefit: '20.00',
          expectedHandover: '4880.00',
          cashCollected: '3000.00',
          gpayCollected: '1880.00',
          collectionTotal: '4880.00',
          outstanding: '0.00',
          excess: '0.00',
          submittedBy: rameshUser.id,
          submittedAt: new Date('2026-09-26T18:00:00.000Z'),
          reviewedBy: 'admin',
          reviewedAt: new Date('2026-09-26T19:00:00.000Z'),
          items: {
            create: [
              {
                productId: cavanders.id,
                uom: Uom.PACKET,
                openingQuantity: '100.00',
                closingQuantity: '20.00',
                salesQuantity: '80.00',
                freeQuantity: '5.00',
                chargeableQuantity: '75.00',
                rate: '50.00',
                grossAmount: '3750.00',
                freeItemValue: '250.00',
                discount: '50.00',
                netAmount: '3700.00',
                baseSalesQuantity: '80.00',
              },
              {
                productId: gpiCandy.id,
                uom: Uom.JAR,
                openingQuantity: '10.00',
                closingQuantity: '2.00',
                salesQuantity: '8.00',
                freeQuantity: '0.00',
                chargeableQuantity: '8.00',
                rate: '160.00',
                grossAmount: '1280.00',
                freeItemValue: '0.00',
                discount: '30.00',
                netAmount: '1250.00',
                baseSalesQuantity: '8.00',
              },
            ],
          },
          emptyPackets: {
            create: [
              {
                productId: cavanders.id,
                quantity: '5.00',
                actualAmount: '50.00',
              },
            ],
          },
          coupons: {
            create: [
              {
                denomination: '2.00',
                quantity: '10.00',
                amount: '20.00',
              },
            ],
          },
        },
      });
      console.log('  ✔ Seeded Daily Handover for salesman Ramesh.');
    }

    // 11b. Dealer Handover: Sri Murugan Stores
    const existingDealerHandover = await prisma.dailyHandover.findFirst({
      where: {
        recipientType: 'DEALER',
        dealerId: dealerMurugan.id,
        handoverDate,
      },
    });

    if (!existingDealerHandover) {
      await prisma.dailyHandover.create({
        data: {
          recipientType: 'DEALER',
          dealerId: dealerMurugan.id,
          handoverDate,
          status: 'SETTLED',
          customerName: 'Murugan (Proprietor)',
          customerPhone: '9840011223',
          grossSales: '1600.00',
          totalItemDiscount: '0.00',
          netSales: '1600.00',
          freeItemValue: '0.00',
          emptyPacketBenefit: '0.00',
          couponBenefit: '0.00',
          expectedHandover: '1600.00',
          cashCollected: '1000.00',
          gpayCollected: '600.00',
          collectionTotal: '1600.00',
          outstanding: '0.00',
          excess: '0.00',
          submittedBy: 'admin',
          submittedAt: new Date('2026-09-26T17:30:00.000Z'),
          reviewedBy: 'admin',
          reviewedAt: new Date('2026-09-26T17:30:00.000Z'),
          items: {
            create: [
              {
                productId: gpiCandy.id,
                uom: Uom.JAR,
                openingQuantity: '10.00',
                closingQuantity: '0.00',
                salesQuantity: '10.00',
                freeQuantity: '0.00',
                chargeableQuantity: '10.00',
                rate: '160.00',
                grossAmount: '1600.00',
                freeItemValue: '0.00',
                discount: '0.00',
                netAmount: '1600.00',
                baseSalesQuantity: '10.00',
              },
            ],
          },
        },
      });
      console.log('  ✔ Seeded Daily Handover for dealer Sri Murugan Stores.');
    }

    // 12. Salesman Ledger: Deterministic seed entries for salesman Ramesh
    const existingAdvance = await prisma.salesmanLedgerTransaction.findFirst({
      where: {
        salesmanId: salesmanPerson.id,
        type: LedgerTransactionType.ADVANCE,
        amount: '3000.00',
      },
    });

    if (!existingAdvance) {
      await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: salesmanPerson.id,
          transactionDate: new Date('2026-09-20T00:00:00.000Z'),
          type: LedgerTransactionType.ADVANCE,
          direction: LedgerDirection.DEBIT,
          amount: '3000.00',
          referenceType: LedgerReferenceType.MANUAL,
          notes: 'Festival advance',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded ADVANCE (DEBIT ₹3,000) for salesman Ramesh.');
    }

    const existingRecovery = await prisma.salesmanLedgerTransaction.findFirst({
      where: {
        salesmanId: salesmanPerson.id,
        type: LedgerTransactionType.RECOVERY,
        amount: '1500.00',
      },
    });

    if (!existingRecovery) {
      await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: salesmanPerson.id,
          transactionDate: new Date('2026-09-22T00:00:00.000Z'),
          type: LedgerTransactionType.RECOVERY,
          direction: LedgerDirection.CREDIT,
          amount: '1500.00',
          referenceType: LedgerReferenceType.MANUAL,
          notes: 'Cash recovery installment',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded RECOVERY (CREDIT ₹1,500) for salesman Ramesh.');
    }

    const existingAdjustment = await prisma.salesmanLedgerTransaction.findFirst({
      where: {
        salesmanId: salesmanPerson.id,
        type: LedgerTransactionType.MANUAL_ADJUSTMENT,
        amount: '500.00',
      },
    });

    if (!existingAdjustment) {
      await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: salesmanPerson.id,
          transactionDate: new Date('2026-09-24T00:00:00.000Z'),
          type: LedgerTransactionType.MANUAL_ADJUSTMENT,
          direction: LedgerDirection.DEBIT,
          amount: '500.00',
          referenceType: LedgerReferenceType.MANUAL,
          notes: 'Shortage adjustment approved by manager',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded MANUAL_ADJUSTMENT (DEBIT ₹500) for salesman Ramesh.');
    }
    // 13. Operating Expenses: Deterministic manual seed entries
    const existingOfficeExpense = await prisma.expense.findFirst({
      where: {
        category: ExpenseCategory.OFFICE,
        notes: 'Office internet and stationary',
      },
    });

    if (!existingOfficeExpense) {
      await prisma.expense.create({
        data: {
          expenseDate: new Date('2026-09-25T00:00:00.000Z'),
          category: ExpenseCategory.OFFICE,
          amount: '1200.00',
          notes: 'Office internet and stationary',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded OFFICE expense (₹1,200).');
    }

    const existingHouseExpense = await prisma.expense.findFirst({
      where: {
        category: ExpenseCategory.HOUSE,
        notes: 'House maintenance supplies',
      },
    });

    if (!existingHouseExpense) {
      await prisma.expense.create({
        data: {
          expenseDate: new Date('2026-09-25T00:00:00.000Z'),
          category: ExpenseCategory.HOUSE,
          amount: '800.00',
          notes: 'House maintenance supplies',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded HOUSE expense (₹800).');
    }

    const existingGpiExpense = await prisma.expense.findFirst({
      where: {
        category: ExpenseCategory.GPI,
        notes: 'GPI field logistics expense',
      },
    });

    if (!existingGpiExpense) {
      await prisma.expense.create({
        data: {
          expenseDate: new Date('2026-09-26T00:00:00.000Z'),
          category: ExpenseCategory.GPI,
          amount: '500.00',
          notes: 'GPI field logistics expense',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded GPI expense (₹500).');
    }

    // 14. Attendance & Salary Seed Data
    const existingPresent = await prisma.salesmanAttendance.findUnique({
      where: {
        salesmanId_attendanceDate: {
          salesmanId: salesmanPerson.id,
          attendanceDate: new Date('2026-09-25T00:00:00.000Z'),
        },
      },
    });

    if (!existingPresent) {
      await prisma.salesmanAttendance.create({
        data: {
          salesmanId: salesmanPerson.id,
          attendanceDate: new Date('2026-09-25T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          notes: 'Regular on-field sales day',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded Attendance: Ramesh PRESENT on 2026-09-25.');
    }

    const existingAbsent = await prisma.salesmanAttendance.findUnique({
      where: {
        salesmanId_attendanceDate: {
          salesmanId: salesmanPerson.id,
          attendanceDate: new Date('2026-09-26T00:00:00.000Z'),
        },
      },
    });

    if (!existingAbsent) {
      await prisma.salesmanAttendance.create({
        data: {
          salesmanId: salesmanPerson.id,
          attendanceDate: new Date('2026-09-26T00:00:00.000Z'),
          status: AttendanceStatus.ABSENT,
          notes: 'Personal absence (informational)',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded Attendance: Ramesh ABSENT on 2026-09-26.');
    }

    // Salary Deduction in Ledger for September 2026
    const existingSalaryDeduction = await prisma.salesmanLedgerTransaction.findFirst({
      where: {
        salesmanId: salesmanPerson.id,
        type: LedgerTransactionType.SALARY_DEDUCTION,
        amount: '2000.00',
      },
    });

    if (!existingSalaryDeduction) {
      await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: salesmanPerson.id,
          transactionDate: new Date('2026-09-28T00:00:00.000Z'),
          type: LedgerTransactionType.SALARY_DEDUCTION,
          direction: LedgerDirection.CREDIT,
          amount: '2000.00',
          referenceType: LedgerReferenceType.SALARY,
          notes: 'Monthly advance recovery via salary deduction',
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded SALARY_DEDUCTION ledger credit (₹2,000) for Ramesh.');
    }

    // Salary for September 2026
    const existingSalary = await prisma.salesmanSalary.findUnique({
      where: {
        salesmanId_salaryMonth: {
          salesmanId: salesmanPerson.id,
          salaryMonth: new Date('2026-09-01T00:00:00.000Z'),
        },
      },
    });

    if (!existingSalary) {
      await prisma.salesmanSalary.create({
        data: {
          salesmanId: salesmanPerson.id,
          salaryMonth: new Date('2026-09-01T00:00:00.000Z'),
          baseSalary: '30000.00',
          salaryRecovery: '2000.00',
          netSalary: '28000.00',
          status: SalaryStatus.PAID,
          paidDate: new Date('2026-09-30T00:00:00.000Z'),
          createdBy: 'admin',
        },
      });
      console.log('  ✔ Seeded Salary for Ramesh (Base: ₹30,000, Recovery: ₹2,000, Net: ₹28,000, Status: PAID).');
    }
  }

  console.log('✅ Phase 2K Database Seed Completed Successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
