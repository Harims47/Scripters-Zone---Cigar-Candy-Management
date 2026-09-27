import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import {
  PersonType,
  UserRole,
  AttendanceStatus,
  SalaryStatus,
  LedgerTransactionType,
  LedgerDirection,
  LedgerReferenceType,
} from '@prisma/client';

describe('Phase 2K: Attendance + Salary Suite', () => {
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
  let inactiveSalesmanPersonId: string;
  let dealerPersonId: string;
  let staffPersonId: string;

  const createdAttendanceIds: string[] = [];
  const createdSalaryIds: string[] = [];
  const createdLedgerIds: string[] = [];
  const createdPersonIds: string[] = [];
  const createdUserIds: string[] = [];

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
        name: 'Suresh Salary Test',
        phone: '+919999777701',
        type: PersonType.SALESMAN,
        active: true,
      },
    });
    otherSalesmanPersonId = otherSalesmanPerson.id;
    createdPersonIds.push(otherSalesmanPerson.id);

    const otherSalesmanUser = await prisma.user.create({
      data: {
        username: 'suresh_salary',
        passwordHash: 'dummy_hash',
        role: UserRole.SALESMAN,
        personId: otherSalesmanPerson.id,
        isActive: true,
      },
    });
    otherSalesmanUserId = otherSalesmanUser.id;
    createdUserIds.push(otherSalesmanUser.id);

    otherSalesmanToken = app.jwt.sign({
      userId: otherSalesmanUser.id,
      username: otherSalesmanUser.username,
      role: otherSalesmanUser.role,
      personId: otherSalesmanPerson.id,
    });

    // 4. Inactive salesman
    const inactiveSalesman = await prisma.person.create({
      data: {
        name: 'Inactive Salesman Test',
        phone: '+919999777702',
        type: PersonType.SALESMAN,
        active: false,
      },
    });
    inactiveSalesmanPersonId = inactiveSalesman.id;
    createdPersonIds.push(inactiveSalesman.id);

    // 5. Active Dealer
    const dealerPerson = await prisma.person.findFirst({
      where: { type: PersonType.DEALER, active: true },
    });
    dealerPersonId = dealerPerson!.id;

    // 6. Active Staff
    let staffPerson = await prisma.person.findFirst({
      where: { type: PersonType.STAFF, active: true },
    });
    if (!staffPerson) {
      staffPerson = await prisma.person.create({
        data: {
          name: 'Office Staff Test',
          phone: '+919999777703',
          type: PersonType.STAFF,
          active: true,
        },
      });
      createdPersonIds.push(staffPerson.id);
    }
    staffPersonId = staffPerson.id;
  });

  afterAll(async () => {
    if (createdAttendanceIds.length > 0) {
      await prisma.salesmanAttendance.deleteMany({
        where: { id: { in: createdAttendanceIds } },
      });
    }

    if (createdSalaryIds.length > 0) {
      await prisma.salesmanSalary.deleteMany({
        where: { id: { in: createdSalaryIds } },
      });
    }

    if (createdLedgerIds.length > 0) {
      await prisma.salesmanLedgerTransaction.deleteMany({
        where: { id: { in: createdLedgerIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({
        where: { id: { in: createdPersonIds } },
      });
    }
  });

  // ============================================================
  // GROUP 1: ATTENDANCE (Items 1 - 24)
  // ============================================================
  describe('Group 1: Attendance', () => {
    it('1. Migration / Schema works for Attendance', async () => {
      expect(AttendanceStatus.PRESENT).toBe('PRESENT');
      expect(AttendanceStatus.ABSENT).toBe('ABSENT');
      const count = await prisma.salesmanAttendance.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('2. Admin can create PRESENT attendance', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-01',
          status: 'PRESENT',
          notes: 'Full day sales route completed',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.salesmanId).toBe(salesmanPersonId);
      expect(body.data.attendanceDate).toBe('2026-10-01');
      expect(body.data.status).toBe('PRESENT');
      expect(body.data.notes).toBe('Full day sales route completed');
      expect(body.data.createdBy).toBe(adminUserId);
      createdAttendanceIds.push(body.data.id);
    });

    it('3. Admin can create ABSENT attendance', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-02',
          status: 'ABSENT',
          notes: 'Personal sick day',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ABSENT');
      createdAttendanceIds.push(body.data.id);
    });

    it('4. Invalid status rejected (only PRESENT or ABSENT)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-03',
          status: 'HALF_DAY',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('status must be PRESENT or ABSENT');
    });

    it('5. Invalid salesman ID rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: '00000000-0000-0000-0000-000000000000',
          attendanceDate: '2026-10-03',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not found');
    });

    it('6. Dealer cannot receive attendance', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: dealerPersonId,
          attendanceDate: '2026-10-03',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not a SALESMAN');
    });

    it('7. Staff cannot receive attendance', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: staffPersonId,
          attendanceDate: '2026-10-03',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not a SALESMAN');
    });

    it('8. Admin cannot receive attendance', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: adminPersonId,
          attendanceDate: '2026-10-03',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not a SALESMAN');
    });

    it('9. Inactive salesman rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: inactiveSalesmanPersonId,
          attendanceDate: '2026-10-03',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('inactive salesman');
    });

    it('10. Duplicate salesman/date rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-01', // Already created in test 2
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('Attendance already recorded');
    });

    it('11. Unauthenticated request returns 401', async () => {
      const resPost = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-05',
          status: 'PRESENT',
        },
      });
      expect(resPost.statusCode).toBe(401);

      const resGet = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance',
      });
      expect(resGet.statusCode).toBe(401);

      const resSummary = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/summary',
      });
      expect(resSummary.statusCode).toBe(401);
    });

    it('12. Salesman cannot create attendance (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          attendanceDate: '2026-10-05',
          status: 'PRESENT',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('13. Admin can list attendance with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
    });

    it('14. salesmanId filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance?salesmanId=${salesmanPersonId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const item of body.data) {
        expect(item.salesmanId).toBe(salesmanPersonId);
      }
    });

    it('15 & 16. fromDate and toDate filters work', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance?fromDate=2026-10-01&toDate=2026-10-01',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const item of body.data) {
        expect(item.attendanceDate).toBe('2026-10-01');
      }
    });

    it('17. status filter works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance?salesmanId=${salesmanPersonId}&status=ABSENT`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const item of body.data) {
        expect(item.status).toBe('ABSENT');
      }
    });

    it('18. Admin can retrieve attendance by ID', async () => {
      const attId = createdAttendanceIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/${attId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(attId);
      expect(body.data.salesmanId).toBe(salesmanPersonId);
      expect(body.data.status).toBe('PRESENT');
    });

    it('19. PATCH attendance is rejected (400 Bad Request)', async () => {
      const attId = createdAttendanceIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/attendance/${attId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'ABSENT' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('20. DELETE attendance is rejected (400 Bad Request)', async () => {
      const attId = createdAttendanceIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/attendance/${attId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('21, 22, 23. Attendance summary calculates Present, Absent, and Total correctly', async () => {
      // For Ramesh on 2026-10-01 to 2026-10-02:
      // Oct 01 = PRESENT (1)
      // Oct 02 = ABSENT (1)
      // Total = 2
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/summary?salesmanId=${salesmanPersonId}&fromDate=2026-10-01&toDate=2026-10-02`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.presentDays).toBe(1);
      expect(body.data.absentDays).toBe(1);
      expect(body.data.totalRecordedDays).toBe(2);
    });

    it('24. Date ranges do not spill into adjacent dates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/summary?salesmanId=${salesmanPersonId}&fromDate=2026-10-03&toDate=2026-10-03`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.presentDays).toBe(0);
      expect(body.data.absentDays).toBe(0);
      expect(body.data.totalRecordedDays).toBe(0);
    });
  });

  // ============================================================
  // GROUP 2: SALARY & LEDGER RECOVERY (Items 25 - 56)
  // ============================================================
  describe('Group 2: Salary & Ledger Recovery', () => {
    it('25. Admin can create salary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: otherSalesmanPersonId,
          salaryMonth: '2026-08',
          baseSalary: 25000,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.salesmanId).toBe(otherSalesmanPersonId);
      expect(body.data.salaryMonth).toBe('2026-08');
      expect(body.data.baseSalary).toBe(25000);
      expect(body.data.status).toBe('PAID'); // Item 33
      expect(body.data.paidDate).toBeDefined(); // Item 34
      createdSalaryIds.push(body.data.id);
    });

    it('26. Base salary must be > 0 (zero and negative rejected)', async () => {
      const resZero = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: otherSalesmanPersonId,
          salaryMonth: '2026-07',
          baseSalary: 0,
        },
      });
      expect(resZero.statusCode).toBe(400);

      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: otherSalesmanPersonId,
          salaryMonth: '2026-07',
          baseSalary: -25000,
        },
      });
      expect(resNeg.statusCode).toBe(400);
    });

    it('27. Invalid salesman rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: '00000000-0000-0000-0000-000000000000',
          salaryMonth: '2026-07',
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not found');
    });

    it('28. Dealer cannot receive salary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: dealerPersonId,
          salaryMonth: '2026-07',
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not a SALESMAN');
    });

    it('29. Staff cannot receive salary', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: staffPersonId,
          salaryMonth: '2026-07',
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('not a SALESMAN');
    });

    it('30. Inactive salesman rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: inactiveSalesmanPersonId,
          salaryMonth: '2026-07',
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('inactive salesman');
    });

    it('31. Duplicate salesman/month rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: otherSalesmanPersonId,
          salaryMonth: '2026-08', // Already created in test 25
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('Salary already recorded');
    });

    it('32. Salary month normalized correctly from YYYY-MM-DD to YYYY-MM', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: otherSalesmanPersonId,
          salaryMonth: '2026-06-15', // Accepts full date and normalizes to 2026-06
          baseSalary: 25000,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.salaryMonth).toBe('2026-06');
      createdSalaryIds.push(body.data.id);
    });

    it('35. Admin can list salaries', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('36. Admin can retrieve salary by ID', async () => {
      const salId = createdSalaryIds[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salaries/${salId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(salId);
      expect(body.data.salesmanId).toBe(otherSalesmanPersonId);
    });

    it('37. Month filters work on salary listing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salaries?fromMonth=2026-08&toMonth=2026-08',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const sal of body.data) {
        expect(sal.salaryMonth).toBe('2026-08');
      }
    });

    it('38. Salesman can view own salary via /api/v1/salaries/my', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salaries/my',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      for (const sal of body.data) {
        expect(sal.salesmanId).toBe(salesmanPersonId);
      }
    });

    it('39. Salesman cannot view another salesman salary details', async () => {
      const otherSalId = createdSalaryIds[0]; // Belongs to Suresh
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/salaries/${otherSalId}`,
        headers: { authorization: `Bearer ${salesmanToken}` }, // Ramesh requests
      });
      expect(res.statusCode).toBe(403);
    });

    it('40. Salesman cannot create salary (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          salesmanId: salesmanPersonId,
          salaryMonth: '2026-11',
          baseSalary: 30000,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('41. PATCH salary is rejected (400 Bad Request)', async () => {
      const salId = createdSalaryIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/salaries/${salId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { baseSalary: 50000 },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('42. DELETE salary is rejected (400 Bad Request)', async () => {
      const salId = createdSalaryIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/salaries/${salId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error?.message || res.body).toContain('immutable');
    });

    it('43, 44, 45, 46, 47, 48, 49, 50. Authoritative Salary Calculation & Ledger Filtering', async () => {
      // Set up a clean salesman with various transactions in October 2026:
      // 1. SALARY_DEDUCTION (CREDIT, 1500) -> MUST count towards salaryRecovery
      // 2. SALARY_DEDUCTION (CREDIT, 500) -> MUST count towards salaryRecovery
      // 3. HANDOVER_SHORT (DEBIT, 2000) -> must NOT reduce salary
      // 4. ADVANCE (DEBIT, 3000) -> must NOT reduce salary
      // 5. RECOVERY (CREDIT, 1000) -> must NOT reduce salary
      // 6. MANUAL_ADJUSTMENT (CREDIT, 400) -> must NOT reduce salary
      // 7. ABSENT attendance record (10 days absent) -> must NOT reduce salary
      const isoPerson = await prisma.person.create({
        data: {
          name: 'Calculation Isolation Salesman',
          phone: '+919999777709',
          type: PersonType.SALESMAN,
          active: true,
        },
      });
      createdPersonIds.push(isoPerson.id);

      const [tx1, tx2, tx3, tx4, tx5, tx6] = await Promise.all([
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-10T00:00:00.000Z'),
            type: LedgerTransactionType.SALARY_DEDUCTION,
            direction: LedgerDirection.CREDIT,
            amount: '1500.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-20T00:00:00.000Z'),
            type: LedgerTransactionType.SALARY_DEDUCTION,
            direction: LedgerDirection.CREDIT,
            amount: '500.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-15T00:00:00.000Z'),
            type: LedgerTransactionType.HANDOVER_SHORT,
            direction: LedgerDirection.DEBIT,
            amount: '2000.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-12T00:00:00.000Z'),
            type: LedgerTransactionType.ADVANCE,
            direction: LedgerDirection.DEBIT,
            amount: '3000.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-18T00:00:00.000Z'),
            type: LedgerTransactionType.RECOVERY,
            direction: LedgerDirection.CREDIT,
            amount: '1000.00',
            createdBy: adminUserId,
          },
        }),
        prisma.salesmanLedgerTransaction.create({
          data: {
            salesmanId: isoPerson.id,
            transactionDate: new Date('2026-10-22T00:00:00.000Z'),
            type: LedgerTransactionType.MANUAL_ADJUSTMENT,
            direction: LedgerDirection.CREDIT,
            amount: '400.00',
            notes: 'Manual recovery credit',
            createdBy: adminUserId,
          },
        }),
      ]);
      createdLedgerIds.push(tx1.id, tx2.id, tx3.id, tx4.id, tx5.id, tx6.id);

      // Create ABSENT attendance on 2026-10-05
      const att = await prisma.salesmanAttendance.create({
        data: {
          salesmanId: isoPerson.id,
          attendanceDate: new Date('2026-10-05T00:00:00.000Z'),
          status: AttendanceStatus.ABSENT,
          createdBy: adminUserId,
        },
      });
      createdAttendanceIds.push(att.id);

      // Create salary for October 2026: Base Salary = 30000
      // Expected:
      // salaryRecovery = 1500 + 500 = 2000
      // netSalary = 30000 - 2000 = 28000
      const salRes = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: isoPerson.id,
          salaryMonth: '2026-10',
          baseSalary: 30000,
        },
      });

      expect(salRes.statusCode).toBe(201);
      const salBody = JSON.parse(salRes.body);

      // Item 43 & 44: Salary recovery comes exclusively from SALARY_DEDUCTION CREDIT
      expect(salBody.data.salaryRecovery).toBe(2000);

      // Item 45: HANDOVER_SHORT does NOT reduce salary
      // Item 46: ADVANCE does NOT reduce salary
      // Item 47: RECOVERY does NOT reduce salary
      // Item 48: MANUAL_ADJUSTMENT does NOT reduce salary
      // Item 49: Attendance ABSENT does NOT reduce salary
      // Item 50: Net Salary = Base Salary - Salary Recovery
      expect(salBody.data.netSalary).toBe(28000);
      createdSalaryIds.push(salBody.data.id);
    });

    it('51. Decimal calculations remain exact without floating point errors', async () => {
      const isoPerson = await prisma.person.create({
        data: {
          name: 'Decimal Precision Salesman',
          phone: '+919999777710',
          type: PersonType.SALESMAN,
          active: true,
        },
      });
      createdPersonIds.push(isoPerson.id);

      const d1 = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: isoPerson.id,
          transactionDate: new Date('2026-11-10T00:00:00.000Z'),
          type: LedgerTransactionType.SALARY_DEDUCTION,
          direction: LedgerDirection.CREDIT,
          amount: '0.10',
          createdBy: adminUserId,
        },
      });
      const d2 = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: isoPerson.id,
          transactionDate: new Date('2026-11-12T00:00:00.000Z'),
          type: LedgerTransactionType.SALARY_DEDUCTION,
          direction: LedgerDirection.CREDIT,
          amount: '0.20',
          createdBy: adminUserId,
        },
      });
      createdLedgerIds.push(d1.id, d2.id);

      // Base 1000 - 0.30 = 999.70
      const salRes = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: isoPerson.id,
          salaryMonth: '2026-11',
          baseSalary: 1000,
        },
      });
      expect(salRes.statusCode).toBe(201);
      const salBody = JSON.parse(salRes.body);
      expect(salBody.data.salaryRecovery).toBe(0.3);
      expect(salBody.data.netSalary).toBe(999.7);
      createdSalaryIds.push(salBody.data.id);
    });

    it('52. Salary recovery for one month does NOT affect another month', async () => {
      const isoPerson = await prisma.person.create({
        data: {
          name: 'Month Separation Salesman',
          phone: '+919999777711',
          type: PersonType.SALESMAN,
          active: true,
        },
      });
      createdPersonIds.push(isoPerson.id);

      // Ledger deduction in December 2026
      const dDec = await prisma.salesmanLedgerTransaction.create({
        data: {
          salesmanId: isoPerson.id,
          transactionDate: new Date('2026-12-15T00:00:00.000Z'),
          type: LedgerTransactionType.SALARY_DEDUCTION,
          direction: LedgerDirection.CREDIT,
          amount: '5000.00',
          createdBy: adminUserId,
        },
      });
      createdLedgerIds.push(dDec.id);

      // Process November salary: deduction is 0
      const salNov = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: isoPerson.id,
          salaryMonth: '2026-11',
          baseSalary: 30000,
        },
      });
      const bodyNov = JSON.parse(salNov.body);
      expect(bodyNov.data.salaryRecovery).toBe(0);
      expect(bodyNov.data.netSalary).toBe(30000);
      createdSalaryIds.push(bodyNov.data.id);

      // Process December salary: deduction is 5000
      const salDec = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: isoPerson.id,
          salaryMonth: '2026-12',
          baseSalary: 30000,
        },
      });
      const bodyDec = JSON.parse(salDec.body);
      expect(bodyDec.data.salaryRecovery).toBe(5000);
      expect(bodyDec.data.netSalary).toBe(25000);
      createdSalaryIds.push(bodyDec.data.id);
    });

    it('53, 54, 55. Client cannot inject salaryRecovery or netSalary (server-authoritative)', async () => {
      const isoPerson = await prisma.person.create({
        data: {
          name: 'Injection Protection Salesman',
          phone: '+919999777712',
          type: PersonType.SALESMAN,
          active: true,
        },
      });
      createdPersonIds.push(isoPerson.id);

      // Client attempts to pass fake salaryRecovery and netSalary
      const salRes = await app.inject({
        method: 'POST',
        url: '/api/v1/salaries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          salesmanId: isoPerson.id,
          salaryMonth: '2026-10',
          baseSalary: 30000,
          salaryRecovery: 9999, // Injected fake recovery
          netSalary: 1, // Injected fake net
        },
      });

      expect(salRes.statusCode).toBe(201);
      const body = JSON.parse(salRes.body);
      // Server must have calculated 0 recovery and 30000 net, completely ignoring client inputs
      expect(body.data.salaryRecovery).toBe(0);
      expect(body.data.netSalary).toBe(30000);
      createdSalaryIds.push(body.data.id);
    });

    it('56. Salesman isolation remains strictly enforced', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/salaries/my',
        headers: { authorization: `Bearer ${otherSalesmanToken}` }, // Suresh requests
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      for (const sal of body.data) {
        expect(sal.salesmanId).toBe(otherSalesmanPersonId);
        expect(sal.salesmanId).not.toBe(salesmanPersonId);
      }
    });
  });

  // ============================================================
  // GROUP 3: INTEGRATION & REGRESSION (Items 57 - 60)
  // ============================================================
  describe('Group 3: Integration & Regression', () => {
    it('57. Existing Phase 2I salesman ledger behavior continues intact', async () => {
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

    it('58. Existing Phase 2J expense behavior continues intact', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/expenses/summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('operatingExpenses');
    });

    it('59. Existing Phase 2H handover behavior continues intact', async () => {
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

    it('60. Seed remains idempotent and seeded attendance + salary exist', async () => {
      const presentSeed = await prisma.salesmanAttendance.findUnique({
        where: {
          salesmanId_attendanceDate: {
            salesmanId: salesmanPersonId,
            attendanceDate: new Date('2026-09-25T00:00:00.000Z'),
          },
        },
      });
      expect(presentSeed).not.toBeNull();
      expect(presentSeed!.status).toBe('PRESENT');

      const absentSeed = await prisma.salesmanAttendance.findUnique({
        where: {
          salesmanId_attendanceDate: {
            salesmanId: salesmanPersonId,
            attendanceDate: new Date('2026-09-26T00:00:00.000Z'),
          },
        },
      });
      expect(absentSeed).not.toBeNull();
      expect(absentSeed!.status).toBe('ABSENT');

      const salarySeed = await prisma.salesmanSalary.findUnique({
        where: {
          salesmanId_salaryMonth: {
            salesmanId: salesmanPersonId,
            salaryMonth: new Date('2026-09-01T00:00:00.000Z'),
          },
        },
      });
      expect(salarySeed).not.toBeNull();
      expect(Number(salarySeed!.baseSalary)).toBe(30000);
      expect(Number(salarySeed!.salaryRecovery)).toBe(2000);
      expect(Number(salarySeed!.netSalary)).toBe(28000);
      expect(salarySeed!.status).toBe('PAID');
    });
  });
});
