import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, checkDatabaseConnection } from '../src/db/prisma.js';
import { UserRole, PersonType, ProductCategory, Uom } from '@prisma/client';
import argon2 from 'argon2';

describe('Phase 2B: PostgreSQL + Prisma Single-Tenant Database Foundation', () => {
  beforeAll(async () => {
    // Ensure DB connection is established
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Database connection is healthy and responsive', async () => {
    const health = await checkDatabaseConnection();
    expect(health.isConnected).toBe(true);
    expect(health.latencyMs).toBeDefined();
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('2. Strict Single-Tenant verification: NO tenant tables or tenantId columns in database', async () => {
    // Query information_schema for any table containing 'tenant'
    const tenantTables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name ILIKE '%tenant%'
    `;
    expect(tenantTables.length).toBe(0);

    // Query information_schema for any column containing 'tenant'
    const tenantColumns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND column_name ILIKE '%tenant%'
    `;
    expect(tenantColumns.length).toBe(0);
  });

  it('3. Admin user exists, has ADMIN role, and Argon2id hashed password', async () => {
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      include: { person: true },
    });

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe(UserRole.ADMIN);
    expect(admin?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(admin?.isActive).toBe(true);

    // Verify password verification with Argon2
    const isValid = await argon2.verify(admin!.passwordHash, 'Admin@12345');
    expect(isValid).toBe(true);
  });

  it('4. Salesman user exists, has SALESMAN role, and is linked to Person record', async () => {
    const salesman = await prisma.user.findUnique({
      where: { username: 'ramesh' },
      include: { person: true },
    });

    expect(salesman).not.toBeNull();
    expect(salesman?.role).toBe(UserRole.SALESMAN);
    expect(salesman?.person?.type).toBe(PersonType.SALESMAN);
    expect(salesman?.person?.name).toBe('Ramesh Kumar');

    const isValid = await argon2.verify(salesman!.passwordHash, 'Sales@12345');
    expect(isValid).toBe(true);
  });

  it('5. Dealer rule: Dealers MUST NOT have login User accounts', async () => {
    const dealers = await prisma.person.findMany({
      where: { type: PersonType.DEALER },
      include: { user: true },
    });

    expect(dealers.length).toBeGreaterThan(0);
    for (const dealer of dealers) {
      expect(dealer.type).toBe(PersonType.DEALER);
      expect(dealer.user).toBeNull(); // Strictly no user record
    }
  });

  it('6. Product Master: Decimal prices, categories, and NO emptyPocket/coupon master rates', async () => {
    const products = await prisma.product.findMany({
      include: { uomConversions: true },
    });

    expect(products.length).toBeGreaterThanOrEqual(5);

    for (const prod of products) {
      expect(prod.standardPurchasePrice).toBeDefined();
      expect(prod.salesRate).toBeDefined();
      // Ensure Decimal methods exist
      expect(typeof prod.standardPurchasePrice.toNumber).toBe('function');
      expect(prod.salesRate.toNumber()).toBeGreaterThan(0);

      // Verify no emptyPocketValue / couponValue fields on the model
      const prodKeys = Object.keys(prod);
      expect(prodKeys).not.toContain('emptyPocketValue');
      expect(prodKeys).not.toContain('emptyPocketRate');
      expect(prodKeys).not.toContain('couponValue');
      expect(prodKeys).not.toContain('couponRate');
    }
  });

  it('7. Product UOM conversions: Product-specific Case and M conversions', async () => {
    const marlboro = await prisma.product.findFirst({
      where: { brand: 'Marlboro' },
      include: { uomConversions: true },
    });

    expect(marlboro).not.toBeNull();
    const mConversion = marlboro?.uomConversions.find(
      (c) => c.fromUom === Uom.M && c.toUom === Uom.POCKET
    );
    expect(mConversion).toBeDefined();
    expect(mConversion?.conversionFactor.toNumber()).toBe(100);

    const caseConversion = marlboro?.uomConversions.find(
      (c) => c.fromUom === Uom.CASE && c.toUom === Uom.POCKET
    );
    expect(caseConversion).toBeDefined();
    expect(caseConversion?.conversionFactor.toNumber()).toBe(600);

    const gpi = await prisma.product.findFirst({
      where: { brand: 'GPI' },
      include: { uomConversions: true },
    });
    expect(gpi?.category).toBe(ProductCategory.CANDY);
    expect(gpi?.baseUom).toBe(Uom.JAR);
  });
});
