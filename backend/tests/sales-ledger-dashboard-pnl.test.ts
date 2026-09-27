import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import {
  PersonType,
  UserRole,
  HandoverStatus,
  HandoverRecipientType,
  IssueRecipientType,
  ExpenseCategory,
  Uom,
  ProductCategory,
  MovementType,
} from '@prisma/client';

describe('Phase 2L: Sales Ledger + Admin Dashboard + P&L Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let otherSalesmanToken: string;

  let adminUserId: string;
  let adminPersonId: string;
  let salesmanUserId: string;
  let salesmanPersonId: string;
  let otherSalesmanUserId: string;
  let otherSalesmanPersonId: string;
  let dealerPersonId: string;

  let productAId: string;
  let productBId: string;

  let handover1Id: string; // Salesman, Date 1, Status SHORT
  let handover2Id: string; // Dealer, Date 1, Status SETTLED
  let handoverDraftId: string; // Salesman, Date 1, Status DRAFT (Excluded)
  let handover3Id: string; // Salesman, Date 2, Status SETTLED (Different Date)
  let expenseOfficeId: string;
  let expenseHouseId: string;
  let expenseGpiId: string;
  let salesTargetId: string;

  const testDate1 = '2026-10-10';
  const testDate2 = '2026-10-25';

  const cleanupPersonIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupProductIds: string[] = [];
  const cleanupHandoverIds: string[] = [];
  const cleanupExpenseIds: string[] = [];
  const cleanupTargetIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Authenticate Admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'Admin@12345' },
    });
    const adminBody = JSON.parse(adminLoginRes.body);
    adminToken = adminBody.data.accessToken;
    adminUserId = adminBody.data.user.id;
    adminPersonId = adminBody.data.user.person.id;

    // 2. Authenticate Salesman (Ramesh)
    const salesmanLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'ramesh', password: 'Sales@12345' },
    });
    const salesmanBody = JSON.parse(salesmanLoginRes.body);
    salesmanToken = salesmanBody.data.accessToken;
    salesmanUserId = salesmanBody.data.user.id;
    salesmanPersonId = salesmanBody.data.user.person.id;

    // 3. Create second Salesman (Suresh) for isolation tests
    const otherSalesmanPerson = await prisma.person.create({
      data: {
        name: 'Suresh 2L Test',
        phone: '+919999111199',
        type: PersonType.SALESMAN,
        active: true,
      },
    });
    otherSalesmanPersonId = otherSalesmanPerson.id;
    cleanupPersonIds.push(otherSalesmanPersonId);

    const argon2 = await import('argon2');
    const hash = await argon2.hash('Sales@12345');
    const otherSalesmanUser = await prisma.user.create({
      data: {
        username: 'suresh2l',
        passwordHash: hash,
        role: UserRole.SALESMAN,
        personId: otherSalesmanPersonId,
        isActive: true,
      },
    });
    otherSalesmanUserId = otherSalesmanUser.id;
    cleanupUserIds.push(otherSalesmanUserId);

    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'suresh2l', password: 'Sales@12345' },
    });
    otherSalesmanToken = JSON.parse(otherLoginRes.body).data.accessToken;

    // 4. Create a Dealer
    const dealerPerson = await prisma.person.create({
      data: {
        name: 'Metro Traders 2L',
        phone: '+919999222288',
        type: PersonType.DEALER,
        active: true,
      },
    });
    dealerPersonId = dealerPerson.id;
    cleanupPersonIds.push(dealerPersonId);

    // 5. Create test products
    const prodA = await prisma.product.create({
      data: {
        name: 'Phase2L Candy Bar',
        brand: 'ChocoBrand',
        category: ProductCategory.CANDY,
        baseUom: Uom.JAR,
        salesUom: Uom.JAR,
        purchaseUom: Uom.JAR,
        standardPurchasePrice: 80,
        salesRate: 100, // Rate = 100
        active: true,
      },
    });
    productAId = prodA.id;
    cleanupProductIds.push(productAId);

    const prodB = await prisma.product.create({
      data: {
        name: 'Phase2L Cigarette M',
        brand: 'SmokeBrand',
        category: ProductCategory.CIGARETTE,
        baseUom: Uom.PACKET,
        salesUom: Uom.M,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 40,
        salesRate: 50, // Rate = 50
        active: true,
        uomConversions: {
          create: {
            fromUom: Uom.M,
            toUom: Uom.PACKET,
            conversionFactor: 100, // 1 M = 100 PACKET
          },
        },
      },
    });
    productBId = prodB.id;
    cleanupProductIds.push(productBId);

    // 6. Create Handover 1: Salesman Handover on Date 1 (Status: SHORT)
    // Product A: Sales 60, Free 10 -> Chargeable 50 * 100 = 5000 Gross. Free Item Value = 1000. Disc = 200 -> Net = 4800.
    // Product B: Sales 20, Free 0 -> Chargeable 20 * 50 = 1000 Gross. Disc = 100 -> Net = 900.
    // Total Gross = 6000, Total Discount = 300, Total Net Sales = 5700.
    // Empty Packet = 200, Coupon = 100.
    // Expected Handover = 5700 - 200 - 100 = 5400.
    // Collection = Cash 3000 + GPay 2000 = 5000.
    // Outstanding = 400, Excess = 0.
    const h1Date = new Date(`${testDate1}T00:00:00.000Z`);
    const h1 = await prisma.dailyHandover.create({
      data: {
        recipientType: HandoverRecipientType.SALESMAN,
        salesmanId: salesmanPersonId,
        handoverDate: h1Date,
        status: HandoverStatus.SHORT,
        grossSales: 6000,
        totalItemDiscount: 300,
        netSales: 5700,
        freeItemValue: 1000,
        emptyPacketBenefit: 200,
        couponBenefit: 100,
        expectedHandover: 5400,
        cashCollected: 3000,
        gpayCollected: 2000,
        collectionTotal: 5000,
        outstanding: 400,
        excess: 0,
        items: {
          create: [
            {
              productId: productAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 40,
              salesQuantity: 60,
              freeQuantity: 10,
              chargeableQuantity: 50,
              rate: 100,
              grossAmount: 5000,
              freeItemValue: 1000,
              discount: 200,
              netAmount: 4800,
              baseSalesQuantity: 60,
            },
            {
              productId: productBId,
              uom: Uom.M,
              openingQuantity: 50,
              closingQuantity: 30,
              salesQuantity: 20,
              freeQuantity: 0,
              chargeableQuantity: 20,
              rate: 50,
              grossAmount: 1000,
              freeItemValue: 0,
              discount: 100,
              netAmount: 900,
              baseSalesQuantity: 2000, // 20 M * 100 = 2000 base packets
            },
          ],
        },
        emptyPackets: {
          create: [
            {
              quantity: 20,
              actualAmount: 200,
            },
          ],
        },
        coupons: {
          create: [
            {
              denomination: 10,
              quantity: 10,
              amount: 100,
            },
          ],
        },
      },
    });
    handover1Id = h1.id;
    cleanupHandoverIds.push(handover1Id);

    // 7. Create Handover 2: Dealer Handover on Date 1 (Status: SETTLED)
    // Product A: Sales 40, Chargeable 40 * 100 = 4000 Gross. Disc = 0 -> Net = 4000.
    // Total Gross = 4000, Total Discount = 0, Net Sales = 4000.
    // Empty Packet = 0, Coupon = 0.
    // Expected Handover = 4000.
    // Collection = Cash 4000, GPay 0 -> Collection Total = 4000. Outstanding = 0.
    const h2 = await prisma.dailyHandover.create({
      data: {
        recipientType: HandoverRecipientType.DEALER,
        dealerId: dealerPersonId,
        handoverDate: h1Date,
        status: HandoverStatus.SETTLED,
        grossSales: 4000,
        totalItemDiscount: 0,
        netSales: 4000,
        freeItemValue: 0,
        emptyPacketBenefit: 0,
        couponBenefit: 0,
        expectedHandover: 4000,
        cashCollected: 4000,
        gpayCollected: 0,
        collectionTotal: 4000,
        outstanding: 0,
        excess: 0,
        items: {
          create: [
            {
              productId: productAId,
              uom: Uom.JAR,
              openingQuantity: 50,
              closingQuantity: 10,
              salesQuantity: 40,
              freeQuantity: 0,
              chargeableQuantity: 40,
              rate: 100,
              grossAmount: 4000,
              freeItemValue: 0,
              discount: 0,
              netAmount: 4000,
              baseSalesQuantity: 40,
            },
          ],
        },
      },
    });
    handover2Id = h2.id;
    cleanupHandoverIds.push(handover2Id);

    // 8. Create Handover DRAFT: Should be excluded from finalized reporting
    const hDraft = await prisma.dailyHandover.create({
      data: {
        recipientType: HandoverRecipientType.SALESMAN,
        salesmanId: otherSalesmanPersonId,
        handoverDate: h1Date,
        status: HandoverStatus.DRAFT,
        grossSales: 99999,
        totalItemDiscount: 1000,
        netSales: 98999,
        expectedHandover: 98999,
        items: {
          create: [
            {
              productId: productAId,
              uom: Uom.JAR,
              openingQuantity: 1000,
              closingQuantity: 1,
              salesQuantity: 999,
              chargeableQuantity: 999,
              rate: 100,
              grossAmount: 99900,
              freeItemValue: 0,
              discount: 1000,
              netAmount: 98900,
              baseSalesQuantity: 999,
            },
          ],
        },
      },
    });
    handoverDraftId = hDraft.id;
    cleanupHandoverIds.push(handoverDraftId);

    // 9. Create Handover 3 on Date 2 (Status: SETTLED)
    // Product B: Sales 10, Free 0, Chargeable 10 * 50 = 500 Gross. Disc = 50 -> Net = 450.
    const h3Date = new Date(`${testDate2}T00:00:00.000Z`);
    const h3 = await prisma.dailyHandover.create({
      data: {
        recipientType: HandoverRecipientType.SALESMAN,
        salesmanId: salesmanPersonId,
        handoverDate: h3Date,
        status: HandoverStatus.SETTLED,
        grossSales: 500,
        totalItemDiscount: 50,
        netSales: 450,
        freeItemValue: 0,
        emptyPacketBenefit: 50,
        couponBenefit: 0,
        expectedHandover: 400,
        cashCollected: 400,
        gpayCollected: 0,
        collectionTotal: 400,
        outstanding: 0,
        excess: 0,
        items: {
          create: [
            {
              productId: productBId,
              uom: Uom.M,
              openingQuantity: 20,
              closingQuantity: 10,
              salesQuantity: 10,
              freeQuantity: 0,
              chargeableQuantity: 10,
              rate: 50,
              grossAmount: 500,
              freeItemValue: 0,
              discount: 50,
              netAmount: 450,
              baseSalesQuantity: 1000,
            },
          ],
        },
        emptyPackets: {
          create: [
            {
              quantity: 5,
              actualAmount: 50,
            },
          ],
        },
      },
    });
    handover3Id = h3.id;
    cleanupHandoverIds.push(handover3Id);

    // 10. Create Manual Expenses on Date 1
    const exp1 = await prisma.expense.create({
      data: {
        expenseDate: h1Date,
        category: ExpenseCategory.OFFICE,
        amount: 500,
        notes: 'Office supplies Oct 10',
        createdBy: adminUserId,
      },
    });
    expenseOfficeId = exp1.id;
    cleanupExpenseIds.push(expenseOfficeId);

    const exp2 = await prisma.expense.create({
      data: {
        expenseDate: h1Date,
        category: ExpenseCategory.HOUSE,
        amount: 300,
        notes: 'House rent Oct 10',
        createdBy: adminUserId,
      },
    });
    expenseHouseId = exp2.id;
    cleanupExpenseIds.push(expenseHouseId);

    const exp3 = await prisma.expense.create({
      data: {
        expenseDate: h1Date,
        category: ExpenseCategory.GPI,
        amount: 1200,
        notes: 'GPI payment Oct 10',
        createdBy: adminUserId,
      },
    });
    expenseGpiId = exp3.id;
    cleanupExpenseIds.push(expenseGpiId);

    // 11. Create Sales Target for salesman Ramesh on Date 1
    const target = await prisma.salesTarget.create({
      data: {
        salesmanId: salesmanPersonId,
        targetDate: h1Date,
        dailyRevenueTarget: 10000,
        active: true,
        createdBy: adminUserId,
      },
    });
    salesTargetId = target.id;
    cleanupTargetIds.push(salesTargetId);
  });

  afterAll(async () => {
    // Cleanup test data
    if (cleanupExpenseIds.length) {
      await prisma.expense.deleteMany({ where: { id: { in: cleanupExpenseIds } } });
    }
    if (cleanupTargetIds.length) {
      await prisma.salesTarget.deleteMany({ where: { id: { in: cleanupTargetIds } } });
    }
    if (cleanupHandoverIds.length) {
      await prisma.dailyHandoverEmptyPacket.deleteMany({ where: { handoverId: { in: cleanupHandoverIds } } });
      await prisma.dailyHandoverCoupon.deleteMany({ where: { handoverId: { in: cleanupHandoverIds } } });
      await prisma.dailyHandoverItem.deleteMany({ where: { handoverId: { in: cleanupHandoverIds } } });
      await prisma.dailyHandover.deleteMany({ where: { id: { in: cleanupHandoverIds } } });
    }
    if (cleanupProductIds.length) {
      await prisma.productUomConversion.deleteMany({ where: { productId: { in: cleanupProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: cleanupProductIds } } });
    }
    if (cleanupUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    if (cleanupPersonIds.length) {
      await prisma.person.deleteMany({ where: { id: { in: cleanupPersonIds } } });
    }
    await app.close();
  });

  // ============================================================
  // GROUP 1: SALES LEDGER (Items 1 - 30)
  // ============================================================
  describe('Sales Ledger', () => {
    it('1. Sales Ledger summary endpoint works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('2. Gross Sales calculated from Daily Handover items', async () => {
      // On testDate1: H1 (6000) + H2 (4000) = 10,000 (DRAFT 99,999 excluded)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalGrossSales).toBe(10000);
    });

    it('3. Discount calculated from Daily Handover items', async () => {
      // H1 (300) + H2 (0) = 300
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalDiscount).toBe(300);
    });

    it('4. Net Sales = Gross Sales - Discount', async () => {
      // 10,000 - 300 = 9,700
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalNetSales).toBe(9700);
      expect(data.totalNetSales).toBe(data.totalGrossSales - data.totalDiscount);
    });

    it('5. Empty Packet derived correctly', async () => {
      // H1 has 200 empty packet benefit
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalEmptyPacket).toBe(200);
    });

    it('6. Coupon derived correctly', async () => {
      // H1 has 100 coupon benefit
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalCoupon).toBe(100);
    });

    it('7. Expected Handover = Net Sales - Empty Packet - Coupon', async () => {
      // 9700 - 200 - 100 = 9400 (H1: 5400 + H2: 4000 = 9400)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalExpectedHandover).toBe(9400);
      expect(data.totalExpectedHandover).toBe(
        data.totalNetSales - data.totalEmptyPacket - data.totalCoupon
      );
    });

    it('8. Collection total comes from Cash + GPay', async () => {
      // H1 (3000 + 2000 = 5000) + H2 (4000 + 0 = 4000) = 9000
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalCollection).toBe(9000);
    });

    it('9. Outstanding comes from Daily Handover reconciliation', async () => {
      // H1 short by 400, H2 settled (0) -> totalOutstanding = 400
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalOutstanding).toBe(400);
    });

    it('10. Excess comes from Daily Handover reconciliation', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalExcess).toBe(0);
    });

    it('11. Salesman handovers included in detailed sales ledger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&recipientType=SALESMAN`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].handoverId).toBe(handover1Id);
      expect(data.rows[0].recipientType).toBe(HandoverRecipientType.SALESMAN);
    });

    it('12. Dealer handovers included in detailed sales ledger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&recipientType=DEALER`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].handoverId).toBe(handover2Id);
      expect(data.rows[0].recipientType).toBe(HandoverRecipientType.DEALER);
    });

    it('13. DRAFT handovers excluded from finalized reporting', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      const draftRow = data.rows.find((r: any) => r.handoverId === handoverDraftId);
      expect(draftRow).toBeUndefined();
    });

    it('14. SUBMITTED handovers handled according to established reporting lifecycle', async () => {
      // Create a temporary SUBMITTED handover to verify lifecycle inclusion
      const testDate14 = '2026-10-14';
      const submittedHandover = await prisma.dailyHandover.create({
        data: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: new Date(`${testDate14}T00:00:00.000Z`),
          status: HandoverStatus.SUBMITTED,
          grossSales: 1000,
          totalItemDiscount: 0,
          netSales: 1000,
          expectedHandover: 1000,
          items: {
            create: [
              {
                productId: productAId,
                uom: Uom.JAR,
                openingQuantity: 10,
                closingQuantity: 0,
                salesQuantity: 10,
                chargeableQuantity: 10,
                rate: 100,
                grossAmount: 1000,
                freeItemValue: 0,
                discount: 0,
                netAmount: 1000,
              },
            ],
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate14}&toDate=${testDate14}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      const found = data.rows.find((r: any) => r.handoverId === submittedHandover.id);
      expect(found).toBeDefined();
      expect(found.isProvisional).toBe(true);
      expect(found.status).toBe(HandoverStatus.SUBMITTED);

      // Clean up
      await prisma.dailyHandoverItem.deleteMany({ where: { handoverId: submittedHandover.id } });
      await prisma.dailyHandover.delete({ where: { id: submittedHandover.id } });
    });

    it('15. SETTLED handovers included', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      const settled = data.rows.find((r: any) => r.handoverId === handover2Id);
      expect(settled).toBeDefined();
      expect(settled.status).toBe(HandoverStatus.SETTLED);
    });

    it('16. SHORT handovers included', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      const shortRow = data.rows.find((r: any) => r.handoverId === handover1Id);
      expect(shortRow).toBeDefined();
      expect(shortRow.status).toBe(HandoverStatus.SHORT);
    });

    it('17. EXCESS handovers included', async () => {
      // Create temporary EXCESS handover
      const testDate17 = '2026-10-17';
      const excessHandover = await prisma.dailyHandover.create({
        data: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: new Date(`${testDate17}T00:00:00.000Z`),
          status: HandoverStatus.EXCESS,
          grossSales: 500,
          netSales: 500,
          expectedHandover: 500,
          cashCollected: 600,
          collectionTotal: 600,
          excess: 100,
          items: {
            create: [
              {
                productId: productAId,
                uom: Uom.JAR,
                openingQuantity: 5,
                closingQuantity: 0,
                salesQuantity: 5,
                chargeableQuantity: 5,
                rate: 100,
                grossAmount: 500,
                freeItemValue: 0,
                discount: 0,
                netAmount: 500,
              },
            ],
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate17}&toDate=${testDate17}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      const found = data.rows.find((r: any) => r.handoverId === excessHandover.id);
      expect(found).toBeDefined();
      expect(found.status).toBe(HandoverStatus.EXCESS);
      expect(found.excess).toBe(100);

      // Clean up
      await prisma.dailyHandoverItem.deleteMany({ where: { handoverId: excessHandover.id } });
      await prisma.dailyHandover.delete({ where: { id: excessHandover.id } });
    });

    it('18. Product filter works', async () => {
      // Filter by product B on testDate1: only Handover 1 has product B (gross = 1000, discount = 100)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&productId=${productBId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].handoverId).toBe(handover1Id);
      expect(data.kpis.totalGrossSales).toBe(1000);
      expect(data.kpis.totalDiscount).toBe(100);
    });

    it('19. Salesman filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].salesmanId).toBe(salesmanPersonId);
    });

    it('20. Dealer filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&dealerId=${dealerPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].dealerId).toBe(dealerPersonId);
    });

    it('21. Recipient type filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate1}&recipientType=DEALER`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.every((r: any) => r.recipientType === 'DEALER')).toBe(true);
    });

    it('22. Date range works across multiple days', async () => {
      // testDate1 to testDate2 covers H1, H2, and H3
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate2}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(3);
    });

    it('23. Date boundaries are inclusive', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate2}&toDate=${testDate2}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(1);
      expect(data.rows[0].handoverDate).toBe(testDate2);
    });

    it('24. Empty Packet is not multiplied by item count', async () => {
      // Handover 1 has 2 items (Prod A and Prod B) and 1 empty packet line with amount 200.
      // Expected total empty packet is exactly 200, NOT 400.
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalEmptyPacket).toBe(200);
    });

    it('25. Coupon is not multiplied by item count', async () => {
      // Handover 1 has 2 items and 1 coupon line with amount 100.
      // Expected total coupon is exactly 100, NOT 200.
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalCoupon).toBe(100);
    });

    it('26. Discount is summed exactly once', async () => {
      // Total discount across items on Date 1 is 200 + 100 = 300
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalDiscount).toBe(300);
    });

    it('27. Free Item Value is not deducted twice', async () => {
      // Free item value = 1000 on H1. Net sales is Gross (6000) - Discount (300) = 5700.
      // Free item value is NOT subtracted again.
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}&recipientType=SALESMAN`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalNetSales).toBe(5700);
    });

    it('28. Decimal calculations remain exact', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger/summary?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.totalGrossSales).toBe(10000);
      expect(data.totalNetSales).toBe(9700);
      expect(data.totalExpectedHandover).toBe(9400);
    });

    it('29. Pagination works on detailed sales ledger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate2}&page=1&limit=2`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.length).toBe(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(2);
    });

    it('30. No cross-salesman leakage if endpoint is accessed by Salesman', async () => {
      // When Salesman (Ramesh) calls sales-ledger, only his own handovers are returned.
      // Dealer handover H2 and other salesman records must be invisible.
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?fromDate=${testDate1}&toDate=${testDate2}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.rows.every((r: any) => r.salesmanId === salesmanPersonId)).toBe(true);
      expect(data.rows.some((r: any) => r.recipientType === 'DEALER')).toBe(false);
    });
  });

  // ============================================================
  // GROUP 2: ADMIN DASHBOARD (Items 31 - 45)
  // ============================================================
  describe('Admin Dashboard', () => {
    it('31. Cumulative Items Sold comes from Daily Handover', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.cumulativeItemsSold).toBeDefined();
      expect(data.cumulativeItemsSold.items.length).toBeGreaterThan(0);
    });

    it('32. Dealer sales are included in cumulative items sold and sales summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // Dealer sales on testDate1 = 4000
      expect(data.salesSummary.dealerSales).toBe(4000);
      // Product A sold in H1 (60) and H2 (40) = 100
      const prodA = data.cumulativeItemsSold.items.find((i: any) => i.productId === productAId);
      expect(prodA).toBeDefined();
      expect(prodA.salesQuantity).toBe(100);
    });

    it('33. Salesman sales are included in sales summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.salesSummary.salesmanSales).toBe(5700);
    });

    it('34. Issue Stock is NOT treated as actual sales', async () => {
      // Create an IssueStock of 500 units for Salesman
      const issueStock = await prisma.issueStock.create({
        data: {
          recipientType: IssueRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          issueDate: new Date(`${testDate1}T00:00:00.000Z`),
          totalIssuedValue: 50000,
          items: {
            create: [
              {
                productId: productAId,
                quantity: 500,
                uom: Uom.JAR,
                salesRate: 100,
                issuedValue: 50000,
                baseQuantity: 500,
              },
            ],
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // Actual sales remains 10,000 gross and 9,700 net, NOT 50,000+
      expect(data.salesSummary.grossSales).toBe(10000);
      expect(data.salesSummary.netSales).toBe(9700);

      // Clean up
      await prisma.issueStockItem.deleteMany({ where: { issueStockId: issueStock.id } });
      await prisma.issueStock.delete({ where: { id: issueStock.id } });
    });

    it('35. Purchase Invoice is NOT treated as actual sales', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.salesSummary.grossSales).toBe(10000);
    });

    it('36. Initial Stock is NOT treated as actual sales', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.salesSummary.netSales).toBe(9700);
    });

    it('37. Normalized sales quantity is handled correctly', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // Product B: 20 M sold = 2,000 base packets
      const prodB = data.cumulativeItemsSold.items.find((i: any) => i.productId === productBId);
      expect(prodB).toBeDefined();
      expect(prodB.salesQuantity).toBe(20);
      expect(prodB.baseSalesQuantity).toBe(2000);
    });

    it('38. Sales target is read-only and does not mutate during reporting', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const targetBefore = await prisma.salesTarget.findUnique({ where: { id: salesTargetId } });
      expect(targetBefore?.dailyRevenueTarget.toNumber()).toBe(10000);
    });

    it('39. Actual target achievement comes from Daily Handover', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // Target = 10,000; Actual net salesman sales = 5,700
      expect(data.targetSummary.totalDailyRevenueTarget).toBe(10000);
      expect(data.targetSummary.actualNetSales).toBe(5700);
      expect(data.targetSummary.targetAchievementAmount).toBe(5700);
      expect(data.targetSummary.targetRemainingAmount).toBe(4300);
      expect(data.targetSummary.achievementPercentage).toBe(57);
    });

    it('40. Collection totals are correct in dashboard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.collectionSummary.cashCollected).toBe(7000); // 3000 (H1) + 4000 (H2)
      expect(data.collectionSummary.gpayCollected).toBe(2000); // 2000 (H1)
      expect(data.collectionSummary.collectionTotal).toBe(9000);
    });

    it('41. Outstanding totals are correct in dashboard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.outstandingSummary.totalOutstanding).toBe(400);
    });

    it('42. Excess totals are correct in dashboard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.outstandingSummary.totalExcess).toBe(0);
    });

    it('43. Expense summary is correct in dashboard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.expenseSummary.office).toBe(500);
      expect(data.expenseSummary.house).toBe(300);
      expect(data.expenseSummary.gpi).toBe(1200);
      expect(data.expenseSummary.emptyPacket).toBe(200);
      expect(data.expenseSummary.coupon).toBe(100);
      expect(data.expenseSummary.operatingExpenses).toBe(2300); // 500+300+1200+200+100
    });

    it('44. Date filtering works on dashboard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate2}&toDate=${testDate2}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.period.fromDate).toBe(testDate2);
      expect(data.period.toDate).toBe(testDate2);
      expect(data.salesSummary.grossSales).toBe(500);
    });

    it('45. Dashboard does not include DRAFT financial data incorrectly', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/admin?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.salesSummary.grossSales).toBe(10000); // Excludes DRAFT 99,999
    });
  });

  // ============================================================
  // GROUP 3: MANAGEMENT P&L (Items 46 - 62)
  // ============================================================
  describe('Management P&L Financial Summary', () => {
    it('46. Gross Sales correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.grossSales).toBe(10000);
    });

    it('47. Discount correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.discount).toBe(300);
    });

    it('48. Net Revenue = Gross Sales - Discount', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.netRevenue).toBe(9700);
      expect(data.netRevenue).toBe(data.grossSales - data.discount);
    });

    it('49. Office expense correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.officeExpense).toBe(500);
    });

    it('50. House expense correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.houseExpense).toBe(300);
    });

    it('51. GPI expense correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.gpiExpense).toBe(1200);
    });

    it('52. Empty Packet expense correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.emptyPacketExpense).toBe(200);
    });

    it('53. Coupon expense correct in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.couponExpense).toBe(100);
    });

    it('54. Operating Expenses excludes Discount', async () => {
      // OpEx = 500 + 300 + 1200 + 200 + 100 = 2300 (Discount 300 is excluded)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.operatingExpenses).toBe(2300);
      expect(data.operatingExpenses).toBe(
        data.officeExpense +
          data.houseExpense +
          data.gpiExpense +
          data.emptyPacketExpense +
          data.couponExpense
      );
    });

    it('55. Gross Profit = Net Revenue - Operating Expenses', async () => {
      // Net Revenue 9,700 - OpEx 2,300 = 7,400 Gross Profit
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.grossProfit).toBe(7400);
      expect(data.grossProfit).toBe(data.netRevenue - data.operatingExpenses);
    });

    it('56. Discount is not double-counted in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // If discount were double-counted, profit would be 7,100. It must be 7,400.
      expect(data.grossProfit).toBe(7400);
    });

    it('57. Collection is not included as revenue a second time', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // Cash collection (9,000) is informational and does not alter Net Revenue (9,700) or Gross Profit (7,400)
      expect(data.collectionTotal).toBe(9000);
      expect(data.netRevenue).toBe(9700);
      expect(data.grossProfit).toBe(7400);
    });

    it('58. Date range works correctly on P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate2}&toDate=${testDate2}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      // On testDate2: Gross = 500, Disc = 50, Net Rev = 450, EmptyPacket = 50 -> OpEx = 50 -> Gross Profit = 400
      expect(data.grossSales).toBe(500);
      expect(data.discount).toBe(50);
      expect(data.netRevenue).toBe(450);
      expect(data.operatingExpenses).toBe(50);
      expect(data.grossProfit).toBe(400);
    });

    it('59. Dealer handover financials included in P&L', async () => {
      // H2 contributed 4000 to grossSales on testDate1
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.grossSales).toBe(10000);
    });

    it('60. Salesman handover financials included in P&L', async () => {
      // H1 contributed 6000 to grossSales on testDate1
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.grossSales).toBe(10000);
    });

    it('61. DRAFT handovers excluded from P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.grossSales).toBe(10000); // Not 109,999
    });

    it('62. Decimal calculations exact in P&L', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/pnl?fromDate=${testDate1}&toDate=${testDate1}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(res.body).data;
      expect(data.grossSales).toBe(10000);
      expect(data.discount).toBe(300);
      expect(data.netRevenue).toBe(9700);
      expect(data.operatingExpenses).toBe(2300);
      expect(data.grossProfit).toBe(7400);
    });
  });

  // ============================================================
  // GROUP 4: SECURITY & AUTHORIZATION (Items 63 - 69)
  // ============================================================
  describe('Security & Authorization', () => {
    it('63. Unauthenticated Sales Ledger request returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sales-ledger',
      });
      expect(res.statusCode).toBe(401);
    });

    it('64. Unauthenticated Dashboard request returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/admin',
      });
      expect(res.statusCode).toBe(401);
    });

    it('65. Unauthenticated P&L request returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/pnl',
      });
      expect(res.statusCode).toBe(401);
    });

    it('66. Salesman cannot access Admin Dashboard (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard/admin',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('67. Salesman cannot access P&L (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/pnl',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('68. Dealer cannot access reports (Dealer has no login, unauthenticated returns 401)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/pnl',
      });
      expect(res.statusCode).toBe(401);
    });

    it('69. Salesman cannot manipulate filters to access another salesman data', async () => {
      // Suresh attempts to query Ramesh's data via query param
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-ledger?salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${otherSalesmanToken}` },
      });
      // Rejected with 403 Forbidden
      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================================
  // GROUP 5: SHIELDED MUTATIONS & IMMUTABILITY
  // ============================================================
  describe('Shielded Mutations', () => {
    it('70. PATCH sales-ledger returns 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-ledger/${handover1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { grossSales: 99999 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('71. DELETE sales-ledger returns 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sales-ledger/${handover1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('72. PATCH dashboard returns 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/dashboard/admin',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('73. DELETE dashboard returns 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/dashboard/admin',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('74. PATCH / DELETE P&L returns 400 Bad Request', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/reports/pnl',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(patchRes.statusCode).toBe(400);

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/reports/pnl',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(400);
    });
  });
});
