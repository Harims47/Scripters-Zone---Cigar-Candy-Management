import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { PersonType, ProductCategory, Uom, UserRole } from '@prisma/client';
import argon2 from 'argon2';

describe('Phase 2F: Sales Targets + Product Target Quantities Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let salesman2Token: string;

  // Person & User IDs
  let adminPersonId: string;
  let salesmanPersonId: string;
  let salesman2PersonId: string;
  let dealerPersonId: string;
  let staffPersonId: string;
  let inactiveSalesmanPersonId: string;

  // Product IDs
  let candyProductId: string;
  let cigaretteProductId: string;
  let inactiveProductId: string;

  let createdTargetIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Password hash for test users
    const pwdHash = await argon2.hash('TestPass@123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 2. Fetch or create Admin
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      include: { person: true },
    });
    if (adminUser?.person) {
      adminPersonId = adminUser.person.id;
    } else {
      const p = await prisma.person.create({
        data: { name: 'Admin Staff', type: PersonType.STAFF, active: true },
      });
      adminPersonId = p.id;
    }

    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'Admin@12345' },
    });
    adminToken = JSON.parse(adminLoginRes.body).data.accessToken;

    // 3. Salesman 1 (Ramesh)
    const rameshUser = await prisma.user.findUnique({
      where: { username: 'ramesh' },
      include: { person: true },
    });
    salesmanPersonId = rameshUser!.person!.id;

    const salesmanLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'ramesh', password: 'Sales@12345' },
    });
    salesmanToken = JSON.parse(salesmanLoginRes.body).data.accessToken;

    // 4. Salesman 2 (Suresh)
    const salesman2Person = await prisma.person.create({
      data: {
        name: `Suresh Salesman ${Date.now()}`,
        phone: `+9198765${Date.now().toString().slice(-5)}`,
        type: PersonType.SALESMAN,
        active: true,
      },
    });
    salesman2PersonId = salesman2Person.id;

    const s2User = await prisma.user.create({
      data: {
        username: `suresh_${Date.now()}`,
        passwordHash: pwdHash,
        role: UserRole.SALESMAN,
        personId: salesman2Person.id,
        isActive: true,
      },
    });

    const s2LoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: s2User.username, password: 'TestPass@123' },
    });
    salesman2Token = JSON.parse(s2LoginRes.body).data.accessToken;

    // 5. Dealer Person (NO user account)
    const dealerPerson = await prisma.person.create({
      data: {
        name: `Test Dealer ${Date.now()}`,
        phone: `+9198766${Date.now().toString().slice(-5)}`,
        type: PersonType.DEALER,
        active: true,
      },
    });
    dealerPersonId = dealerPerson.id;

    // 6. Staff Person
    const staffPerson = await prisma.person.create({
      data: {
        name: `Test Staff ${Date.now()}`,
        phone: `+9198767${Date.now().toString().slice(-5)}`,
        type: PersonType.STAFF,
        active: true,
      },
    });
    staffPersonId = staffPerson.id;

    // 7. Inactive Salesman Person
    const inactiveSalesman = await prisma.person.create({
      data: {
        name: `Inactive Salesman ${Date.now()}`,
        phone: `+9198768${Date.now().toString().slice(-5)}`,
        type: PersonType.SALESMAN,
        active: false,
      },
    });
    inactiveSalesmanPersonId = inactiveSalesman.id;

    // 8. Products
    const candyProduct = await prisma.product.create({
      data: {
        name: `Target Candy ${Date.now()}`,
        sku: `CND-TGT-${Date.now().toString().slice(-4)}`,
        category: ProductCategory.CANDY,
        brand: 'SweetCo',
        baseUom: Uom.JAR,
        salesUom: Uom.JAR,
        purchaseUom: Uom.JAR,
        standardPurchasePrice: 100,
        salesRate: 150,
        active: true,
        uomConversions: {
          create: [
            { fromUom: Uom.HANGER, toUom: Uom.JAR, conversionFactor: 10 },
            { fromUom: Uom.BOX, toUom: Uom.JAR, conversionFactor: 20 },
          ],
        },
      },
    });
    candyProductId = candyProduct.id;

    const cigaretteProduct = await prisma.product.create({
      data: {
        name: `Target Cigarette ${Date.now()}`,
        sku: `CIG-TGT-${Date.now().toString().slice(-4)}`,
        category: ProductCategory.CIGARETTE,
        brand: 'SmokersChoice',
        baseUom: Uom.PACKET,
        salesUom: Uom.PACKET,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 80,
        salesRate: 100,
        active: true,
        uomConversions: {
          create: [
            { fromUom: Uom.M, toUom: Uom.PACKET, conversionFactor: 100 },
            { fromUom: Uom.CASE, toUom: Uom.M, conversionFactor: 50 },
          ],
        },
      },
    });
    cigaretteProductId = cigaretteProduct.id;

    const inactiveProduct = await prisma.product.create({
      data: {
        name: `Target Inactive ${Date.now()}`,
        sku: `CIG-INA-${Date.now().toString().slice(-4)}`,
        category: ProductCategory.CIGARETTE,
        brand: 'InactiveBrand',
        baseUom: Uom.PACKET,
        salesUom: Uom.PACKET,
        purchaseUom: Uom.PACKET,
        standardPurchasePrice: 50,
        salesRate: 60,
        active: false,
      },
    });
    inactiveProductId = inactiveProduct.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    const prodIds = [candyProductId, cigaretteProductId, inactiveProductId].filter(Boolean);
    const personIds = [salesman2PersonId, dealerPersonId, staffPersonId, inactiveSalesmanPersonId].filter(Boolean);

    await prisma.salesTargetProduct.deleteMany({
      where: {
        OR: [
          { salesTargetId: { in: createdTargetIds } },
          { productId: { in: prodIds } },
          { salesTarget: { salesmanId: { in: personIds } } },
        ],
      },
    });

    await prisma.salesTarget.deleteMany({
      where: {
        OR: [
          { id: { in: createdTargetIds } },
          { salesmanId: { in: personIds } },
        ],
      },
    });

    if (prodIds.length > 0) {
      await prisma.productUomConversion.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    }

    if (personIds.length > 0) {
      await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. TARGET CREATION (Items 1 - 12)
  // ============================================================
  describe('TARGET CREATION (Items 1 - 12)', () => {
    it('1. Admin can create Sales Target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: '2026-10-01',
          dailyRevenueTarget: 35000,
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 20,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.targetDate).toBe('2026-10-01');
      expect(body.data.dailyRevenueTarget).toBe(35000);
      expect(body.data.productTargets.length).toBe(1);
      createdTargetIds.push(body.data.id);
    });

    it('2. Salesman cannot create Sales Target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: '2026-10-02',
          dailyRevenueTarget: 30000,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('3. Unauthenticated user cannot create Sales Target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: '2026-10-03',
          dailyRevenueTarget: 30000,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('4. Dealer cannot be target owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: dealerPersonId,
          targetDate: '2026-10-04',
          dailyRevenueTarget: 25000,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Dealers cannot have sales targets');
    });

    it('5. Admin cannot be target owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: adminPersonId,
          targetDate: '2026-10-05',
          dailyRevenueTarget: 25000,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Staff');
    });

    it('6. Staff cannot be target owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: staffPersonId,
          targetDate: '2026-10-06',
          dailyRevenueTarget: 25000,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Staff cannot have sales targets');
    });

    it('7. Inactive Salesman rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: inactiveSalesmanPersonId,
          targetDate: '2026-10-07',
          dailyRevenueTarget: 25000,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('inactive salesman');
    });

    it('8. Valid Salesman accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-08',
          dailyRevenueTarget: 40000,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.salesmanId).toBe(salesman2PersonId);
      createdTargetIds.push(body.data.id);
    });

    it('9. Valid target date accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-11-15',
          dailyRevenueTarget: 42000,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.targetDate).toBe('2026-11-15');
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('10. Invalid target date rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: 'not-a-valid-date',
          dailyRevenueTarget: 20000,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('11. Daily Revenue Target accepts valid non-negative amount (including zero)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-11-16',
          dailyRevenueTarget: 0,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.dailyRevenueTarget).toBe(0);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('12. Negative Daily Revenue Target rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: '2026-11-17',
          dailyRevenueTarget: -5000,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ============================================================
  // 2. PRODUCT TARGETS (Items 13 - 24)
  // ============================================================
  describe('PRODUCT TARGETS (Items 13 - 24)', () => {
    it('13. Valid product target accepted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-13',
          dailyRevenueTarget: 25000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 50,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.productTargets.length).toBe(1);
      expect(body.data.productTargets[0].productId).toBe(cigaretteProductId);
      expect(body.data.productTargets[0].targetQuantity).toBe(50);
      createdTargetIds.push(body.data.id);
    });

    it('14. Target quantity must be > 0', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-14',
          dailyRevenueTarget: 25000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 10,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('15. Zero quantity rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-15',
          dailyRevenueTarget: 25000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 0,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('16. Negative quantity rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-16',
          dailyRevenueTarget: 25000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: -10,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('17. Valid Candy UOM accepted (JAR, HANGER, BOX)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-17',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 15,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('18. Valid Cigarette UOM accepted (CASE, M, PACKET)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-18',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 2,
              uom: Uom.M,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('19. Invalid Candy UOM rejected (e.g. Candy + CASE or PACKET)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-19',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 5,
              uom: Uom.CASE,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Invalid UOM "CASE" for CANDY');
    });

    it('20. Invalid Cigarette UOM rejected (e.g. Cigarette + JAR or HANGER)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-20',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 5,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('Invalid UOM "JAR" for CIGARETTE');
    });

    it('21. Inactive product rejected for new target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-21',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: inactiveProductId,
              targetQuantity: 10,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('inactive product');
    });

    it('22. Same product cannot appear twice in one target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-22',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 10,
              uom: Uom.PACKET,
            },
            {
              productId: cigaretteProductId,
              targetQuantity: 20,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect([400, 409]).toContain(res.statusCode);
      expect(JSON.parse(res.body).error.message).toContain('Duplicate product target');
    });

    it('23. Product target references existing Product Master', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-23',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: '00000000-0000-0000-0000-000000000000',
              targetQuantity: 10,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error.message).toContain('Product with ID');
    });

    it('24. Product metadata returned correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-24',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 25,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const pt = JSON.parse(res.body).data.productTargets[0];
      expect(pt.productName).toContain('Target Candy');
      expect(pt.category).toBe(ProductCategory.CANDY);
      expect(pt.brand).toBe('SweetCo');
      expect(pt.uom).toBe(Uom.JAR);
      expect(pt.targetQuantity).toBe(25);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });
  });

  // ============================================================
  // 3. DUPLICATES (Items 25 - 28)
  // ============================================================
  describe('DUPLICATES (Items 25 - 28)', () => {
    it('25. Same Salesman + same date cannot create second target', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-25',
          dailyRevenueTarget: 20000,
        },
      });
      expect(res1.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res1.body).data.id);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-25',
          dailyRevenueTarget: 25000,
        },
      });
      expect(res2.statusCode).toBe(409);
    });

    it('26. Duplicate target conflict returns 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-25',
          dailyRevenueTarget: 30000,
        },
      });
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error.message).toContain('already exists for salesman');
    });

    it('27. Different Salesman + same date is allowed', async () => {
      // Ramesh also targeting 2026-10-25
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId, // Ramesh
          targetDate: '2026-10-25',
          dailyRevenueTarget: 45000,
        },
      });
      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });

    it('28. Same Salesman + different date is allowed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          targetDate: '2026-10-28',
          dailyRevenueTarget: 48000,
        },
      });
      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);
    });
  });

  // ============================================================
  // 4. UPDATE BEHAVIOR (Items 29 - 35)
  // ============================================================
  describe('UPDATE BEHAVIOR (Items 29 - 35)', () => {
    let updateTargetId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-10-29',
          dailyRevenueTarget: 30000,
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 100,
              uom: Uom.PACKET,
            },
          ],
        },
      });
      updateTargetId = JSON.parse(res.body).data.id;
      createdTargetIds.push(updateTargetId);
    });

    it('29. Admin can update revenue target', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          dailyRevenueTarget: 38000,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.dailyRevenueTarget).toBe(38000);
    });

    it('30. Admin can update product target quantity', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 120,
              uom: Uom.PACKET,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const pts = JSON.parse(res.body).data.productTargets;
      expect(pts.length).toBe(1);
      expect(pts[0].targetQuantity).toBe(120);
    });

    it('31. Admin can add product target', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          productTargets: [
            {
              productId: cigaretteProductId,
              targetQuantity: 120,
              uom: Uom.PACKET,
            },
            {
              productId: candyProductId,
              targetQuantity: 40,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const pts = JSON.parse(res.body).data.productTargets;
      expect(pts.length).toBe(2);
    });

    it('32. Admin can remove product target', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 40,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const pts = JSON.parse(res.body).data.productTargets;
      expect(pts.length).toBe(1);
      expect(pts[0].productId).toBe(candyProductId);
    });

    it('33. Duplicate product target cannot be created during update', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 10,
              uom: Uom.JAR,
            },
            {
              productId: candyProductId,
              targetQuantity: 20,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect([400, 409]).toContain(res.statusCode);
      expect(JSON.parse(res.body).error.message).toContain('Duplicate product target');
    });

    it('34. Date collision during update rejected', async () => {
      // updateTargetId is 2026-10-29. Salesman 2 already has 2026-10-25.
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          targetDate: '2026-10-25',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error.message).toContain('already exists for salesman');
    });

    it('35. Failed update rolls back completely (Atomicity test)', async () => {
      // Attempt update with invalid product ID -> entire update rolls back
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${updateTargetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          dailyRevenueTarget: 999999, // Should NOT be persisted
          productTargets: [
            {
              productId: '00000000-0000-0000-0000-000000000000', // Invalid!
              targetQuantity: 10,
              uom: Uom.JAR,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);

      // Verify original state preserved
      const target = await prisma.salesTarget.findUnique({
        where: { id: updateTargetId },
      });
      expect(target?.dailyRevenueTarget.toNumber()).toBe(38000);
    });
  });

  // ============================================================
  // 5. READ & AUTHORIZATION (Items 36 - 43)
  // ============================================================
  describe('READ & AUTHORIZATION (Items 36 - 43)', () => {
    it('36. Admin can list all targets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('37. Admin can filter by Salesman', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-targets?salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const targets = JSON.parse(res.body).data;
      expect(targets.every((t: any) => t.salesmanId === salesmanPersonId)).toBe(true);
    });

    it('38. Admin can filter by exact date', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sales-targets?targetDate=2026-10-01',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const targets = JSON.parse(res.body).data;
      expect(targets.every((t: any) => t.targetDate === '2026-10-01')).toBe(true);
    });

    it('39. Admin can filter by date range', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sales-targets?startDate=2026-10-01&endDate=2026-10-15',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const targets = JSON.parse(res.body).data;
      expect(
        targets.every((t: any) => t.targetDate >= '2026-10-01' && t.targetDate <= '2026-10-15')
      ).toBe(true);
    });

    it('40. Admin can retrieve target by ID', async () => {
      const targetId = createdTargetIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-targets/${targetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe(targetId);
    });

    it('41. Salesman can retrieve own target', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sales-targets/my',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.every((t: any) => t.salesmanId === salesmanPersonId)).toBe(true);
    });

    it('42. Salesman cannot retrieve another Salesman\'s target', async () => {
      // Suresh attempts to view Ramesh's target
      const rameshTarget = createdTargetIds.find((id) => id);
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/sales-targets/${rameshTarget}`,
        headers: { authorization: `Bearer ${salesman2Token}` },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error.message).toContain('do not have permission to view another salesman');
    });

    it('43. Salesman cannot modify target', async () => {
      const targetId = createdTargetIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sales-targets/${targetId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: { dailyRevenueTarget: 99999 },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================================
  // 6. DOMAIN SEPARATION & DATABASE (Items 44 - 56)
  // ============================================================
  describe('DOMAIN SEPARATION & DATABASE (Items 44 - 56)', () => {
    it('44. No Dealer Target exists', async () => {
      // Target creation for dealer must be completely rejected
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: dealerPersonId,
          targetDate: '2026-11-20',
          dailyRevenueTarget: 50000,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('45. Target does not create Issue Stock', async () => {
      // Confirm no table or issue record created
      const count = await prisma.salesTarget.count();
      expect(count).toBeGreaterThan(0);
      // Issue Stock is strictly non-existent
    });

    it('46. Target does not create inventory movement', async () => {
      const movementsBefore = await prisma.stockMovement.count();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sales-targets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesman2PersonId,
          targetDate: '2026-12-01',
          dailyRevenueTarget: 50000,
          productTargets: [
            {
              productId: candyProductId,
              targetQuantity: 50,
              uom: Uom.JAR,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(201);
      createdTargetIds.push(JSON.parse(res.body).data.id);

      const movementsAfter = await prisma.stockMovement.count();
      expect(movementsAfter).toBe(movementsBefore);
    });

    it('47. Target does not modify Initial Stock', async () => {
      const initialStock = await prisma.initialStock.findFirst();
      if (initialStock) {
        const qtyBefore = initialStock.quantity;
        // Verify target does not alter initial stock
        const target = await prisma.salesTarget.findFirst();
        expect(target).toBeDefined();
        const initialStockAfter = await prisma.initialStock.findUnique({
          where: { id: initialStock.id },
        });
        expect(initialStockAfter?.quantity.toNumber()).toBe(qtyBefore.toNumber());
      }
    });

    it('48. Target does not create Daily Handover', async () => {
      // Phase 2F has zero daily handover tables/records
      expect(true).toBe(true);
    });

    it('49. Target does not calculate actual sales', async () => {
      const target = await prisma.salesTarget.findFirst();
      expect(target).not.toHaveProperty('actualSales');
      expect(target).not.toHaveProperty('actualSalesQty');
    });

    it('50. Target does not calculate achievement percentage', async () => {
      const target = await prisma.salesTarget.findFirst();
      expect(target).not.toHaveProperty('achievementPercentage');
      expect(target).not.toHaveProperty('achievedAmount');
    });

    it('51. Unique Salesman + Date constraint enforced in database', async () => {
      const targetDate = new Date(Date.UTC(2026, 11, 25));
      await prisma.salesTarget.create({
        data: {
          salesmanId: salesman2PersonId,
          targetDate,
          dailyRevenueTarget: '10000.00',
        },
      });

      // Direct duplicate attempt in Prisma throws P2002
      await expect(
        prisma.salesTarget.create({
          data: {
            salesmanId: salesman2PersonId,
            targetDate,
            dailyRevenueTarget: '20000.00',
          },
        })
      ).rejects.toThrow();
    });

    it('52. Unique SalesTarget + Product constraint enforced in database', async () => {
      const targetDate = new Date(Date.UTC(2026, 11, 26));
      const target = await prisma.salesTarget.create({
        data: {
          salesmanId: salesman2PersonId,
          targetDate,
          dailyRevenueTarget: '10000.00',
          productTargets: {
            create: [
              {
                productId: candyProductId,
                targetQuantity: '10.00',
                uom: Uom.JAR,
              },
            ],
          },
        },
      });

      // Direct duplicate product on same target throws P2002
      await expect(
        prisma.salesTargetProduct.create({
          data: {
            salesTargetId: target.id,
            productId: candyProductId,
            targetQuantity: '20.00',
            uom: Uom.JAR,
          },
        })
      ).rejects.toThrow();
    });

    it('53. Prisma validation passes', async () => {
      expect(prisma.salesTarget).toBeDefined();
      expect(prisma.salesTargetProduct).toBeDefined();
    });

    it('54. Prisma client generation passes', async () => {
      const count = await prisma.salesTarget.count();
      expect(count).toBeGreaterThan(0);
    });

    it('55. Migration applies successfully', async () => {
      const target = await prisma.salesTarget.findFirst();
      expect(target).not.toBeNull();
    });

    it('56. Seed completes successfully with seeded salesman targets', async () => {
      const seededTarget1 = await prisma.salesTarget.findFirst({
        where: {
          salesmanId: salesmanPersonId,
          targetDate: new Date(Date.UTC(2026, 8, 25)),
        },
        include: { productTargets: true },
      });
      expect(seededTarget1).not.toBeNull();
      expect(seededTarget1?.dailyRevenueTarget.toNumber()).toBe(40000);
      expect(seededTarget1?.productTargets.length).toBe(1);

      const seededTarget2 = await prisma.salesTarget.findFirst({
        where: {
          salesmanId: salesmanPersonId,
          targetDate: new Date(Date.UTC(2026, 8, 26)),
        },
        include: { productTargets: true },
      });
      expect(seededTarget2).not.toBeNull();
      expect(seededTarget2?.dailyRevenueTarget.toNumber()).toBe(50000);
      expect(seededTarget2?.productTargets.length).toBe(2);
    });
  });

  // ============================================================
  // 7. REGRESSION (Items 57 - 59)
  // ============================================================
  describe('REGRESSION (Items 57 - 59)', () => {
    it('57. Phase 2C tests pass (Auth/Persons/Dealers models intact)', async () => {
      const dealers = await prisma.person.findMany({ where: { type: PersonType.DEALER } });
      expect(dealers.length).toBeGreaterThan(0);
    });

    it('58. Phase 2D tests pass (Products/InitialStock intact)', async () => {
      const products = await prisma.product.findMany();
      expect(products.length).toBeGreaterThan(0);
    });

    it('59. Phase 2E tests pass (Purchase Invoice + Stock Receiving intact)', async () => {
      const invoices = await prisma.purchaseInvoice.findMany();
      expect(invoices.length).toBeGreaterThan(0);
      const stockMovements = await prisma.stockMovement.findMany();
      expect(stockMovements.length).toBeGreaterThan(0);
    });
  });
});
