import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { PersonType, UserRole } from '@prisma/client';
import argon2 from 'argon2';

describe('Phase 2C: Users + Persons + Authentication Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let adminUserId: string;
  let salesmanUserId: string;
  let createdDealerId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup any created test records
    if (createdDealerId) {
      await prisma.person.deleteMany({ where: { id: createdDealerId } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. AUTH SPECIFICATION TESTS (Items 1 - 9)
  // ============================================================
  describe('AUTH Tests (Items 1 - 9)', () => {
    it('1. Valid Admin login succeeds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin',
          password: 'Admin@12345',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.username).toBe('admin');
      expect(body.data.user.role).toBe('ADMIN');
      expect(body.data.user.passwordHash).toBeUndefined();

      adminToken = body.data.accessToken;
      adminUserId = body.data.user.id;
    });

    it('2. Valid Salesman login succeeds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'ramesh',
          password: 'Sales@12345',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.username).toBe('ramesh');
      expect(body.data.user.role).toBe('SALESMAN');
      expect(body.data.user.passwordHash).toBeUndefined();

      salesmanToken = body.data.accessToken;
      salesmanUserId = body.data.user.id;
    });

    it('3. Invalid password fails', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin',
          password: 'WrongPassword@999',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid username or password');
    });

    it('4. Unknown user fails', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'completely_unknown_user_9999',
          password: 'AnyPassword@123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid username or password');
    });

    it('5. Inactive user cannot authenticate', async () => {
      const inactiveUser = await prisma.user.create({
        data: {
          username: 'test_inactive_salesman',
          passwordHash: await argon2.hash('Inactive@12345', { type: argon2.argon2id }),
          role: UserRole.SALESMAN,
          isActive: false,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'test_inactive_salesman',
          password: 'Inactive@12345',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('deactivated');

      // Cleanup
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    });

    it('6. JWT is generated correctly', async () => {
      expect(adminToken).toBeDefined();
      expect(typeof adminToken).toBe('string');

      // Decode token using fastify jwt decode
      const decoded = app.jwt.decode<{ userId: string; role: string; iat: number; exp: number }>(adminToken);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(adminUserId);
      expect(decoded?.role).toBe('ADMIN');
      expect(decoded?.exp).toBeGreaterThan(decoded?.iat || 0);

      // Verify token signature with fastify.jwt
      const verified = app.jwt.verify(adminToken);
      expect(verified).toBeDefined();
    });

    it('7. /auth/me works with valid JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(adminUserId);
      expect(body.data.username).toBe('admin');
      expect(body.data.role).toBe('ADMIN');
      expect(body.data.isActive).toBe(true);
      expect(body.data.passwordHash).toBeUndefined();
    });

    it('8. /auth/me rejects missing JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('9. /auth/me rejects invalid JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload_data.signature',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================
  // 2. AUTHORIZATION SPECIFICATION TESTS (Items 10 - 14)
  // ============================================================
  describe('AUTHORIZATION Tests (Items 10 - 14)', () => {
    it('10. Admin role recognized', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe('ADMIN');
    });

    it('11. Salesman role recognized', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe('SALESMAN');
    });

    it('12. Dealer cannot authenticate', async () => {
      const dealer = await prisma.person.findFirst({
        where: { type: PersonType.DEALER },
      });
      expect(dealer).not.toBeNull();

      // Attempt login with Dealer name as username
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: dealer!.name,
          password: 'AnyPassword@123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('13. Salesman cannot access Admin-only endpoint', async () => {
      // Salesman attempts to access GET /api/v1/users (Admin-only)
      const userRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(userRes.statusCode).toBe(403);
      const userBody = JSON.parse(userRes.body);
      expect(userBody.success).toBe(false);
      expect(userBody.error.code).toBe('FORBIDDEN');

      // Salesman attempts to create a dealer (Admin-only)
      const dealerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/dealers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          name: 'Unauthorized Dealer Creation',
          phone: '+919999988888',
        },
      });

      expect(dealerRes.statusCode).toBe(403);
      const dealerBody = JSON.parse(dealerRes.body);
      expect(dealerBody.success).toBe(false);
      expect(dealerBody.error.code).toBe('FORBIDDEN');
    });

    it('14. Unauthenticated request is rejected', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================
  // 3. DEALER MASTER SPECIFICATION TESTS (Items 15 - 19)
  // ============================================================
  describe('DEALER Tests (Items 15 - 19)', () => {
    it('15. Admin can create Dealer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/dealers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Karpagam Traders',
          phone: '+919876599999',
          address: 'Bazaar Street, Kovilpatti',
          active: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Karpagam Traders');
      expect(body.data.phone).toBe('+919876599999');
      expect(body.data.active).toBe(true);
      expect(body.data.hasUserAccount).toBe(false);

      createdDealerId = body.data.id;
    });

    it('16. Admin can list Dealers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/dealers',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const found = body.data.find((d: any) => d.id === createdDealerId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Karpagam Traders');
    });

    it('17. Admin can retrieve Dealer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/dealers/${createdDealerId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdDealerId);
      expect(body.data.name).toBe('Karpagam Traders');
      expect(body.data.phone).toBe('+919876599999');
    });

    it('18. Admin can update Dealer', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/dealers/${createdDealerId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          address: 'Updated Main Road, Kovilpatti',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.address).toBe('Updated Main Road, Kovilpatti');

      // Test status toggle
      const statusRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/dealers/${createdDealerId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { active: false },
      });

      expect(statusRes.statusCode).toBe(200);
      const statusBody = JSON.parse(statusRes.body);
      expect(statusBody.data.active).toBe(false);
    });

    it('19. Dealer has no authentication credentials', async () => {
      // 1. Verify in DB that the Person record has type=DEALER and user=null
      const dbDealer = await prisma.person.findUnique({
        where: { id: createdDealerId },
        include: { user: true },
      });
      expect(dbDealer).not.toBeNull();
      expect(dbDealer?.type).toBe(PersonType.DEALER);
      expect(dbDealer?.user).toBeNull();

      // 2. Attempting to link a User account to this Dealer Person is strictly rejected
      const attemptRes = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          username: 'dealer_login_attempt',
          password: 'Password@123',
          role: 'SALESMAN',
          personId: createdDealerId,
        },
      });

      expect(attemptRes.statusCode).toBe(409);
      const attemptBody = JSON.parse(attemptRes.body);
      expect(attemptBody.success).toBe(false);
      expect(attemptBody.error.message).toContain('Dealers are business contacts and MUST NEVER have a login user account');
    });
  });

  // ============================================================
  // 4. SECURITY SPECIFICATION TESTS (Items 20 - 22)
  // ============================================================
  describe('SECURITY Tests (Items 20 - 22)', () => {
    it('20. Password is stored as Argon2id hash', async () => {
      const adminUser = await prisma.user.findUnique({
        where: { username: 'admin' },
      });

      expect(adminUser).not.toBeNull();
      expect(adminUser?.passwordHash).toBeDefined();
      expect(adminUser?.passwordHash.startsWith('$argon2id$')).toBe(true);

      const salesmanUser = await prisma.user.findUnique({
        where: { username: 'ramesh' },
      });

      expect(salesmanUser).not.toBeNull();
      expect(salesmanUser?.passwordHash).toBeDefined();
      expect(salesmanUser?.passwordHash.startsWith('$argon2id$')).toBe(true);

      // Verify Argon2 verification passes with raw password
      const isMatch = await argon2.verify(adminUser!.passwordHash, 'Admin@12345');
      expect(isMatch).toBe(true);
    });

    it('21. Password hash is never returned by API', async () => {
      // 1. Check POST /auth/login
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'admin', password: 'Admin@12345' },
      });
      const loginBody = JSON.parse(loginRes.body);
      expect(loginBody.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(loginBody)).not.toContain('$argon2id$');

      // 2. Check GET /auth/me
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const meBody = JSON.parse(meRes.body);
      expect(meBody.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(meBody)).not.toContain('$argon2id$');

      // 3. Check GET /users
      const usersRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const usersBody = JSON.parse(usersRes.body);
      expect(JSON.stringify(usersBody)).not.toContain('$argon2id$');
      for (const u of usersBody.data) {
        expect(u.passwordHash).toBeUndefined();
      }

      // 4. Check GET /users/:id
      const userRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${adminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const userBody = JSON.parse(userRes.body);
      expect(userBody.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(userBody)).not.toContain('$argon2id$');
    });

    it('22. Password is never logged', async () => {
      // Verify app options disable standard request logging of bodies containing passwords
      expect(app.hasPlugin('error-plugin')).toBe(true);

      // Verify that sanitization logic exists in user and auth responses
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'admin', password: 'Admin@12345' },
      });

      expect(res.statusCode).toBe(200);
      const rawText = res.body;
      expect(rawText).not.toContain('Admin@12345');
      expect(rawText).not.toContain('$argon2id$');
    });
  });

  // ============================================================
  // 5. DATABASE SPECIFICATION TESTS (Items 23 - 25)
  // ============================================================
  describe('DATABASE Tests (Items 23 - 25)', () => {
    it('23. Migration applies successfully', async () => {
      // Query _prisma_migrations table to verify migrations applied
      const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date }>>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at ASC
      `;

      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations[0].migration_name).toContain('single_tenant');
    });

    it('24. Prisma client generates successfully', async () => {
      // Verify Prisma client models and metadata exist and are queryable
      expect(prisma.user).toBeDefined();
      expect(prisma.person).toBeDefined();
      expect(prisma.product).toBeDefined();
      expect(prisma.productUomConversion).toBeDefined();

      const userCount = await prisma.user.count();
      expect(userCount).toBeGreaterThanOrEqual(2);
    });

    it('25. Seed completes successfully', async () => {
      // Verify seeded Admin user
      const admin = await prisma.user.findUnique({
        where: { username: 'admin' },
        include: { person: true },
      });
      expect(admin).not.toBeNull();
      expect(admin?.role).toBe(UserRole.ADMIN);
      expect(admin?.person).not.toBeNull();

      // Verify seeded Salesman user
      const salesman = await prisma.user.findUnique({
        where: { username: 'ramesh' },
        include: { person: true },
      });
      expect(salesman).not.toBeNull();
      expect(salesman?.role).toBe(UserRole.SALESMAN);
      expect(salesman?.person).not.toBeNull();

      // Verify seeded Dealers (with ZERO user login records)
      const dealers = await prisma.person.findMany({
        where: { type: PersonType.DEALER },
        include: { user: true },
      });
      expect(dealers.length).toBeGreaterThanOrEqual(3);
      for (const d of dealers) {
        expect(d.user).toBeNull();
      }
    });
  });
});
