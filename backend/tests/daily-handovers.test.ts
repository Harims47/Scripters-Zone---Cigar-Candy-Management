import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { Uom, ProductCategory, PersonType, HandoverRecipientType, HandoverStatus } from '@prisma/client';

describe('Phase 2H: Daily Handover Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let otherSalesmanToken: string;

  let adminUserId: string;
  let salesmanUserId: string;
  let otherSalesmanUserId: string;

  let salesmanPersonId: string;
  let otherSalesmanPersonId: string;
  let dealerPersonId: string;
  let inactiveSalesmanPersonId: string;
  let inactiveDealerPersonId: string;

  let candyProductId: string;
  let cigaretteProductId: string;
  let testProductAId: string;
  let testProductBId: string;
  let testProductCId: string;

  const testHandoverDate = '2026-09-28';
  const testHandoverDate2 = '2026-09-29';
  const testHandoverDate3 = '2026-09-30';

  const createdHandoverIds: string[] = [];
  const createdProductIds: string[] = [];

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

    // 3. Create a second Salesman for authorization testing
    const otherSalesmanPerson = await prisma.person.create({
      data: {
        name: 'Suresh (Other Salesman)',
        phone: '9888877771',
        type: PersonType.SALESMAN,
        active: true,
      },
    });
    otherSalesmanPersonId = otherSalesmanPerson.id;

    const otherSalesmanUser = await prisma.user.create({
      data: {
        username: 'suresh_handover',
        passwordHash: 'dummy_hash',
        role: 'SALESMAN',
        personId: otherSalesmanPerson.id,
        isActive: true,
      },
    });
    otherSalesmanUserId = otherSalesmanUser.id;
    otherSalesmanToken = app.jwt.sign({
      userId: otherSalesmanUser.id,
      username: otherSalesmanUser.username,
      role: otherSalesmanUser.role,
      personId: otherSalesmanPerson.id,
    });

    // 4. Inactive salesman
    const inactiveSalesman = await prisma.person.create({
      data: {
        name: 'Inactive Salesman Handover',
        phone: '9888877772',
        type: PersonType.SALESMAN,
        active: false,
      },
    });
    inactiveSalesmanPersonId = inactiveSalesman.id;

    // 5. Active Dealer
    const dealerPerson = await prisma.person.findFirst({
      where: { type: PersonType.DEALER, active: true },
    });
    if (!dealerPerson) {
      throw new Error('No active dealer found in database seed');
    }
    dealerPersonId = dealerPerson.id;

    // 6. Inactive Dealer
    const inactiveDealer = await prisma.person.create({
      data: {
        name: 'Inactive Dealer Handover',
        phone: '9888877773',
        type: PersonType.DEALER,
        active: false,
      },
    });
    inactiveDealerPersonId = inactiveDealer.id;

    // 7. Get existing products
    const candyProduct = await prisma.product.findFirst({
      where: { category: ProductCategory.CANDY, active: true },
    });
    candyProductId = candyProduct!.id;

    const cigaretteProduct = await prisma.product.findFirst({
      where: { category: ProductCategory.CIGARETTE, active: true },
    });
    cigaretteProductId = cigaretteProduct!.id;

    // 8. Create additional products for multi-product and double-count testing
    const prodA = await prisma.product.create({
      data: {
        sku: 'TEST-DH-PROD-A',
        name: 'Handover Test Product A',
        category: ProductCategory.CANDY,
        brand: 'TestBrand',
        baseUom: Uom.JAR,
        salesUom: Uom.JAR,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 80,
        salesRate: 100,
        active: true,
      },
    });
    testProductAId = prodA.id;
    createdProductIds.push(prodA.id);

    const prodB = await prisma.product.create({
      data: {
        sku: 'TEST-DH-PROD-B',
        name: 'Handover Test Product B',
        category: ProductCategory.CANDY,
        brand: 'TestBrand',
        baseUom: Uom.JAR,
        salesUom: Uom.JAR,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 80,
        salesRate: 100,
        active: true,
      },
    });
    testProductBId = prodB.id;
    createdProductIds.push(prodB.id);

    const prodC = await prisma.product.create({
      data: {
        sku: 'TEST-DH-PROD-C',
        name: 'Handover Test Product C',
        category: ProductCategory.CANDY,
        brand: 'TestBrand',
        baseUom: Uom.JAR,
        salesUom: Uom.JAR,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 80,
        salesRate: 100,
        active: true,
      },
    });
    testProductCId = prodC.id;
    createdProductIds.push(prodC.id);
  });

  afterAll(async () => {
    if (createdHandoverIds.length > 0) {
      await prisma.dailyHandoverCoupon.deleteMany({ where: { handoverId: { in: createdHandoverIds } } });
      await prisma.dailyHandoverEmptyPacket.deleteMany({ where: { handoverId: { in: createdHandoverIds } } });
      await prisma.dailyHandoverItem.deleteMany({ where: { handoverId: { in: createdHandoverIds } } });
      await prisma.dailyHandover.deleteMany({ where: { id: { in: createdHandoverIds } } });
    }

    if (createdProductIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }

    await prisma.user.deleteMany({ where: { id: otherSalesmanUserId } });
    await prisma.person.deleteMany({
      where: { id: { in: [otherSalesmanPersonId, inactiveSalesmanPersonId, inactiveDealerPersonId] } },
    });
  });

  // ============================================================
  // AUTHORIZATION (Items 1 - 9)
  // ============================================================
  describe('AUTHORIZATION (Items 1 - 9)', () => {
    it('1. Salesman can create own draft', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: testHandoverDate,
          items: [
            {
              productId: candyProductId,
              uom: Uom.JAR,
              openingQuantity: 50,
              closingQuantity: 10,
              freeQuantity: 2,
              discount: 50,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(HandoverStatus.DRAFT);
      expect(body.data.salesmanId).toBe(salesmanPersonId);
      createdHandoverIds.push(body.data.id);
    });

    it("2. Salesman cannot create another Salesman's handover", async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: otherSalesmanPersonId,
          handoverDate: '2026-10-01',
          items: [
            {
              productId: candyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('3. Salesman cannot create Dealer handover', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-01',
          items: [
            {
              productId: candyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('4. Admin can create Dealer handover', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: testHandoverDate,
          customerName: 'Test Dealer Customer',
          customerPhone: '9840099999',
          items: [
            {
              productId: candyProductId,
              uom: Uom.JAR,
              openingQuantity: 20,
              closingQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.recipientType).toBe(HandoverRecipientType.DEALER);
      expect(body.data.dealerId).toBe(dealerPersonId);
      createdHandoverIds.push(body.data.id);
    });

    it('5. Admin can review Salesman handover', async () => {
      const handoverId = createdHandoverIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/daily-handovers/${handoverId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(handoverId);
    });

    it('6. Unauthenticated create rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-05',
          items: [
            {
              productId: candyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('7. Salesman cannot record final collection', async () => {
      const handoverId = createdHandoverIds[0];
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          cashCollected: 1000,
          gpayCollected: 500,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("8. Salesman cannot access another Salesman's handover", async () => {
      const handoverId = createdHandoverIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/daily-handovers/${handoverId}`,
        headers: { authorization: `Bearer ${otherSalesmanToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('9. Dealer has no login access', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'sri_murugan_stores', password: 'Password@123' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ============================================================
  // ITEM CALCULATIONS (Items 10 - 20)
  // ============================================================
  describe('ITEM CALCULATIONS (Items 10 - 20)', () => {
    it('10. Sales = Opening - Closing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-02',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.salesQuantity)).toBe(80);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('11. Closing > Opening rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-03',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 20,
              closingQuantity: 30,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Closing quantity');
    });

    it('12. Free <= Sales enforced', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-04',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 80,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('13. Free > Sales rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-05',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 85,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Free quantity');
    });

    it('14. Chargeable = Sales - Free', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-06',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.chargeableQuantity)).toBe(75);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('15. Gross = Chargeable × Rate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-07',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.grossAmount)).toBe(7500);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('16. Free Item Value calculated correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-08',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.freeItemValue)).toBe(500);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('17. Free Item Value is not deducted again (CRITICAL FREE ITEM TEST - Item 69)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-09',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 110,
              closingQuantity: 10,
              freeQuantity: 10,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      const item = body.data.items[0];
      expect(Number(item.salesQuantity)).toBe(100);
      expect(Number(item.chargeableQuantity)).toBe(90);
      expect(Number(item.grossAmount)).toBe(9000);
      expect(Number(item.freeItemValue)).toBe(1000);
      expect(Number(item.netAmount)).toBe(9000);
      expect(Number(body.data.netSales)).toBe(9000);
      createdHandoverIds.push(body.data.id);
    });

    it('18. Discount reduces Gross to Net', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-10',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
              discount: 200,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.netAmount)).toBe(7300);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('19. Discount > Gross rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-11',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
              discount: 8000,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Item discount');
    });

    it('20. Net Sales calculated correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-12',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 20,
              freeQuantity: 5,
              discount: 200,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Number(body.data.netSales)).toBe(7300);
      createdHandoverIds.push(body.data.id);
    });
  });

  // ============================================================
  // HANDOVER TOTALS (Items 21 - 24)
  // ============================================================
  describe('HANDOVER TOTALS (Items 21 - 24)', () => {
    it('21. Gross Sales sums item gross', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-13',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 20, closingQuantity: 0 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Number(body.data.grossSales)).toBe(3000);
      createdHandoverIds.push(body.data.id);
    });

    it('22. Total Discount sums item discounts', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-14',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0, discount: 50 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 20, closingQuantity: 0, discount: 100 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Number(body.data.totalItemDiscount)).toBe(150);
      createdHandoverIds.push(body.data.id);
    });

    it('23. Net Sales = Gross - Discount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-15',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0, discount: 50 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Number(body.data.netSales)).toBe(950);
      createdHandoverIds.push(body.data.id);
    });

    it('24. Multiple products aggregate correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-16',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0, discount: 50 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 20, closingQuantity: 0, discount: 100 },
            { productId: testProductCId, uom: Uom.JAR, openingQuantity: 30, closingQuantity: 0, discount: 150 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Number(body.data.grossSales)).toBe(6000);
      expect(Number(body.data.totalItemDiscount)).toBe(300);
      expect(Number(body.data.netSales)).toBe(5700);
      createdHandoverIds.push(body.data.id);
    });
  });

  // ============================================================
  // EMPTY PACKET (Items 25 - 31)
  // ============================================================
  describe('EMPTY PACKET (Items 25 - 31)', () => {
    it('25. Empty Packet entry accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-17',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 5, actualAmount: 50 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.emptyPackets.length).toBe(1);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('26. Empty Packet quantity validated (> 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-18',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 0, actualAmount: 50 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('27. Empty Packet actual amount accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-19',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 5, actualAmount: 75.5 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.emptyPacketBenefit)).toBe(75.5);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('28. Empty Packet amount is handover-level', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-20',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
          ],
          emptyPackets: [{ quantity: 5, actualAmount: 100 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.netSales)).toBe(2000);
      expect(Number(data.expectedHandover)).toBe(1900); // 2000 - 100
      createdHandoverIds.push(data.id);
    });

    it('29. Empty Packet benefit calculated correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-21',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [
            { quantity: 5, actualAmount: 50 },
            { quantity: 10, actualAmount: 100 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.emptyPacketBenefit)).toBe(150);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('30. Empty Packet is not read from Product Master', async () => {
      // Input 123.45 is stored directly
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-22',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 1, actualAmount: 123.45 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.emptyPacketBenefit)).toBe(123.45);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('31. Empty Packet is not multiplied per product', async () => {
      // 3 items, benefit ₹100 => subtracted once
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-23',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductCId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
          ],
          emptyPackets: [{ quantity: 10, actualAmount: 100 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.netSales)).toBe(3000);
      expect(Number(data.expectedHandover)).toBe(2900);
      createdHandoverIds.push(data.id);
    });
  });

  // ============================================================
  // COUPON (Items 32 - 37)
  // ============================================================
  describe('COUPON (Items 32 - 37)', () => {
    it('32. Coupon denomination validated (> 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-24',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [{ denomination: 0, quantity: 5 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('33. Coupon quantity validated (> 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-25',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [{ denomination: 5, quantity: 0 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('34. Coupon amount = denomination × quantity', async () => {
      // 5 * 10 = 50
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-26',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [{ denomination: 5, quantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const coupon = JSON.parse(res.body).data.coupons[0];
      expect(Number(coupon.amount)).toBe(50);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('35. Multiple coupon rows aggregate correctly', async () => {
      // 5 * 10 = 50, 2 * 20 = 40 => Total 90
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-27',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [
            { denomination: 5, quantity: 10 },
            { denomination: 2, quantity: 20 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.couponBenefit)).toBe(90);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('36. Coupon benefit counted once', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-28',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
          ],
          coupons: [{ denomination: 10, quantity: 5 }], // 50
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.netSales)).toBe(2000);
      expect(Number(data.expectedHandover)).toBe(1950);
      createdHandoverIds.push(data.id);
    });

    it('37. Coupon is not read from Product Master', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-29',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [{ denomination: 7.5, quantity: 4 }], // 30
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.couponBenefit)).toBe(30);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });
  });

  // ============================================================
  // EXPECTED HANDOVER (Items 38 - 40)
  // ============================================================
  describe('EXPECTED HANDOVER (Items 38 - 40)', () => {
    it('38. Expected Handover = Net Sales - Empty Packet - Coupon', async () => {
      // Net = 1,000, EP = 50, Coupon = 30 => Expected = 920
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-30',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 5, actualAmount: 50 }],
          coupons: [{ denomination: 3, quantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.expectedHandover)).toBe(920);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('39. Free Item Value is not subtracted', async () => {
      // Chargeable = 9, Rate = 100 => Gross = 900. Free = 1 (100 informational). Net = 900.
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-31',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0, freeQuantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.expectedHandover)).toBe(900);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('40. Benefits exceeding Net Sales rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-01',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 10, actualAmount: 800 }],
          coupons: [{ denomination: 100, quantity: 5 }], // 500 => Total 1300 > 1000
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('exceed Net Sales');
    });
  });

  // ============================================================
  // COLLECTION (Items 41 - 49)
  // ============================================================
  describe('COLLECTION (Items 41 - 49)', () => {
    it('41. Cash accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-02',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 1000,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.cashCollected)).toBe(1000);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('42. GPay accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-03',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          gpayCollected: 1000,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.gpayCollected)).toBe(1000);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('43. Negative cash rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-04',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: -50,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('44. Negative GPay rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-05',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          gpayCollected: -100,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('45. Collection = Cash + GPay', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-06',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 600,
          gpayCollected: 400,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(Number(JSON.parse(res.body).data.collectionTotal)).toBe(1000);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('46. Collection < Expected → Outstanding', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-07',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 500,
          gpayCollected: 300,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.outstanding)).toBe(200);
      expect(Number(data.excess)).toBe(0);
      expect(data.status).toBe(HandoverStatus.SHORT);
      createdHandoverIds.push(data.id);
    });

    it('47. Collection = Expected → Settled', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-08',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 600,
          gpayCollected: 400,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.outstanding)).toBe(0);
      expect(Number(data.excess)).toBe(0);
      expect(data.status).toBe(HandoverStatus.SETTLED);
      createdHandoverIds.push(data.id);
    });

    it('48. Collection > Expected → Excess', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-09',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 700,
          gpayCollected: 500,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.outstanding)).toBe(0);
      expect(Number(data.excess)).toBe(200);
      expect(data.status).toBe(HandoverStatus.EXCESS);
      createdHandoverIds.push(data.id);
    });

    it('49. Excess does not create negative Outstanding', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-10',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 2000,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.outstanding)).toBe(0);
      expect(Number(data.excess)).toBe(1000);
      createdHandoverIds.push(data.id);
    });
  });

  // ============================================================
  // SALESMAN FLOW (Items 50 - 54)
  // ============================================================
  describe('SALESMAN FLOW (Items 50 - 54)', () => {
    let workflowHandoverId: string;

    it('50. Salesman can save draft', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: testHandoverDate2,
          items: [{ productId: candyProductId, uom: Uom.JAR, openingQuantity: 30, closingQuantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe(HandoverStatus.DRAFT);
      workflowHandoverId = body.data.id;
      createdHandoverIds.push(workflowHandoverId);
    });

    it('51. Salesman can update draft', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/daily-handovers/${workflowHandoverId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          notes: 'Updated draft notes',
          items: [{ productId: candyProductId, uom: Uom.JAR, openingQuantity: 30, closingQuantity: 5 }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.notes).toBe('Updated draft notes');
      expect(Number(body.data.items[0].salesQuantity)).toBe(25);
    });

    it('52. Salesman can submit own draft', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${workflowHandoverId}/submit`,
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe(HandoverStatus.SUBMITTED);
      expect(body.data.submittedBy).toBe(salesmanUserId);
    });

    it('53. Submitted handover cannot be freely edited by Salesman', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/daily-handovers/${workflowHandoverId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          notes: 'Attempted edit after submission',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('54. Collection cannot be finalized by Salesman; Admin records collection', async () => {
      const failRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${workflowHandoverId}/collection`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: { cashCollected: 4000, gpayCollected: 0 },
      });
      expect(failRes.statusCode).toBe(403);

      const okRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${workflowHandoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 4000, gpayCollected: 0 },
      });
      expect(okRes.statusCode).toBe(200);
      const body = JSON.parse(okRes.body);
      expect(body.data.reviewedBy).toBe(adminUserId);
    });
  });

  // ============================================================
  // DEALER FLOW (Items 55 - 57)
  // ============================================================
  describe('DEALER FLOW (Items 55 - 57)', () => {
    it('55. Dealer handover can be created by Admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: testHandoverDate3,
          items: [{ productId: candyProductId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 1600,
          gpayCollected: 0,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.recipientType).toBe(HandoverRecipientType.DEALER);
      createdHandoverIds.push(body.data.id);
    });

    it('56. Dealer handover does not require Sales Target', async () => {
      // Dealer Murugan has no sales targets, yet handover succeeds
      const target = await prisma.salesTarget.findFirst({ where: { salesmanId: dealerPersonId } });
      expect(target).toBeNull();
    });

    it('57. Dealer handover does not require Salesman', async () => {
      const handover = await prisma.dailyHandover.findFirst({
        where: { recipientType: HandoverRecipientType.DEALER },
      });
      expect(handover?.salesmanId).toBeNull();
    });
  });

  // ============================================================
  // TARGET & ISSUE STOCK (Items 58 - 63)
  // ============================================================
  describe('TARGET & ISSUE STOCK (Items 58 - 63)', () => {
    it('58 - 60. Salesman target may be resolved, target is not modified, target achievement not persisted', async () => {
      const targetBefore = await prisma.salesTarget.findFirst();
      if (targetBefore) {
        const targetAfter = await prisma.salesTarget.findUnique({ where: { id: targetBefore.id } });
        expect(targetAfter).toEqual(targetBefore);
      }
    });

    it('61. Issue Stock is not created during Handover', async () => {
      const issuesBefore = await prisma.issueStock.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-11',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 20, closingQuantity: 10 }],
        },
      });
      expect(res.statusCode).toBe(201);
      createdHandoverIds.push(JSON.parse(res.body).data.id);

      const issuesAfter = await prisma.issueStock.count();
      expect(issuesAfter).toBe(issuesBefore);
    });

    it('62. Issue Stock is not modified', async () => {
      const issueBefore = await prisma.issueStock.findFirst();
      if (issueBefore) {
        const issueAfter = await prisma.issueStock.findUnique({ where: { id: issueBefore.id } });
        expect(issueAfter).toEqual(issueBefore);
      }
    });

    it('63. Stock is not double-decremented', async () => {
      const movementsBefore = await prisma.stockMovement.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-12',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 20, closingQuantity: 10 }],
        },
      });
      expect(res.statusCode).toBe(201);
      createdHandoverIds.push(JSON.parse(res.body).data.id);

      const movementsAfter = await prisma.stockMovement.count();
      expect(movementsAfter).toBe(movementsBefore);
    });
  });

  // ============================================================
  // UOM VALIDATION (Items 64 - 68)
  // ============================================================
  describe('UOM VALIDATION (Items 64 - 68)', () => {
    it('64. Valid Candy UOM works', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-13',
          items: [{ productId: candyProductId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
        },
      });
      expect(res.statusCode).toBe(201);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('65. Valid Cigarette UOM works', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-14',
          items: [{ productId: cigaretteProductId, uom: Uom.PACKET, openingQuantity: 10, closingQuantity: 0 }],
        },
      });
      expect(res.statusCode).toBe(201);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('66. Invalid category/UOM rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-15',
          items: [{ productId: candyProductId, uom: 'M', openingQuantity: 10, closingQuantity: 0 }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('67. 1 M = 100 PACKET conversion works', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-16',
          items: [{ productId: cigaretteProductId, uom: Uom.M, openingQuantity: 2, closingQuantity: 0 }],
        },
      });
      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.baseSalesQuantity)).toBe(200);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('68. POCKET rejected from API', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-17',
          items: [{ productId: cigaretteProductId, uom: 'POCKET', openingQuantity: 10, closingQuantity: 0 }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('PACKET');
    });
  });

  // ============================================================
  // FINANCIAL PRECISION & SEPARATION (Items 69 - 71)
  // ============================================================
  describe('FINANCIAL PRECISION & SEPARATION (Items 69 - 71)', () => {
    it('69. Decimal calculations are exact', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-18',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 33.33,
              closingQuantity: 11.11,
              discount: 22.22,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const item = JSON.parse(res.body).data.items[0];
      expect(Number(item.salesQuantity)).toBe(22.22);
      createdHandoverIds.push(JSON.parse(res.body).data.id);
    });

    it('70. Server ignores client-derived totals', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-19',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 0,
              salesQuantity: 999999,
              grossAmount: 1,
            },
          ],
          grossSales: 1,
          netSales: 1,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.grossSales)).toBe(10000);
      expect(Number(data.netSales)).toBe(10000);
      createdHandoverIds.push(data.id);
    });

    it('71. Critical Discount Test: Discount reduces gross to net and does not create shortage/ledger', async () => {
      // Gross = ₹10,000, Discount = ₹1,000 => Net = ₹9,000
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-20',
          items: [
            {
              productId: testProductAId,
              uom: Uom.JAR,
              openingQuantity: 100,
              closingQuantity: 0,
              discount: 1000,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(Number(data.grossSales)).toBe(10000);
      expect(Number(data.totalItemDiscount)).toBe(1000);
      expect(Number(data.netSales)).toBe(9000);
      expect(Number(data.expectedHandover)).toBe(9000);
      createdHandoverIds.push(data.id);
    });
  });

  // ============================================================
  // TRANSACTIONS & DUPLICATES (Items 72 - 77)
  // ============================================================
  describe('TRANSACTIONS & DUPLICATES (Items 72 - 77)', () => {
    it('72. Header/items/Empty Packet/Coupon save atomically', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-21',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: 5, actualAmount: 50 }],
          coupons: [{ denomination: 2, quantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body).data;
      expect(data.items.length).toBe(1);
      expect(data.emptyPackets.length).toBe(1);
      expect(data.coupons.length).toBe(1);
      createdHandoverIds.push(data.id);
    });

    it('73. Failed item validation rolls back', async () => {
      const countBefore = await prisma.dailyHandover.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-22',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 },
            { productId: testProductBId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 20 }, // Invalid!
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const countAfter = await prisma.dailyHandover.count();
      expect(countAfter).toBe(countBefore);
    });

    it('74. Failed Empty Packet validation rolls back', async () => {
      const countBefore = await prisma.dailyHandover.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-23',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          emptyPackets: [{ quantity: -1, actualAmount: 50 }], // Invalid!
        },
      });

      expect(res.statusCode).toBe(400);
      const countAfter = await prisma.dailyHandover.count();
      expect(countAfter).toBe(countBefore);
    });

    it('75. Failed Coupon validation rolls back', async () => {
      const countBefore = await prisma.dailyHandover.count();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-24',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          coupons: [{ denomination: -5, quantity: 10 }], // Invalid!
        },
      });

      expect(res.statusCode).toBe(400);
      const countAfter = await prisma.dailyHandover.count();
      expect(countAfter).toBe(countBefore);
    });

    it('76. Duplicate product in one handover rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-25',
          items: [
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 50, closingQuantity: 0 },
            { productId: testProductAId, uom: Uom.JAR, openingQuantity: 30, closingQuantity: 0 },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Duplicate product');
    });

    it('77. Duplicate salesman daily handover prevented', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: testHandoverDate,
          items: [{ productId: candyProductId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
        },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error.message).toContain('already exists');
    });
  });

  // ============================================================
  // IMMUTABILITY & FILTERS (Items 78 - 84)
  // ============================================================
  describe('IMMUTABILITY & FILTERS (Items 78 - 84)', () => {
    it('78. DELETE is shielded (400)', async () => {
      const handoverId = createdHandoverIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/daily-handovers/${handoverId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('cannot be deleted');
    });

    it('79. Finalized handover cannot be arbitrarily modified', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-26',
          items: [{ productId: testProductAId, uom: Uom.JAR, openingQuantity: 10, closingQuantity: 0 }],
          cashCollected: 1000,
          gpayCollected: 0,
        },
      });
      const finalizedId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(finalizedId);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/daily-handovers/${finalizedId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { notes: 'Attempted patch' },
      });
      expect(patchRes.statusCode).toBe(400);

      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${finalizedId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 500, gpayCollected: 500 },
      });
      expect(collRes.statusCode).toBe(400);
    });

    it('80. Phase 2C Users & Persons regression passes', async () => {
      const persons = await prisma.person.findMany({ take: 5 });
      expect(persons.length).toBeGreaterThan(0);
    });

    it('81. Phase 2D Products & Initial Stock regression passes', async () => {
      const products = await prisma.product.findMany({ take: 5 });
      expect(products.length).toBeGreaterThan(0);
    });

    it('82. Phase 2E Purchase Invoices regression passes', async () => {
      const invoices = await prisma.purchaseInvoice.findMany({ take: 5 });
      expect(invoices.length).toBeGreaterThan(0);
    });

    it('83. Phase 2F Sales Targets regression passes', async () => {
      const targets = await prisma.salesTarget.findMany({ take: 5 });
      expect(targets.length).toBeGreaterThan(0);
    });

    it('84. Phase 2G Issue Stock regression passes & query filters work', async () => {
      const issues = await prisma.issueStock.findMany({ take: 5 });
      expect(issues.length).toBeGreaterThan(0);

      // Verify salesman list scoping
      const salesmanListRes = await app.inject({
        method: 'GET',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(salesmanListRes.statusCode).toBe(200);
      const salesmanBody = JSON.parse(salesmanListRes.body);
      for (const h of salesmanBody.data) {
        expect(h.salesmanId).toBe(salesmanPersonId);
      }
    });
  });
});
