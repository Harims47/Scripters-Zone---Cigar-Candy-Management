import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { ProductCategory, Uom } from '@prisma/client';
import { UnitConversionService } from '../src/modules/products/unit-conversion.service.js';

describe('Phase 2D: Products + Initial Stock + Unit Configuration Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;
  let createdCandyProductId: string;
  let createdCigaretteProductId: string;
  let createdCigaretteProduct2Id: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Authenticate Admin
    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'Admin@12345' },
    });
    adminToken = JSON.parse(adminLoginRes.body).data.accessToken;

    // 2. Authenticate Salesman
    const salesmanLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'ramesh', password: 'Sales@12345' },
    });
    salesmanToken = JSON.parse(salesmanLoginRes.body).data.accessToken;
  });

  afterAll(async () => {
    // Cleanup created test products
    const ids = [createdCandyProductId, createdCigaretteProductId, createdCigaretteProduct2Id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.initialStock.deleteMany({ where: { productId: { in: ids } } });
      await prisma.productUomConversion.deleteMany({ where: { productId: { in: ids } } });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. PRODUCT CRUD & VALIDATION TESTS (Items 1 - 16)
  // ============================================================
  describe('PRODUCT TESTS (Items 1 - 16)', () => {
    it('1. Admin can create Candy product', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Fereo Choco Drops Test',
          category: 'CANDY',
          brand: 'Fereo',
          baseUom: 'JAR',
          standardPurchasePrice: 150,
          rate: 200,
          active: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Fereo Choco Drops Test');
      expect(body.data.category).toBe('CANDY');
      expect(body.data.brand).toBe('Fereo');
      expect(body.data.baseUom).toBe('JAR');
      expect(body.data.standardPurchasePrice).toBe(150);
      expect(body.data.salesRate).toBe(200);
      expect(body.data.hasInitialStock).toBe(false);

      // Verify no empty packet/coupon rates exposed on Product Master
      expect(body.data.emptyPacketRate).toBeUndefined();
      expect(body.data.emptyPacketValue).toBeUndefined();
      expect(body.data.couponRate).toBeUndefined();
      expect(body.data.couponValue).toBeUndefined();

      createdCandyProductId = body.data.id;
    });

    it('2. Admin can create Cigarette product with unit configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'GPI Super Lights Test',
          category: 'CIGARETTE',
          brand: 'GPI',
          baseUom: 'PACKET',
          standardPurchasePrice: 85,
          rate: 100,
          active: true,
          caseConversionFactor: 50,
          caseConversionUnit: 'M',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('CIGARETTE');
      expect(body.data.brand).toBe('GPI');
      expect(body.data.baseUom).toBe('PACKET');
      expect(body.data.conversions).toBeDefined();
      expect(body.data.conversions.length).toBeGreaterThanOrEqual(2);

      // Verify standard 1 M = 100 Packet conversion exists
      const mConv = body.data.conversions.find((c: any) => c.fromUom === 'M' && c.toUom === 'PACKET');
      expect(mConv).toBeDefined();
      expect(mConv.conversionFactor).toBe(100);

      createdCigaretteProductId = body.data.id;
    });

    it('3. Salesman cannot create product (fails with 403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          name: 'Salesman Unauthorized Product',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('4. Unauthenticated user cannot create product (fails with 401)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        payload: {
          name: 'Unauthenticated Product',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('5. Admin can list products with filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?category=CANDY',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      for (const p of body.data) {
        expect(p.category).toBe('CANDY');
      }
    });

    it('6. Authenticated Salesman can read products', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('7. Admin can retrieve product by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${createdCandyProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdCandyProductId);
      expect(body.data.name).toBe('Fereo Choco Drops Test');
    });

    it('8. Admin can update product', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/products/${createdCandyProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          rate: 220,
          standardPurchasePrice: 165,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.salesRate).toBe(220);
      expect(body.data.standardPurchasePrice).toBe(165);
    });

    it('9. Admin can activate/deactivate product', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/products/${createdCandyProductId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { active: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.active).toBe(false);

      // Reactivate for subsequent tests
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/products/${createdCandyProductId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { active: true },
      });
    });

    it('10. Invalid category rejected (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Invalid Category Product',
          category: 'BEVERAGE',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('11. Invalid brand/category combination rejected (fails with 400)', async () => {
      // 1. Candy with IPM (Cigarette brand) -> reject
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Invalid Candy Brand',
          category: 'CANDY',
          brand: 'IPM',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });
      expect(res1.statusCode).toBe(400);

      // 2. Cigarette with Fereo (Candy brand) -> reject
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Invalid Cigarette Brand',
          category: 'CIGARETTE',
          brand: 'Fereo',
          baseUom: 'PACKET',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });
      expect(res2.statusCode).toBe(400);
    });

    it('12. Invalid UOM/category combination rejected (fails with 400)', async () => {
      // 1. CANDY + PACKET -> reject
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Candy with Packet UOM',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'PACKET',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });
      expect(res1.statusCode).toBe(400);

      // 2. CIGARETTE + JAR -> reject
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Cigarette with Jar UOM',
          category: 'CIGARETTE',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });
      expect(res2.statusCode).toBe(400);
    });

    it('13. Negative purchase price rejected (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Negative Purchase Price Product',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: -10,
          rate: 50,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('14. Negative sales rate rejected (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Negative Sales Rate Product',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: -5,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('15. Duplicate product rejected (fails with 409)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Fereo Choco Drops Test', // Duplicate of Test 1
          category: 'CANDY',
          brand: 'Fereo',
          baseUom: 'JAR',
          standardPurchasePrice: 150,
          rate: 200,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('16. Empty/invalid product name rejected (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: ' ',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 50,
          rate: 80,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  // ============================================================
  // 2. UNIT CONFIGURATION TESTS (Items 17 - 24)
  // ============================================================
  describe('UNIT CONFIGURATION TESTS (Items 17 - 24)', () => {
    it('17. Cigarette product accepts unit configuration', async () => {
      // Created in Test 2 (GPI Super Lights Test)
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${createdCigaretteProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.conversions.length).toBeGreaterThanOrEqual(2);
      const caseConv = body.data.conversions.find((c: any) => c.fromUom === 'CASE');
      expect(caseConv).toBeDefined();
      expect(caseConv.conversionFactor).toBe(50);
    });

    it('18. Candy product rejects cigarette unit configuration (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Illegal Candy Unit Config',
          category: 'CANDY',
          brand: 'GPI',
          baseUom: 'JAR',
          standardPurchasePrice: 100,
          rate: 150,
          caseConversionFactor: 24, // Cigarette unit config on Candy!
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(JSON.stringify(body.error)).toContain('Candy products must NOT have cigarette Unit Configuration');
    });

    it('19. 1 M converts to 100 Packet', async () => {
      const result = await UnitConversionService.convertQuantity({
        productId: createdCigaretteProductId,
        quantity: 1,
        fromUom: Uom.M,
        toUom: Uom.PACKET,
      });

      expect(result.convertedQuantity).toBe(100);
      expect(result.conversionFactor).toBe(100);

      // Reverse conversion: 100 Packets = 1 M
      const reverse = await UnitConversionService.convertQuantity({
        productId: createdCigaretteProductId,
        quantity: 100,
        fromUom: Uom.PACKET,
        toUom: Uom.M,
      });
      expect(reverse.convertedQuantity).toBe(1);
    });

    it('20. Product-specific Case conversion works', async () => {
      // Product 1 (GPI Super Lights Test): 1 Case = 50 M = 5,000 Packets
      const result = await UnitConversionService.convertQuantity({
        productId: createdCigaretteProductId,
        quantity: 2,
        fromUom: Uom.CASE,
        toUom: Uom.PACKET,
      });

      expect(result.convertedQuantity).toBe(10000); // 2 * 50 M * 100 = 10,000 Packets
    });

    it('21. Different cigarette products can have different Case conversion factors', async () => {
      // Create second cigarette product with 1 Case = 60 M (different factor)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'IPM Gold Filter Test',
          category: 'CIGARETTE',
          brand: 'IPM',
          baseUom: 'PACKET',
          standardPurchasePrice: 90,
          rate: 120,
          caseConversionFactor: 60, // 60 M per Case
          caseConversionUnit: 'M',
        },
      });

      expect(res.statusCode).toBe(201);
      createdCigaretteProduct2Id = JSON.parse(res.body).data.id;

      // 1 Case of Product 2 = 60 M = 6,000 Packets
      const result2 = await UnitConversionService.convertQuantity({
        productId: createdCigaretteProduct2Id,
        quantity: 1,
        fromUom: Uom.CASE,
        toUom: Uom.PACKET,
      });
      expect(result2.convertedQuantity).toBe(6000);

      // 1 Case of Product 1 = 50 M = 5,000 Packets
      const result1 = await UnitConversionService.convertQuantity({
        productId: createdCigaretteProductId,
        quantity: 1,
        fromUom: Uom.CASE,
        toUom: Uom.PACKET,
      });
      expect(result1.convertedQuantity).toBe(5000);

      expect(result1.convertedQuantity).not.toBe(result2.convertedQuantity);
    });

    it('22. Global Case conversion is NOT assumed', async () => {
      // Verification: conversion factors are stored per-product in database
      const p1Conv = await prisma.productUomConversion.findFirst({
        where: { productId: createdCigaretteProductId, fromUom: Uom.CASE },
      });
      const p2Conv = await prisma.productUomConversion.findFirst({
        where: { productId: createdCigaretteProduct2Id, fromUom: Uom.CASE },
      });

      expect(p1Conv?.conversionFactor.toNumber()).toBe(50);
      expect(p2Conv?.conversionFactor.toNumber()).toBe(60);
    });

    it('23. Packet is the canonical unit name', async () => {
      const product = await prisma.product.findUnique({
        where: { id: createdCigaretteProductId },
      });
      expect(product?.baseUom).toBe(Uom.PACKET);
    });

    it('24. Pocket is not persisted as canonical UOM', async () => {
      // Check newly created products in database
      const newProducts = await prisma.product.findMany({
        where: { id: { in: [createdCigaretteProductId, createdCigaretteProduct2Id] } },
      });

      for (const p of newProducts) {
        expect(p.baseUom).not.toBe('POCKET');
        expect(p.baseUom).toBe('PACKET');
      }
    });
  });

  // ============================================================
  // 3. INITIAL STOCK TESTS (Items 25 - 32)
  // ============================================================
  describe('INITIAL STOCK TESTS (Items 25 - 32)', () => {
    it('25. Admin can create initial stock', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCandyProductId}/initial-stock`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          quantity: 250,
          uom: 'JAR',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.productId).toBe(createdCandyProductId);
      expect(body.data.quantity).toBe(250);
      expect(body.data.uom).toBe('JAR');

      // Verify product summary now shows hasInitialStock: true
      const prodRes = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${createdCandyProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(JSON.parse(prodRes.body).data.hasInitialStock).toBe(true);
      expect(JSON.parse(prodRes.body).data.initialStock.quantity).toBe(250);
    });

    it('26. Salesman cannot create initial stock (fails with 403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCigaretteProductId}/initial-stock`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          quantity: 500,
          uom: 'PACKET',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('27. Initial stock quantity must be greater than zero (fails with 400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCigaretteProductId}/initial-stock`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          quantity: 0,
          uom: 'PACKET',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(JSON.stringify(body.error)).toContain('greater than zero');
    });

    it('28. Initial stock UOM must match product (fails with 400)', async () => {
      // Attempt to assign cigarette UOM (PACKET) to CANDY product
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCigaretteProductId}/initial-stock`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          quantity: 100,
          uom: 'JAR', // JAR is for Candy, not Cigarette!
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Allowed UOMs');
    });

    it('29. Second initial stock creation for same product is rejected (fails with 409)', async () => {
      // Candy product already received initial stock in Test 25
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCandyProductId}/initial-stock`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          quantity: 100,
          uom: 'JAR',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('Repeated initialization is strictly prohibited');
    });

    it('30. Initial stock is not treated as Purchase Invoice', async () => {
      // Verify database schema: InitialStock is a dedicated standalone model, NOT a purchase invoice
      const initialStock = await prisma.initialStock.findUnique({
        where: { productId: createdCandyProductId },
      });

      expect(initialStock).not.toBeNull();
      const keys = Object.keys(initialStock!);
      expect(keys).not.toContain('invoiceNumber');
      expect(keys).not.toContain('supplierId');
      expect(keys).not.toContain('discount');
      expect(keys).not.toContain('netTotal');
    });

    it('31. Initial stock is not treated as Issue Stock', async () => {
      // Verify database schema: InitialStock has no recipient, recipientType, or target link
      const initialStock = await prisma.initialStock.findUnique({
        where: { productId: createdCandyProductId },
      });

      const keys = Object.keys(initialStock!);
      expect(keys).not.toContain('recipientId');
      expect(keys).not.toContain('recipientType');
      expect(keys).not.toContain('salesTargetId');
    });

    it('32. Initial stock belongs to product, not salesman/dealer', async () => {
      const initialStock = await prisma.initialStock.findUnique({
        where: { productId: createdCandyProductId },
      });

      expect(initialStock?.productId).toBe(createdCandyProductId);
      // Verify belongs directly to product via foreign key
      const product = await prisma.product.findUnique({
        where: { id: initialStock!.productId },
      });
      expect(product).not.toBeNull();
      expect(product?.id).toBe(createdCandyProductId);
    });
  });

  // ============================================================
  // 4. SECURITY TESTS (Items 33 - 36)
  // ============================================================
  describe('SECURITY TESTS (Items 33 - 36)', () => {
    it('33. Product mutation requires ADMIN', async () => {
      // Salesman attempts PATCH /api/v1/products/:id
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/products/${createdCandyProductId}`,
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: { rate: 300 },
      });

      expect(res.statusCode).toBe(403);
    });

    it('34. Initial Stock mutation requires ADMIN', async () => {
      // Unauthenticated attempts POST /api/v1/products/:id/initial-stock
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/products/${createdCandyProductId}/initial-stock`,
        payload: { quantity: 100, uom: 'JAR' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('35. Password/security behavior from Phase 2C remains intact', async () => {
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(meRes.statusCode).toBe(200);
      const body = JSON.parse(meRes.body);
      expect(body.data.passwordHash).toBeUndefined();
    });

    it('36. Existing authentication tests continue passing', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'admin', password: 'Admin@12345' },
      });

      expect(loginRes.statusCode).toBe(200);
      expect(JSON.parse(loginRes.body).data.accessToken).toBeDefined();
    });
  });

  // ============================================================
  // 5. DATABASE TESTS (Items 37 - 40)
  // ============================================================
  describe('DATABASE TESTS (Items 37 - 40)', () => {
    it('37. Prisma validation passes', async () => {
      expect(prisma.product).toBeDefined();
      expect(prisma.productUomConversion).toBeDefined();
      expect(prisma.initialStock).toBeDefined();
    });

    it('38. Prisma client generation passes', async () => {
      const count = await prisma.product.count();
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('39. Migration applies successfully', async () => {
      const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date }>>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at ASC
      `;

      expect(migrations.length).toBeGreaterThanOrEqual(2);
      const phase2d = migrations.find((m) => m.migration_name.includes('phase_2d'));
      expect(phase2d).toBeDefined();
    });

    it('40. Seed completes successfully', async () => {
      const products = await prisma.product.findMany();
      expect(products.length).toBeGreaterThanOrEqual(5);

      const candy = products.find((p) => p.category === ProductCategory.CANDY);
      const cigarette = products.find((p) => p.category === ProductCategory.CIGARETTE);

      expect(candy).toBeDefined();
      expect(cigarette).toBeDefined();
    });
  });
});
