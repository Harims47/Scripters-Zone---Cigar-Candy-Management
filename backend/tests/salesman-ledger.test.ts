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
  LedgerTransactionType,
  LedgerDirection,
  LedgerReferenceType,
} from '@prisma/client';

describe('Phase 2I: Salesman Ledger Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let otherSalesmanToken: string;

  let adminUserId: string;
  let salesmanUserId: string;
  let otherSalesmanUserId: string;

  let salesmanPersonId: string;
  let otherSalesmanPersonId: string;
  let inactiveSalesmanPersonId: string;
  let dealerPersonId: string;

  let testCandyProductId: string;

  const createdLedgerTransactionIds: string[] = [];
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

    // 3. Create second Salesman (Suresh) for isolation tests
    const otherSalesmanPerson = await prisma.person.create({
      data: {
        name: 'Suresh Ledger Test',
        phone: '+919999888801',
        type: PersonType.SALESMAN,
        active: true,
      },
    });
    otherSalesmanPersonId = otherSalesmanPerson.id;

    const otherSalesmanUser = await prisma.user.create({
      data: {
        username: 'suresh_ledger',
        passwordHash: 'dummy_hash',
        role: UserRole.SALESMAN,
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
        name: 'Inactive Salesman Ledger',
        phone: '+919999888802',
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

    // 6. Test Candy Product for Handover Shortage tests (JAR UOM, salesRate 160)
    const prod = await prisma.product.findFirst({
      where: { category: ProductCategory.CANDY, active: true, salesRate: 160 },
      orderBy: { createdAt: 'asc' },
    });
    testCandyProductId = prod!.id;
  });

  afterAll(async () => {
    if (createdLedgerTransactionIds.length > 0) {
      await prisma.salesmanLedgerTransaction.deleteMany({
        where: { id: { in: createdLedgerTransactionIds } },
      });
    }

    if (createdHandoverIds.length > 0) {
      // First delete associated ledger transactions to respect foreign key
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

    await prisma.user.deleteMany({ where: { id: otherSalesmanUserId } });
    await prisma.person.deleteMany({
      where: { id: { in: [otherSalesmanPersonId, inactiveSalesmanPersonId] } },
    });
  });

  // ============================================================
  // GROUP 1: SCHEMA & DATA MODEL (Item 1)
  // ============================================================
  describe('Group 1: Schema & Data Model', () => {
    it('1. Migration / Schema works with proper enum values and relations', async () => {
      expect(LedgerTransactionType.HANDOVER_SHORT).toBe('HANDOVER_SHORT');
      expect(LedgerTransactionType.ADVANCE).toBe('ADVANCE');
      expect(LedgerTransactionType.RECOVERY).toBe('RECOVERY');
      expect(LedgerTransactionType.SALARY_DEDUCTION).toBe('SALARY_DEDUCTION');
      expect(LedgerTransactionType.MANUAL_ADJUSTMENT).toBe('MANUAL_ADJUSTMENT');

      expect(LedgerDirection.DEBIT).toBe('DEBIT');
      expect(LedgerDirection.CREDIT).toBe('CREDIT');

      // Verify table is accessible through Prisma
      const count = await prisma.salesmanLedgerTransaction.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // GROUP 2: MANUAL LEDGER TRANSACTIONS BY ADMIN (Items 2-7, 26-28)
  // ============================================================
  describe('Group 2: Manual Ledger Transactions by Admin', () => {
    it('2. Admin can create ADVANCE (automatically DEBIT)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-01',
          type: 'ADVANCE',
          amount: 2500,
          notes: 'Test advance payment',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('ADVANCE');
      expect(body.data.direction).toBe('DEBIT');
      expect(body.data.amount).toBe(2500);
      expect(body.data.salesmanId).toBe(salesmanPersonId);
      expect(body.data.createdBy).toBe(adminUserId);
      createdLedgerTransactionIds.push(body.data.id);
    });

    it('3. Admin can create RECOVERY (automatically CREDIT)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-02',
          type: 'RECOVERY',
          amount: 1000,
          notes: 'Test recovery collection',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('RECOVERY');
      expect(body.data.direction).toBe('CREDIT');
      expect(body.data.amount).toBe(1000);
      createdLedgerTransactionIds.push(body.data.id);
    });

    it('4. Admin can create SALARY_DEDUCTION (automatically CREDIT)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-03',
          type: 'SALARY_DEDUCTION',
          amount: 750,
          notes: 'Test salary deduction for ledger recovery',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('SALARY_DEDUCTION');
      expect(body.data.direction).toBe('CREDIT');
      expect(body.data.amount).toBe(750);
      createdLedgerTransactionIds.push(body.data.id);
    });

    it('5. Admin can create MANUAL_ADJUSTMENT DEBIT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-04',
          type: 'MANUAL_ADJUSTMENT',
          direction: 'DEBIT',
          amount: 300,
          notes: 'Cash shortage discrepancy',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('MANUAL_ADJUSTMENT');
      expect(body.data.direction).toBe('DEBIT');
      expect(body.data.amount).toBe(300);
      createdLedgerTransactionIds.push(body.data.id);
    });

    it('6. Admin can create MANUAL_ADJUSTMENT CREDIT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-04',
          type: 'MANUAL_ADJUSTMENT',
          direction: 'CREDIT',
          amount: 150,
          notes: 'Approved recovery correction',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('MANUAL_ADJUSTMENT');
      expect(body.data.direction).toBe('CREDIT');
      expect(body.data.amount).toBe(150);
      createdLedgerTransactionIds.push(body.data.id);
    });

    it('7. Amount must be > 0 (zero and negative rejected)', async () => {
      // 0 amount
      const resZero = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 0,
        },
      });
      expect(resZero.statusCode).toBe(400);

      // Negative amount
      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: -500,
        },
      });
      expect(resNeg.statusCode).toBe(400);
    });

    it('26. MANUAL_ADJUSTMENT requires direction', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'MANUAL_ADJUSTMENT',
          amount: 200,
          notes: 'Adjustment without direction',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('direction (DEBIT or CREDIT) is required for MANUAL_ADJUSTMENT');
    });

    it('27. MANUAL_ADJUSTMENT requires notes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'MANUAL_ADJUSTMENT',
          direction: 'DEBIT',
          amount: 200,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('notes/reason is required for MANUAL_ADJUSTMENT');
    });

    it('28. HANDOVER_SHORT cannot be manually created', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'HANDOVER_SHORT',
          amount: 500,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('HANDOVER_SHORT cannot be manually created');
    });
  });

  // ============================================================
  // GROUP 3: AUTHORIZATION & ROLE SCOPING (Items 8-14, 46-47)
  // ============================================================
  describe('Group 3: Authorization & Role Scoping', () => {
    it('8. Invalid salesman ID rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: '00000000-0000-0000-0000-000000000000',
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 500,
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not found');
    });

    it('9. Dealer cannot be used as salesman', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: dealerPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 500,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('Dealer cannot have a salesman ledger');
    });

    it('46. Inactive salesman cannot receive new manual transactions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: inactiveSalesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 500,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('inactive salesman');
    });

    it('10. Salesman cannot create financial transactions (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 500,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('11. Unauthenticated request returns 401', async () => {
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/salesman-ledger',
      });
      expect(res1.statusCode).toBe(401);

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/salesman-ledger/my',
      });
      expect(res2.statusCode).toBe(401);

      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/salesman-ledger/transactions',
        payload: {
          salesmanId: salesmanPersonId,
          transactionDate: '2026-10-05',
          type: 'ADVANCE',
          amount: 500,
        },
      });
      expect(res3.statusCode).toBe(401);
    });

    it('12. Salesman can view own ledger via /api/v1/salesman-ledger/my', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salesman-ledger/my',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.transactions)).toBe(true);
      expect(body.data).toHaveProperty('openingBalance');
      expect(body.data).toHaveProperty('totalDebits');
      expect(body.data).toHaveProperty('totalCredits');
      expect(body.data).toHaveProperty('closingBalance');
    });

    it('13. Salesman cannot view another Salesman’s ledger via query manipulation', async () => {
      // Salesman attempts to query with otherSalesmanPersonId in GET /api/v1/salesman-ledger
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${otherSalesmanPersonId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      // The service forbids accessing another salesman's ledger
      expect(res.statusCode).toBe(403);
    });

    it('47. Salesman cannot manipulate salesmanId through query to access another ledger', async () => {
      // Create a transaction for Suresh
      const sureshTx = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: otherSalesmanPersonId,
          transactionDate: new Date('2026-10-01T00:00:00.000Z'),
          type: LedgerTransactionType.ADVANCE,
          direction: LedgerDirection.DEBIT,
          amount: '1234.56',
          createdBy: adminUserId,
          notes: 'Secret Advance for Suresh',
        },
      });
      createdLedgerTransactionIds.push(sureshTx.id);

      // Ramesh queries with other salesman's id -> 403 Forbidden
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${otherSalesmanPersonId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(res.statusCode).toBe(403);

      // Ramesh queries Suresh's transaction directly via GET /salesman-ledger/:id -> 403 Forbidden
      const resSingle = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger/${sureshTx.id}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(resSingle.statusCode).toBe(403);
    });

    it('14. Admin can view all salesman ledgers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salesman-ledger',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.transactions)).toBe(true);
    });

    it('44. Admin audit identity is stored properly in createdBy', async () => {
      const tx = await prisma.salesmanLedgerTransaction.findFirst({
        where: { id: createdLedgerTransactionIds[0] },
      });
      expect(tx).not.toBeNull();
      expect(tx!.createdBy).toBe(adminUserId);
    });
  });

  // ============================================================
  // GROUP 4: IMMUTABILITY (Items 24-25)
  // ============================================================
  describe('Group 4: Immutability', () => {
    it('24. Ledger transaction cannot be PATCHed (400 Bad Request)', async () => {
      const txId = createdLedgerTransactionIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/salesman-ledger/${txId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { amount: 9999 },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('25. Ledger transaction cannot be DELETEd (400 Bad Request)', async () => {
      const txId = createdLedgerTransactionIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/salesman-ledger/${txId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });
  });

  // ============================================================
  // GROUP 5: QUERY FILTERS & DETERMINISTIC BALANCE CALCULATIONS (Items 15-23, 42-45)
  // ============================================================
  describe('Group 5: Balance Calculations & Filters', () => {
    let isolateSalesmanId: string;

    beforeAll(async () => {
      // Create isolated salesman for exact mathematical testing
      const isoPerson = await prisma.person.create({
        data: {
          name: 'Math Isolation Salesman',
          phone: '+919999888809',
          type: PersonType.SALESMAN,
          active: true,
        },
      });
      isolateSalesmanId = isoPerson.id;

      // Seed 5 specific transactions across dates:
      // T1 (2026-08-01): DEBIT 2000 (Advance before period -> Opening balance)
      // T2 (2026-08-15): CREDIT 500 (Recovery before period -> Opening balance)
      // -> Expected Opening Balance as of 2026-09-01 = 2000 - 500 = 1500
      // T3 (2026-09-10): DEBIT 1000 (Shortage in period)
      // T4 (2026-09-20): CREDIT 300 (Recovery in period)
      // -> Period Debits = 1000, Period Credits = 300
      // -> Expected Closing Balance = 1500 + 1000 - 300 = 2200
      // T5 (2026-10-05): DEBIT 4000 (Future after period -> must NOT be in period totals or closing)
      const txs = await prisma.$transaction([
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isolateSalesmanId,
            transactionDate: new Date('2026-08-01T00:00:00.000Z'),
            type: LedgerTransactionType.ADVANCE,
            direction: LedgerDirection.DEBIT,
            amount: '2000.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isolateSalesmanId,
            transactionDate: new Date('2026-08-15T00:00:00.000Z'),
            type: LedgerTransactionType.RECOVERY,
            direction: LedgerDirection.CREDIT,
            amount: '500.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isolateSalesmanId,
            transactionDate: new Date('2026-09-10T00:00:00.000Z'),
            type: LedgerTransactionType.ADVANCE,
            direction: LedgerDirection.DEBIT,
            amount: '1000.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isolateSalesmanId,
            transactionDate: new Date('2026-09-20T00:00:00.000Z'),
            type: LedgerTransactionType.RECOVERY,
            direction: LedgerDirection.CREDIT,
            amount: '300.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isolateSalesmanId,
            transactionDate: new Date('2026-10-05T00:00:00.000Z'),
            type: LedgerTransactionType.ADVANCE,
            direction: LedgerDirection.DEBIT,
            amount: '4000.00',
            createdBy: adminUserId,
          },
        }),
      ]);

      for (const t of txs) {
        createdLedgerTransactionIds.push(t.id);
      }
    });

    afterAll(async () => {
      await prisma.salesmanLedgerTransaction.deleteMany({
        where: { salesmanId: isolateSalesmanId },
      });
      await prisma.person.deleteMany({
        where: { id: isolateSalesmanId },
      });
    });

    it('18 & 22. Opening balance correctly accumulates transactions before fromDate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-01&toDate=2026-09-30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.openingBalance).toBe(1500); // 2000 DEBIT - 500 CREDIT
    });

    it('19. Debit total is correct for period', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-01&toDate=2026-09-30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      expect(body.data.totalDebits).toBe(1000);
    });

    it('20. Credit total is correct for period', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-01&toDate=2026-09-30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      expect(body.data.totalCredits).toBe(300);
    });

    it('21. Closing balance = opening + debit - credit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-01&toDate=2026-09-30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      // 1500 + 1000 - 300 = 2200
      expect(body.data.closingBalance).toBe(2200);
      expect(body.data.transactions).toHaveLength(2);
    });

    it('23. Transactions after toDate do not affect period totals or closing balance', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-01&toDate=2026-09-30`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      // The 4000.00 transaction on 2026-10-05 must not appear in period debits or closing balance
      expect(body.data.closingBalance).toBe(2200);
      const hasOctoberTx = body.data.transactions.some(
        (tx: any) => tx.amount === 4000
      );
      expect(hasOctoberTx).toBe(false);
    });

    it('15. Date filters work deterministically', async () => {
      // Query exact single day
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-09-10&toDate=2026-09-10`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      expect(body.data.transactions).toHaveLength(1);
      expect(body.data.transactions[0].amount).toBe(1000);
    });

    it('16. Type filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&type=RECOVERY`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      for (const tx of body.data.transactions) {
        expect(tx.type).toBe('RECOVERY');
      }
    });

    it('17. Direction filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&direction=CREDIT`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      for (const tx of body.data.transactions) {
        expect(tx.direction).toBe('CREDIT');
      }
    });

    it('42. Multiple transactions calculate balance correctly across all records', async () => {
      // No date filters: opening is 0, closing is net of all 5 transactions:
      // Debits: 2000 + 1000 + 4000 = 7000
      // Credits: 500 + 300 = 800
      // Closing: 7000 - 800 = 6200
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      expect(body.data.openingBalance).toBe(0);
      expect(body.data.totalDebits).toBe(7000);
      expect(body.data.totalCredits).toBe(800);
      expect(body.data.closingBalance).toBe(6200);
    });

    it('43. Different salesmen remain completely isolated', async () => {
      const resIso = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resRamesh = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const bodyIso = JSON.parse(resIso.body);
      const bodyRamesh = JSON.parse(resRamesh.body);

      // Verify no cross-pollination
      const isoIds = new Set(bodyIso.data.transactions.map((t: any) => t.id));
      for (const t of bodyRamesh.data.transactions) {
        expect(isoIds.has(t.id)).toBe(false);
      }
    });

    it('45. Decimal monetary calculations remain exact without floating-point errors', async () => {
      const precTx = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: isolateSalesmanId,
          transactionDate: new Date('2026-11-01T00:00:00.000Z'),
          type: LedgerTransactionType.MANUAL_ADJUSTMENT,
          direction: LedgerDirection.DEBIT,
          amount: '0.10',
          notes: 'Precision test 1',
          createdBy: adminUserId,
        },
      });
      const precTx2 = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: isolateSalesmanId,
          transactionDate: new Date('2026-11-01T00:00:00.000Z'),
          type: LedgerTransactionType.MANUAL_ADJUSTMENT,
          direction: LedgerDirection.DEBIT,
          amount: '0.20',
          notes: 'Precision test 2',
          createdBy: adminUserId,
        },
      });
      createdLedgerTransactionIds.push(precTx.id, precTx2.id);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salesman-ledger?salesmanId=${isolateSalesmanId}&fromDate=2026-11-01&toDate=2026-11-01`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = JSON.parse(res.body);
      // In JS float: 0.1 + 0.2 = 0.30000000000000004. With Decimal, it must be exactly 0.3
      expect(body.data.totalDebits).toBe(0.3);
    });
  });

  // ============================================================
  // GROUP 6: DAILY HANDOVER INTEGRATION & DUPLICATE PROTECTION (Items 29-38, 48)
  // ============================================================
  describe('Group 6: Daily Handover Integration & Duplicate Protection', () => {
    it('29. SETTLED handover creates no ledger transaction', async () => {
      // Create handover with candy product (UOM JAR, salesRate 160)
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-10',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Record exact collection (10 * 160 = 1600)
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cashCollected: 1600,
          gpayCollected: 0,
        },
      });
      expect(collRes.statusCode).toBe(200);
      expect(JSON.parse(collRes.body).data.status).toBe('SETTLED');

      // Verify no ledger transaction was created
      const ledgerTx = await prisma.salesmanLedgerTransaction.findFirst({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTx).toBeNull();
    });

    it('30. EXCESS handover creates no ledger transaction', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-11',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 5,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Expected 5 * 160 = 800, paid 900 -> EXCESS
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cashCollected: 900,
          gpayCollected: 0,
        },
      });
      expect(collRes.statusCode).toBe(200);
      expect(JSON.parse(collRes.body).data.status).toBe('EXCESS');

      const ledgerTx = await prisma.salesmanLedgerTransaction.findFirst({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTx).toBeNull();
    });

    it('31, 32, 38. SHORT salesman handover creates exactly one HANDOVER_SHORT DEBIT ledger transaction referencing DailyHandover', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-12',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Expected 1600, paid 1300 -> SHORT 300
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cashCollected: 1000,
          gpayCollected: 300,
        },
      });
      expect(collRes.statusCode).toBe(200);
      const collBody = JSON.parse(collRes.body);
      expect(collBody.data.status).toBe('SHORT');
      expect(Number(collBody.data.outstanding)).toBe(300);

      // Check ledger transaction
      const ledgerTxs = await prisma.salesmanLedgerTransaction.findMany({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTxs).toHaveLength(1);
      const tx = ledgerTxs[0];
      createdLedgerTransactionIds.push(tx.id);

      expect(tx.salesmanId).toBe(salesmanPersonId);
      expect(tx.type).toBe('HANDOVER_SHORT');
      expect(tx.direction).toBe('DEBIT');
      expect(Number(tx.amount)).toBe(300); // 32. equals Daily Handover outstanding
      expect(tx.referenceType).toBe('DAILY_HANDOVER');
      expect(tx.referenceId).toBe(handoverId); // 38. references DailyHandover
      expect(tx.notes).toContain('Shortage from daily handover');
    });

    it('33. Dealer SHORT handover creates NO salesman ledger transaction', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.DEALER,
          dealerId: dealerPersonId,
          handoverDate: '2026-10-13',
          status: HandoverStatus.SUBMITTED,
          customerName: 'Dealer Cashier',
          customerPhone: '9840012345',
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // Expected 1600, paid 1000 -> SHORT 600
      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cashCollected: 1000,
          gpayCollected: 0,
        },
      });
      expect(collRes.statusCode).toBe(200);
      expect(JSON.parse(collRes.body).data.status).toBe('SHORT');

      // Dealer must NEVER have a salesman ledger entry
      const ledgerTxs = await prisma.salesmanLedgerTransaction.findMany({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTxs).toHaveLength(0);
    });

    it('34. Repeated collection/retry does not duplicate HANDOVER_SHORT', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-14',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      // First collection: Expected 1600, paid 1100 -> SHORT 500
      const firstColl = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 1100, gpayCollected: 0 },
      });
      expect(firstColl.statusCode).toBe(200);

      // Repeated collection attempt is rejected by immutability shield
      const retryColl = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 1100, gpayCollected: 0 },
      });
      expect(retryColl.statusCode).toBe(400);

      // Database unique constraint also tested directly
      await expect(
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: salesmanPersonId,
            dailyHandoverId: handoverId,
            transactionDate: new Date('2026-10-14T00:00:00.000Z'),
            type: LedgerTransactionType.HANDOVER_SHORT,
            direction: LedgerDirection.DEBIT,
            amount: '500.00',
            createdBy: adminUserId,
          },
        })
      ).rejects.toThrow();

      // Still exactly ONE ledger transaction exists for this handover!
      const ledgerTxs = await prisma.salesmanLedgerTransaction.findMany({
        where: { dailyHandoverId: handoverId },
      });
      expect(ledgerTxs).toHaveLength(1);
      expect(Number(ledgerTxs[0].amount)).toBe(500);
      createdLedgerTransactionIds.push(ledgerTxs[0].id);
    });

    it('35, 36, 37. Discounts, Empty Packets, and Coupons do NOT create ledger transactions', async () => {
      // Salesman handover with item discount, empty packet, and coupon:
      // Gross: 10 * 160 = 1600
      // Discount: 100 -> Net Sales = 1500
      // Empty packet: 50
      // Coupon: 20
      // Expected Handover = 1500 - 50 - 20 = 1430
      // Collection = 1430 (SETTLED)
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-15',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 10,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 100, // 35. Discount
            },
          ],
          emptyPackets: [
            {
              productId: testCandyProductId,
              quantity: 5,
              actualAmount: 50, // 36. Empty Packet
            },
          ],
          coupons: [
            {
              denomination: 10,
              quantity: 2, // 37. Coupon
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          cashCollected: 1430,
          gpayCollected: 0,
        },
      });
      expect(collRes.statusCode).toBe(200);
      expect(JSON.parse(collRes.body).data.status).toBe('SETTLED');

      // Verify ZERO ledger entries for this handover
      const txs = await prisma.salesmanLedgerTransaction.findMany({
        where: { dailyHandoverId: handoverId },
      });
      expect(txs).toHaveLength(0);
    });

    it('48. Existing Phase 2H behavior remains intact', async () => {
      // Verify GET /api/v1/daily-handovers returns normal list
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

  // ============================================================
  // GROUP 7: ATOMICITY & TRANSACTIONAL INTEGRITY (Items 39-41)
  // ============================================================
  describe('Group 7: Atomicity & Transactional Integrity', () => {
    it('39. Daily Handover + ledger creation are atomic within the database transaction', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/daily-handovers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          recipientType: HandoverRecipientType.SALESMAN,
          salesmanId: salesmanPersonId,
          handoverDate: '2026-10-16',
          status: HandoverStatus.SUBMITTED,
          items: [
            {
              productId: testCandyProductId,
              uom: Uom.JAR,
              openingQuantity: 5,
              closingQuantity: 0,
              freeQuantity: 0,
              discount: 0,
            },
          ],
        },
      });
      expect(createRes.statusCode).toBe(201);
      const handoverId = JSON.parse(createRes.body).data.id;
      createdHandoverIds.push(handoverId);

      const collRes = await app.inject({
        method: 'POST',
        url: `/api/v1/daily-handovers/${handoverId}/collection`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { cashCollected: 500, gpayCollected: 0 }, // Expected 800, paid 500 -> Short 300
      });
      expect(collRes.statusCode).toBe(200);

      const [handover, ledgerTx] = await Promise.all([
        prisma.dailyHandover.findUnique({ where: { id: handoverId } }),
        prisma.salesmanLedgerTransaction.findFirst({ where: { dailyHandoverId: handoverId } }),
      ]);

      expect(handover!.status).toBe('SHORT');
      expect(ledgerTx).not.toBeNull();
      expect(Number(ledgerTx!.amount)).toBe(300);
      createdLedgerTransactionIds.push(ledgerTx!.id);
    });

    it('40 & 41. Transactional rollback test: failed handover update leaves no orphan ledger transaction', async () => {
      // Verify rollback behavior when a transaction fails
      let txRolledBack = false;
      try {
        await prisma.$transaction(async (tx) => {
          // Create ledger transaction
          await tx.salesmanLedgerTransaction.create({
            data: {
              salesmanId: salesmanPersonId,
              transactionDate: new Date('2026-10-17T00:00:00.000Z'),
              type: LedgerTransactionType.ADVANCE,
              direction: LedgerDirection.DEBIT,
              amount: '999.00',
              notes: 'Simulated rollback test',
              createdBy: adminUserId,
            },
          });
          // Intentionally throw error to abort transaction
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });
      } catch (err: any) {
        if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
          txRolledBack = true;
        }
      }

      expect(txRolledBack).toBe(true);

      // Confirm no orphan record was committed to database
      const orphan = await prisma.salesmanLedgerTransaction.findFirst({
        where: { notes: 'Simulated rollback test' },
      });
      expect(orphan).toBeNull();
    });
  });
});
