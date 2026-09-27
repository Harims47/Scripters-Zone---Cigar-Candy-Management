import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import {
  PersonType,
  UserRole,
  ProductCategory,
  Uom,
  HandoverRecipientType,
  HandoverStatus,
  ExpenseCategory,
} from '@prisma/client';

describe('Phase 2J: Expenses Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;

  let adminUserId: string;
  let salesmanUserId: string;
  let salesmanPersonId: string;
  let dealerPersonId: string;

  let testCandyProductId1: string;
  let testCandyProductId2: string;

  const createdExpenseIds: string[] = [];
  const createdHandoverIds: string[] = [];

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

    // 3. Active Dealer
    const dealerPerson = await prisma.person.findFirst({
      where: { type: PersonType.DEALER, active: true },
    });
    if (!dealerPerson) {
      throw new Error('No active dealer found in database seed');
    }
    dealerPersonId = dealerPerson.id;

    // 4. Products for Handover testing (Candy with JAR UOM)
    const candyProducts = await prisma.product.findMany({
      where: { category: ProductCategory.CANDY, active: true },
      take: 2,
    });
    testCandyProductId1 = candyProducts[0].id;
    testCandyProductId2 = candyProducts[1]?.id || candyProducts[0].id;
  });

  afterAll(async () => {
    if (createdExpenseIds.length > 0) {
      await prisma.expense.deleteMany({
        where: { id: { in: createdExpenseIds } },
      });
    }

    if (createdHandoverIds.length > 0) {
      await prisma.salesmanLedgerTransaction.deleteMany({
        where: { dailyHandoverId: { in: createdHandoverIds } },
      });
      await prisma.dailyHandoverCoupon.deleteMany({
        where: { handoverId: { in: createdHandoverIds } },
      });
      await prisma.dailyHandoverEmptyPacket.deleteMany({
        where: { handoverId: { in: createdHandoverIds } },
      });
      await prisma.dailyHandoverItem.deleteMany({
        where: { handoverId: { in: createdHandoverIds } },
      });
      await prisma.dailyHandover.deleteMany({
        where: { id: { in: createdHandoverIds } },
      });
    }
  });

  // ============================================================
  // GROUP 1: SCHEMA & DATA MODEL (Item 1)
  // ============================================================
  describe('Group 1: Schema & Data Model', () => {
    it('1. Migration / Schema works with proper ExpenseCategory enum values and table structure', async () => {
      expect(ExpenseCategory.OFFICE).toBe('OFFICE');
      expect(ExpenseCategory.HOUSE).toBe('HOUSE');
      expect(ExpenseCategory.GPI).toBe('GPI');

      const count = await prisma.expense.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // GROUP 2: MANUAL EXPENSE CREATION & VALIDATION (Items 2-11, 21)
  // ============================================================
  describe('Group 2: Manual Expense Creation & Validation', () => {
    it('2. Admin can create OFFICE expense', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-01',
          category: 'OFFICE',
          amount: 1500,
          notes: 'Office broadband subscription',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('OFFICE');
      expect(body.data.amount).toBe(1500);
      expect(body.data.notes).toBe('Office broadband subscription');
      expect(body.data.expenseDate).toBe('2026-11-01');
      expect(body.data.createdBy).toBe(adminUserId); // Item 21
      createdExpenseIds.push(body.data.id);
    });

    it('3. Admin can create HOUSE expense', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-02',
          category: 'HOUSE',
          amount: 750,
          notes: 'Guest house electricity bill',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('HOUSE');
      expect(body.data.amount).toBe(750);
      createdExpenseIds.push(body.data.id);
    });

    it('4. Admin can create GPI expense', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-03',
          category: 'GPI',
          amount: 400,
          notes: 'GPI vehicle petrol allowance',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('GPI');
      expect(body.data.amount).toBe(400);
      createdExpenseIds.push(body.data.id);
    });

    it('5. Amount must be > 0 (zero and negative rejected)', async () => {
      const resZero = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'OFFICE',
          amount: 0,
          notes: 'Zero amount test',
        },
      });
      expect(resZero.statusCode).toBe(400);

      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'OFFICE',
          amount: -500,
          notes: 'Negative amount test',
        },
      });
      expect(resNeg.statusCode).toBe(400);
    });

    it('6. Notes are required and mandatory', async () => {
      // Missing notes
      const resMissing = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'OFFICE',
          amount: 100,
        },
      });
      expect(resMissing.statusCode).toBe(400);

      // Empty string notes
      const resEmpty = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'OFFICE',
          amount: 100,
          notes: '   ',
        },
      });
      expect(resEmpty.statusCode).toBe(400);
    });

    it('7. Expense date is required and must follow YYYY-MM-DD', async () => {
      // Missing date
      const resMissing = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'OFFICE',
          amount: 100,
          notes: 'Date missing test',
        },
      });
      expect(resMissing.statusCode).toBe(400);

      // Invalid format
      const resInvalid = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '11-04-2026',
          category: 'OFFICE',
          amount: 100,
          notes: 'Date invalid format test',
        },
      });
      expect(resInvalid.statusCode).toBe(400);
    });

    it('8. Invalid category rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'TRAVEL',
          amount: 100,
          notes: 'Invalid category test',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('9. EMPTY_PACKET cannot be manually created', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'EMPTY_PACKET',
          amount: 100,
          notes: 'Manual empty packet attempt',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('EMPTY_PACKET cannot be manually created');
    });

    it('10. COUPON cannot be manually created', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'COUPON',
          amount: 100,
          notes: 'Manual coupon attempt',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('COUPON cannot be manually created');
    });

    it('11. DISCOUNT cannot be manually created', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          expenseDate: '2026-11-04',
          category: 'DISCOUNT',
          amount: 100,
          notes: 'Manual discount attempt',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('DISCOUNT cannot be manually created');
    });
  });

  // ============================================================
  // GROUP 3: AUTHORIZATION & PERMISSIONS (Items 12-14)
  // ============================================================
  describe('Group 3: Authorization & Permissions', () => {
    it('12. Salesman cannot create expense (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          expenseDate: '2026-11-05',
          category: 'OFFICE',
          amount: 200,
          notes: 'Salesman unauthorized expense',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('13. Dealer cannot create expense (Dealer has no login/token)', async () => {
      // Dealers have no user accounts in the system. An unauthorized attempt returns 401.
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        headers: { authorization: 'Bearer invalid_dealer_token' },
        payload: {
          expenseDate: '2026-11-05',
          category: 'OFFICE',
          amount: 200,
          notes: 'Dealer unauthorized expense',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('14. Unauthenticated request returns 401 Unauthorized', async () => {
      const resPost = await app.inject({
        method: 'POST',
        url: '/api/v1/expenses',
        payload: {
          expenseDate: '2026-11-05',
          category: 'OFFICE',
          amount: 200,
          notes: 'Unauthenticated test',
        },
      });
      expect(resPost.statusCode).toBe(401);

      const resGet = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses',
      });
      expect(resGet.statusCode).toBe(401);

      const resSummary = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary',
      });
      expect(resSummary.statusCode).toBe(401);
    });
  });

  // ============================================================
  // GROUP 4: RETRIEVAL & FILTERING (Items 15-18)
  // ============================================================
  describe('Group 4: Retrieval & Filtering', () => {
    it('15. Admin can list expenses with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it('16. Date filter works accurately', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses?fromDate=2026-11-01&toDate=2026-11-01',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const exp of body.data) {
        expect(exp.expenseDate).toBe('2026-11-01');
      }
    });

    it('17. Category filter works accurately', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses?category=HOUSE',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const exp of body.data) {
        expect(exp.category).toBe('HOUSE');
      }
    });

    it('18. Admin can retrieve one expense by ID', async () => {
      const expenseId = createdExpenseIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(expenseId);
      expect(body.data.category).toBe('OFFICE');
      expect(body.data.amount).toBe(1500);
    });
  });

  // ============================================================
  // GROUP 5: IMMUTABILITY (Items 19-20)
  // ============================================================
  describe('Group 5: Immutability', () => {
    it('19. PATCH is rejected (400 Bad Request)', async () => {
      const expenseId = createdExpenseIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { amount: 9999 },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('20. DELETE is rejected (400 Bad Request)', async () => {
      const expenseId = createdExpenseIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/expenses/${expenseId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });
  });

  // ============================================================
  // GROUP 6: CONSOLIDATED EXPENSE SUMMARY & DERIVATIONS (Items 22-32, 42, 45)
  // ============================================================
  describe('Group 6: Consolidated Expense Summary & Accounting Derivations', () => {
    const summaryFromDate = '2026-11-20';
    const summaryToDate = '2026-11-20';

    beforeAll(async () => {
      // 1. Create controlled manual expenses for the target date
      const [e1, e2, e3] = await Promise.all([
        prisma.expense.create({
          data: {
            expenseDate: new Date('2026-11-20T00:00:00.000Z'),
            category: ExpenseCategory.OFFICE,
            amount: '2000.00',
            notes: 'Test Office Expense',
            createdBy: adminUserId,
          },
        }),
        prisma.expense.create({
          data: {
            expenseDate: new Date('2026-11-20T00:00:00.000Z'),
            category: ExpenseCategory.HOUSE,
            amount: '1000.00',
            notes: 'Test House Expense',
            createdBy: adminUserId,
          },
        }),
        prisma.expense.create({
          data: {
            expenseDate: new Date('2026-11-20T00:00:00.000Z'),
            category: ExpenseCategory.GPI,
            amount: '500.00',
            notes: 'Test GPI Expense',
            createdBy: adminUserId,
          },
        }),
      ]);
      createdExpenseIds.push(e1.id, e2.id, e3.id);

      // 2. Create a SUBMITTED Daily Handover on target date with:
      // - Item discount: 250
      // - Empty packet: 80
      // - Coupon: 40
      const handoverRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-20',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 250,
            },
          ],
          emptyPackets: [
            {
              productId: testCandyProductId1,
              quantity: 8,
              actualAmount: 80,
            },
          ],
          coupons: [
            {
              denomination: 20,
              quantity: 2,
            },
          ],
        },
      });
      const handoverId = JSON.parse(handoverRes.body).data.id;
      createdHandoverIds.push(handoverId);
    });

    it('22. OFFICE summary is correct', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.office).toBe(2000);
    });

    it('23. HOUSE summary is correct', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.house).toBe(1000);
    });

    it('24. GPI summary is correct', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.gpi).toBe(500);
    });

    it('25. Empty Packet summary comes from Daily Handover (80)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.emptyPacket).toBe(80);
    });

    it('26. Coupon summary comes from Daily Handover (20 * 2 = 40)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.coupon).toBe(40);
    });

    it('27. Discount summary comes from Daily Handover item discounts (250)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.discount).toBe(250);
    });

    it('28, 29, 30, 31. operatingExpenses includes Office, House, GPI, Empty Packet, Coupon, but strictly EXCLUDES Discount', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      // Office (2000) + House (1000) + GPI (500) + EmptyPacket (80) + Coupon (40) = 3620
      expect(body.data.operatingExpenses).toBe(3620);
      expect(body.data.totalExpenseImpact).toBe(3620);
      // totalCompanyCostImpact includes discount: 3620 + 250 = 3870
      expect(body.data.totalCompanyCostImpact).toBe(3870);
    });

    it('32 & 44. Summary date filtering isolates dates properly', async () => {
      // Query before target date -> all should be 0
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-19&toDate=2026-11-19',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.data.office).toBe(0);
      expect(body.data.emptyPacket).toBe(0);
      expect(body.data.operatingExpenses).toBe(0);
    });

    it('42. Decimal monetary calculations remain exact without floating-point artifacts', async () => {
      const precExp = await prisma.expense.create({
        data: {
          expenseDate: new Date('2026-11-21T00:00:00.000Z'),
          category: ExpenseCategory.OFFICE,
          amount: '0.10',
          notes: 'Precision test 1',
          createdBy: adminUserId,
        },
      });
      const precExp2 = await prisma.expense.create({
        data: {
          expenseDate: new Date('2026-11-21T00:00:00.000Z'),
          category: ExpenseCategory.OFFICE,
          amount: '0.20',
          notes: 'Precision test 2',
          createdBy: adminUserId,
        },
      });
      createdExpenseIds.push(precExp.id, precExp2.id);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-21&toDate=2026-11-21',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      // In JS, 0.1 + 0.2 = 0.30000000000000004. With Decimal, it must be exactly 0.3
      expect(body.data.office).toBe(0.3);
      expect(body.data.operatingExpenses).toBe(0.3);
    });

    it('45. Manual expense and derived expense totals remain independent', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/expenses/summary?fromDate=${summaryFromDate}&toDate=${summaryToDate}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      const manualSum = body.data.office + body.data.house + body.data.gpi;
      const derivedBenefitSum = body.data.emptyPacket + body.data.coupon;

      expect(manualSum).toBe(3500);
      expect(derivedBenefitSum).toBe(120);
      expect(body.data.operatingExpenses).toBe(manualSum + derivedBenefitSum);
    });
  });

  // ============================================================
  // GROUP 7: HANDOVER LIFECYCLE & MULTI-PRODUCT AGGREGATIONS (Items 33-41, 43, 46)
  // ============================================================
  describe('Group 7: Handover Lifecycle & Multi-Product Derivations', () => {
    it('33. Draft/invalid handovers are NOT counted in derived expenses', async () => {
      const draftRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-25',
          status: HandoverStatus.DRAFT, // DRAFT
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 300,
            },
          ],
          emptyPackets: [
            {
              productId: testCandyProductId1,
              quantity: 10,
              actualAmount: 100,
            },
          ],
          coupons: [
            {
              denomination: 10,
              quantity: 5,
            },
          ],
        },
      });
      const draftId = JSON.parse(draftRes.body).data.id;
      createdHandoverIds.push(draftId);

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-25&toDate=2026-11-25',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);
      // DRAFT handover must NOT contribute to expenses
      expect(body.data.discount).toBe(0);
      expect(body.data.emptyPacket).toBe(0);
      expect(body.data.coupon).toBe(0);
    });

    it('34. Settled salesman handover contributes derived expenses', async () => {
      const handoverRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-26',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 50,
            },
          ],
          emptyPackets: [{ productId: testCandyProductId1, quantity: 2, actualAmount: 20 }],
        },
      });
      const handoverData = JSON.parse(handoverRes.body).data;
      const handoverId = handoverData.id;
      const expectedHandover = Number(handoverData.expectedHandover);
      createdHandoverIds.push(handoverId);

      // Record full collection
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: expectedHandover, gpayCollected: 0 },
      });
      expect(JSON.parse(collRes.body).data.status).toBe('SETTLED');

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-26&toDate=2026-11-26',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);
      expect(body.data.discount).toBe(50);
      expect(body.data.emptyPacket).toBe(20);
    });

    it('35. Short salesman handover contributes derived expenses', async () => {
      const handoverRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-27',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 75,
            },
          ],
          coupons: [{ denomination: 25, quantity: 1 }],
        },
      });
      const handoverId = JSON.parse(handoverRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Short collection: expected 1500, paid 1000 -> SHORT
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 1000, gpayCollected: 0 },
      });
      expect(JSON.parse(collRes.body).data.status).toBe('SHORT');

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-27&toDate=2026-11-27',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);
      expect(body.data.discount).toBe(75);
      expect(body.data.coupon).toBe(25);
    });

    it('36. Excess salesman handover contributes derived expenses', async () => {
      const handoverRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-28',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 5,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 30,
            },
          ],
          emptyPackets: [{ productId: testCandyProductId1, quantity: 1, actualAmount: 15 }],
        },
      });
      const handoverData = JSON.parse(handoverRes.body).data;
      const handoverId = handoverData.id;
      const expectedHandover = Number(handoverData.expectedHandover);
      createdHandoverIds.push(handoverId);

      // Excess collection: paid expectedHandover + 100 -> EXCESS
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: expectedHandover + 100, gpayCollected: 0 },
      });
      expect(JSON.parse(collRes.body).data.status).toBe('EXCESS');

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-28&toDate=2026-11-28',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);
      expect(body.data.discount).toBe(30);
      expect(body.data.emptyPacket).toBe(15);
    });

    it('37 & 38. Dealer handover contributes derived expenses but creates NO salesman ledger transaction', async () => {
      const dealerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-11-29',
          status: HandoverStatus.SUBMITTED,
          customerName: 'Dealer Cashier',
          customerPhone: '9840011222',
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 120,
            },
          ],
          emptyPackets: [{ productId: testCandyProductId1, quantity: 5, actualAmount: 60 }],
          coupons: [{ denomination: 15, quantity: 2 }],
        },
      });
      const handoverId = JSON.parse(dealerRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Settle dealer collection
      await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 1390, gpayCollected: 0 },
      });

      // Item 37: Verify NO salesman ledger entry was created for dealer handover
      const ledgerTxs = await prisma.salesmanLedgerTransaction.findMany({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTxs).toHaveLength(0);

      // Item 38: Verify dealer derived expense values are aggregated correctly
      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-29&toDate=2026-11-29',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);
      expect(body.data.discount).toBe(120);
      expect(body.data.emptyPacket).toBe(60);
      expect(body.data.coupon).toBe(30);
    });

    it('39, 40, 41, 46. Multiple products discounts summed once; Empty Packet & Coupon NOT multiplied by product count', async () => {
      // Handover with 2 products:
      // Product 1 discount: 80
      // Product 2 discount: 45
      // Empty packet: 1 row with actualAmount: 35
      // Coupon: 1 row with amount: 20
      const handoverRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-11-30',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId1,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 80, // Product 1
            },
            {
              productId: testCandyProductId2,
              uom: Uom.JAR,
              openingQuantity: 5,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 45, // Product 2
            },
          ],
          emptyPackets: [{ productId: testCandyProductId1, quantity: 3, actualAmount: 35 }],
          coupons: [{ denomination: 10, quantity: 2 }],
        },
      });
      const handoverId = JSON.parse(handoverRes.body).data.id;
      createdHandoverIds.push(handoverId);

      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-30&toDate=2026-11-30',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);

      // Item 39: Multiple products' discounts summed exactly once (80 + 45 = 125)
      expect(body.data.discount).toBe(125);
      // Item 40: Empty Packet is NOT multiplied by product count (must be exactly 35, not 70)
      expect(body.data.emptyPacket).toBe(35);
      // Item 41: Coupon is NOT multiplied by product count (must be exactly 20, not 40)
      expect(body.data.coupon).toBe(20);
      // Item 46: No duplicate derived expense counting
      expect(body.data.operatingExpenses).toBe(55); // 35 EP + 20 Cpn (discount excluded)
    });

    it('43. Multiple handovers aggregate correctly across range', async () => {
      // Query from 2026-11-26 to 2026-11-30
      // Discount sum: 50 (Nov 26) + 75 (Nov 27) + 30 (Nov 28) + 120 (Nov 29) + 125 (Nov 30) = 400
      // EmptyPacket sum: 20 (Nov 26) + 15 (Nov 28) + 60 (Nov 29) + 35 (Nov 30) = 130
      // Coupon sum: 25 (Nov 27) + 30 (Nov 29) + 20 (Nov 30) = 75
      const summaryRes = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary?fromDate=2026-11-26&toDate=2026-11-30',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(summaryRes.body);

      expect(body.data.discount).toBe(400);
      expect(body.data.emptyPacket).toBe(130);
      expect(body.data.coupon).toBe(75);
      expect(body.data.operatingExpenses).toBe(130 + 75); // 205
      expect(body.data.totalCompanyCostImpact).toBe(205 + 400); // 605
    });
  });

  // ============================================================
  // GROUP 8: REGRESSION & INTEGRITY (Items 47-49)
  // ============================================================
  describe('Group 8: Regression & Integrity', () => {
    it('47. Seed is idempotent and seeded expenses exist', async () => {
      const officeSeed = await prisma.expense.findFirst({
        where: { category: ExpenseCategory.OFFICE, notes: 'Office internet and stationary' },
      });
      expect(officeSeed).not.toBeNull();
      expect(Number(officeSeed!.amount)).toBe(1200);

      const houseSeed = await prisma.expense.findFirst({
        where: { category: ExpenseCategory.HOUSE, notes: 'House maintenance supplies' },
      });
      expect(houseSeed).not.toBeNull();
      expect(Number(houseSeed!.amount)).toBe(800);

      const gpiSeed = await prisma.expense.findFirst({
        where: { category: ExpenseCategory.GPI, notes: 'GPI field logistics expense' },
      });
      expect(gpiSeed).not.toBeNull();
      expect(Number(gpiSeed!.amount)).toBe(500);
    });

    it('48. Existing Phase 2I salesman ledger behavior remains intact', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('openingBalance');
      expect(body.data).toHaveProperty('closingBalance');
    });

    it('49. Existing Phase 2H Daily Handover behavior remains intact', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
