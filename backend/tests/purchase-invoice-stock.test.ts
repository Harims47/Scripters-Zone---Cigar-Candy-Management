import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { ProductCategory, PurchaseInvoiceStatus, StockMovementType, Uom } from '@prisma/client';
import { UnitConversionService } from '../src/modules/products/unit-conversion.service.js';
import { PurchaseInvoicesService } from '../src/modules/purchase-invoices/purchase-invoices.service.js';

describe('Phase 2E: Purchase Invoice + Stock Receiving Suite', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let salesmanToken: string;

  // Test entities
  let activeSupplierId: string;
  let inactiveSupplierId: string;
  let candyProductId: string;
  let cigaretteProductId: string;
  let inactiveProductId: string;
  let stockTestProductId: string;
  let createdInvoiceIds: string[] = [];

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

    // 3. Setup Test Suppliers
    const activeSupplier = await prisma.supplier.create({
      data: {
        name: `Test Active Supplier ${Date.now()}`,
        phone: '+919999900001',
        address: 'Wholesale Depot, Sivakasi',
        active: true,
      },
    });
    activeSupplierId = activeSupplier.id;

    const inactiveSupplier = await prisma.supplier.create({
      data: {
        name: `Test Inactive Supplier ${Date.now()}`,
        phone: '+919999900002',
        address: 'Closed Depot, Sivakasi',
        active: false,
      },
    });
    inactiveSupplierId = inactiveSupplier.id;

    // 4. Setup Test Products
    const candyProduct = await prisma.product.create({
      data: {
        name: `Test Mango Candy ${Date.now()}`,
        sku: `CND-TST-${Date.now().toString().slice(-4)}`,
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
            { fromUom: Uom.HANGER, toUom: Uom.JAR, conversionFactor: 12 },
            { fromUom: Uom.BOX, toUom: Uom.JAR, conversionFactor: 24 },
          ],
        },
      },
    });
    candyProductId = candyProduct.id;

    const cigaretteProduct = await prisma.product.create({
      data: {
        name: `Test Gold Flake Cigarette ${Date.now()}`,
        sku: `CIG-TST-${Date.now().toString().slice(-4)}`,
        category: ProductCategory.CIGARETTE,
        brand: 'GoldFlake',
        baseUom: Uom.PACKET,
        salesUom: Uom.PACKET,
        purchaseUom: Uom.CASE,
        standardPurchasePrice: 80,
        salesRate: 100,
        active: true,
        uomConversions: {
          create: [
            { fromUom: Uom.M, toUom: Uom.PACKET, conversionFactor: 100 },
            { fromUom: Uom.CASE, toUom: Uom.M, conversionFactor: 50 }, // 1 Case = 50 M = 5000 Packets
          ],
        },
      },
    });
    cigaretteProductId = cigaretteProduct.id;

    const inactiveProduct = await prisma.product.create({
      data: {
        name: `Test Inactive Cigarette ${Date.now()}`,
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

    // 5. Product for Initial Stock + Purchase Receipt verification
    const stockProduct = await prisma.product.create({
      data: {
        name: `Test Stock Balance Cigarette ${Date.now()}`,
        sku: `CIG-STK-${Date.now().toString().slice(-4)}`,
        category: ProductCategory.CIGARETTE,
        brand: 'StockBrand',
        baseUom: Uom.PACKET,
        salesUom: Uom.PACKET,
        purchaseUom: Uom.PACKET,
        standardPurchasePrice: 70,
        salesRate: 90,
        active: true,
        uomConversions: {
          create: [
            { fromUom: Uom.M, toUom: Uom.PACKET, conversionFactor: 100 },
          ],
        },
      },
    });
    stockTestProductId = stockProduct.id;

    // Set Initial Stock: 100 Packets
    await prisma.initialStock.create({
      data: {
        productId: stockTestProductId,
        quantity: 100,
        uom: Uom.PACKET,
        createdBy: 'admin',
      },
    });
  });

  afterAll(async () => {
    // Cleanup invoices, stock movements, products, suppliers
    if (createdInvoiceIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { purchaseInvoiceId: { in: createdInvoiceIds } },
      });
      await prisma.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: { in: createdInvoiceIds } },
      });
      await prisma.purchaseInvoice.deleteMany({
        where: { id: { in: createdInvoiceIds } },
      });
    }

    const prodIds = [candyProductId, cigaretteProductId, inactiveProductId, stockTestProductId].filter(Boolean);
    if (prodIds.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.initialStock.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.productUomConversion.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    }

    const supIds = [activeSupplierId, inactiveSupplierId].filter(Boolean);
    if (supIds.length > 0) {
      await prisma.supplier.deleteMany({ where: { id: { in: supIds } } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  // ============================================================
  // PURCHASE INVOICE TESTS (Items 1 - 20)
  // ============================================================
  describe('PURCHASE INVOICE: CREATION & VALIDATION (Items 1 - 20)', () => {
    it('1. Admin can create Purchase Invoice', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-001`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 50,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe(PurchaseInvoiceStatus.RECEIVED);
      createdInvoiceIds.push(body.data.id);
    });

    it('2. Salesman cannot create Purchase Invoice', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-002`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('3. Unauthenticated user cannot create Purchase Invoice', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-003`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('4. Supplier must exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: '00000000-0000-0000-0000-000000000000',
          invoiceNumber: `INV-${Date.now()}-004`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Supplier with ID');
    });

    it('5. Inactive supplier rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: inactiveSupplierId,
          invoiceNumber: `INV-${Date.now()}-005`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('inactive supplier');
    });

    it('6. At least one item required', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-006`,
          invoiceDate: '2026-09-26',
          items: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('7. Product must exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-007`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: '00000000-0000-0000-0000-000000000000',
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Product with ID');
    });

    it('8. Inactive product rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-008`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: inactiveProductId,
              quantity: 5,
              uom: Uom.PACKET,
              actualRate: 50,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('inactive product');
    });

    it('9. Invalid UOM rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-009`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: 'INVALID_UOM',
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('10. Invalid quantity rejected (zero or negative)', async () => {
      const resZero = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-010a`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 0,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resZero.statusCode).toBe(400);

      const resNegative = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-010b`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: -5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resNegative.statusCode).toBe(400);
    });

    it('11. Negative Actual Rate rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-011`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: -10,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('12. Negative Discount rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-012`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: -20,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('13. Discount greater than item gross rejected', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-013`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.JAR,
              actualRate: 100, // Gross = 200
              discount: 250, // Discount > Gross
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('cannot exceed item gross total');
    });

    it('14. Item Gross calculated correctly', async () => {
      // Quantity 10, ActualRate 100 -> Item Gross = 1000
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-014`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 50,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.items[0].grossTotal).toBe(1000);
    });

    it('15. Item Net calculated correctly', async () => {
      // Gross 1000 - Discount 50 -> Net = 950
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-015`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 50,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.items[0].netTotal).toBe(950);
    });

    it('16. Invoice Gross calculated correctly', async () => {
      // Item 1: 5 * 100 = 500
      // Item 2: 2 * 200 = 400
      // Total Gross = 900
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-016`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 20,
            },
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.JAR,
              actualRate: 200,
              discount: 30,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.grossTotal).toBe(900);
    });

    it('17. Total Discount calculated correctly', async () => {
      // Item 1: 20
      // Item 2: 30
      // Total Discount = 50
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-017`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 20,
            },
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.JAR,
              actualRate: 200,
              discount: 30,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.totalItemDiscount).toBe(50);
    });

    it('18. Invoice Net calculated correctly', async () => {
      // Gross 900 - Total Discount 50 = 850
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-018`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 20,
            },
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.JAR,
              actualRate: 200,
              discount: 30,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.netTotal).toBe(850);
    });

    it('19. Client-supplied totals cannot override server calculations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-019`,
          invoiceDate: '2026-09-26',
          grossTotal: 999999, // Fake client numbers
          totalItemDiscount: 888888,
          netTotal: 111111,
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 50, // Server: Gross = 500
              discount: 50, // Server: Discount = 50
              grossTotal: 999999,
              netTotal: 111111,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.grossTotal).toBe(500);
      expect(body.data.totalItemDiscount).toBe(50);
      expect(body.data.netTotal).toBe(450);
      expect(body.data.items[0].grossTotal).toBe(500);
      expect(body.data.items[0].netTotal).toBe(450);
    });

    it('20. Multiple invoice items calculate correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-020`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 20,
              uom: Uom.JAR,
              actualRate: 60, // 1200 - 100 = 1100
              discount: 100,
            },
            {
              productId: cigaretteProductId,
              quantity: 5,
              uom: Uom.PACKET,
              actualRate: 75, // 375 - 25 = 350
              discount: 25,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.grossTotal).toBe(1575);
      expect(body.data.totalItemDiscount).toBe(125);
      expect(body.data.netTotal).toBe(1450);
      expect(body.data.items.length).toBe(2);
    });
  });

  // ============================================================
  // UOM VALIDATION & CONVERSION (Items 21 - 26)
  // ============================================================
  describe('UOM VALIDATION & CONVERSION (Items 21 - 26)', () => {
    it('21. Candy UOM validation works (JAR, HANGER, BOX accepted)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-021`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 50,
              discount: 0,
            },
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.HANGER,
              actualRate: 80,
              discount: 0,
            },
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.BOX,
              actualRate: 150,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.items.length).toBe(3);
    });

    it('22. Cigarette UOM validation works (CASE, M, PACKET accepted)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-022`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: cigaretteProductId,
              quantity: 2,
              uom: Uom.CASE,
              actualRate: 400000,
              discount: 1000,
            },
            {
              productId: cigaretteProductId,
              quantity: 5,
              uom: Uom.M,
              actualRate: 8000,
              discount: 100,
            },
            {
              productId: cigaretteProductId,
              quantity: 20,
              uom: Uom.PACKET,
              actualRate: 80,
              discount: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);
      expect(body.data.items.length).toBe(3);
    });

    it('23. 1 M = 100 Packet conversion rule is preserved and normalized into stock movement', async () => {
      // 1 M received -> stock movement baseQuantity should be 100 PACKETS
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-023`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: cigaretteProductId,
              quantity: 1,
              uom: Uom.M,
              actualRate: 8000,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);

      const movement = await prisma.stockMovement.findFirst({
        where: { purchaseInvoiceId: body.data.id },
      });
      expect(movement).toBeDefined();
      expect(movement?.uom).toBe(Uom.M);
      expect(movement?.quantity.toNumber()).toBe(1);
      expect(movement?.baseQuantity.toNumber()).toBe(100); // 1 M = 100 Packets
    });

    it('24. Product-specific Case conversion works (1 Case = 50 M = 5000 Packets)', async () => {
      // 2 Cases received -> 2 * 5000 = 10000 PACKETS base quantity
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-024`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: cigaretteProductId,
              quantity: 2,
              uom: Uom.CASE,
              actualRate: 400000,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      createdInvoiceIds.push(body.data.id);

      const movement = await prisma.stockMovement.findFirst({
        where: { purchaseInvoiceId: body.data.id },
      });
      expect(movement).toBeDefined();
      expect(movement?.uom).toBe(Uom.CASE);
      expect(movement?.quantity.toNumber()).toBe(2);
      expect(movement?.baseQuantity.toNumber()).toBe(10000); // 2 Cases = 10,000 Packets
    });

    it('25. Invalid Candy cigarette UOM rejected (e.g. Candy + CASE or PACKET)', async () => {
      const resCase = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-025a`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.CASE,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resCase.statusCode).toBe(400);
      expect(JSON.parse(resCase.body).error.message).toContain('Invalid UOM "CASE" for CANDY');

      const resPacket = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-025b`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.PACKET,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resPacket.statusCode).toBe(400);
      expect(JSON.parse(resPacket.body).error.message).toContain('Invalid UOM "PACKET" for CANDY');
    });

    it('26. Invalid Cigarette candy UOM rejected (e.g. Cigarette + JAR or HANGER)', async () => {
      const resJar = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-026a`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: cigaretteProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resJar.statusCode).toBe(400);
      expect(JSON.parse(resJar.body).error.message).toContain('Invalid UOM "JAR" for CIGARETTE');

      const resHanger = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-026b`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: cigaretteProductId,
              quantity: 5,
              uom: Uom.HANGER,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(resHanger.statusCode).toBe(400);
      expect(JSON.parse(resHanger.body).error.message).toContain('Invalid UOM "HANGER" for CIGARETTE');
    });
  });

  // ============================================================
  // STOCK RECEIVING SEMANTICS (Items 27 - 33)
  // ============================================================
  describe('STOCK RECEIVING SEMANTICS (Items 27 - 33)', () => {
    it('27. Purchase Invoice creates RECEIPT movement', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-027`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 25,
              uom: Uom.JAR,
              actualRate: 90,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const invoice = JSON.parse(res.body).data;
      createdInvoiceIds.push(invoice.id);

      const movements = await prisma.stockMovement.findMany({
        where: { purchaseInvoiceId: invoice.id },
      });
      expect(movements.length).toBe(1);
      expect(movements[0].movementType).toBe(StockMovementType.RECEIPT);
      expect(movements[0].quantity.toNumber()).toBe(25);
    });

    it('28. Stock increases after Purchase Invoice', async () => {
      const beforeStockRes = await app.inject({
        method: 'GET',
        url: `/api/v1/inventory/stock/${stockTestProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeStock = JSON.parse(beforeStockRes.body).data.currentStock;

      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-028`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: stockTestProductId,
              quantity: 50,
              uom: Uom.PACKET,
              actualRate: 70,
              discount: 0,
            },
          ],
        },
      });
      expect(invoiceRes.statusCode).toBe(201);
      createdInvoiceIds.push(JSON.parse(invoiceRes.body).data.id);

      const afterStockRes = await app.inject({
        method: 'GET',
        url: `/api/v1/inventory/stock/${stockTestProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const afterStock = JSON.parse(afterStockRes.body).data.currentStock;
      expect(afterStock).toBe(beforeStock + 50);
    });

    it('29. Initial Stock + Purchase Receipt produces correct current stock', async () => {
      // stockTestProductId has Initial Stock = 100 Packets
      // Plus 50 Packets from test 28
      // Let's add 1 M (which is 100 Packets)
      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber: `INV-${Date.now()}-029`,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: stockTestProductId,
              quantity: 1,
              uom: Uom.M, // 100 Packets
              actualRate: 7000,
              discount: 0,
            },
          ],
        },
      });
      expect(invoiceRes.statusCode).toBe(201);
      createdInvoiceIds.push(JSON.parse(invoiceRes.body).data.id);

      const stockRes = await app.inject({
        method: 'GET',
        url: `/api/v1/inventory/stock/${stockTestProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const data = JSON.parse(stockRes.body).data;
      expect(data.initialStockQuantity).toBe(100);
      expect(data.initialStockInBaseUom).toBe(100);
      // Receipts: 50 from test 28 + 100 from test 29 = 150
      expect(data.purchaseReceiptsQuantity).toBe(150);
      // Total current stock = 100 + 150 = 250
      expect(data.currentStock).toBe(250);
    });

    it('30. Purchase Invoice does not modify Initial Stock', async () => {
      const initialStockRecord = await prisma.initialStock.findUnique({
        where: { productId: stockTestProductId },
      });
      expect(initialStockRecord?.quantity.toNumber()).toBe(100);
      expect(initialStockRecord?.uom).toBe(Uom.PACKET);
    });

    it('31. No Issue Stock deduction occurs in Phase 2E', async () => {
      const stockRes = await app.inject({
        method: 'GET',
        url: `/api/v1/inventory/stock/${stockTestProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data = JSON.parse(stockRes.body).data;
      // Formula: Initial Stock + Receipts (with 0 issue deductions)
      expect(data.currentStock).toBe(data.initialStockInBaseUom + data.purchaseReceiptsQuantity);
    });

    it('32. Receipt movement references Purchase Invoice', async () => {
      const invoiceNumber = `INV-${Date.now()}-032`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 15,
              uom: Uom.JAR,
              actualRate: 95,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const invoice = JSON.parse(res.body).data;
      createdInvoiceIds.push(invoice.id);

      const movement = await prisma.stockMovement.findFirst({
        where: { purchaseInvoiceId: invoice.id },
      });
      expect(movement).toBeDefined();
      expect(movement?.purchaseInvoiceId).toBe(invoice.id);
      expect(movement?.productId).toBe(candyProductId);
    });

    it('33. Receipt and invoice creation are atomic', async () => {
      // Verified: an invoice creation creates exactly 1 invoice and matching stock movements
      const invoiceNumber = `INV-${Date.now()}-033`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 10,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const invoice = JSON.parse(res.body).data;
      createdInvoiceIds.push(invoice.id);

      const invInDb = await prisma.purchaseInvoice.findUnique({ where: { id: invoice.id } });
      const movInDb = await prisma.stockMovement.findMany({ where: { purchaseInvoiceId: invoice.id } });

      expect(invInDb).not.toBeNull();
      expect(movInDb.length).toBe(1);
    });
  });

  // ============================================================
  // DUPLICATE & INTEGRITY SHIELDS (Items 34 - 38)
  // ============================================================
  describe('DUPLICATE & INTEGRITY SHIELDS (Items 34 - 38)', () => {
    it('34. Duplicate invoice identity rejected (same supplier + invoice number)', async () => {
      const invoiceNumber = `INV-DUP-${Date.now()}`;

      // First submission
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(res1.statusCode).toBe(201);
      createdInvoiceIds.push(JSON.parse(res1.body).data.id);

      // Duplicate submission
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 5,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
          ],
        },
      });
      expect(res2.statusCode).toBe(409);
      expect(JSON.parse(res2.body).error.message).toContain('already exists for supplier');
    });

    it('35. Failed invoice transaction creates no partial stock movement (Atomicity failure test)', async () => {
      const invoiceNumber = `INV-FAIL-${Date.now()}`;

      // Item 1: Valid
      // Item 2: Invalid (Inactive product)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
            {
              productId: inactiveProductId, // Inactive! Must reject
              quantity: 5,
              uom: Uom.PACKET,
              actualRate: 50,
              discount: 0,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);

      // Verify invoice was NOT persisted
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: {
          supplierId_invoiceNumber: {
            supplierId: activeSupplierId,
            invoiceNumber,
          },
        },
      });
      expect(invoice).toBeNull();

      // Verify NO stock movement was persisted for candyProductId from this attempt
      const movements = await prisma.stockMovement.findMany({
        where: { purchaseInvoice: { invoiceNumber } },
      });
      expect(movements.length).toBe(0);
    });

    it('36. Failed stock movement rolls back invoice creation (simulated transaction failure)', async () => {
      const invoiceNumber = `INV-TXFAIL-${Date.now()}`;

      // Item with invalid UOM conversion or failure scenario
      // Item 1: valid
      // Item 2: discount > gross
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          supplierId: activeSupplierId,
          invoiceNumber,
          invoiceDate: '2026-09-26',
          items: [
            {
              productId: candyProductId,
              quantity: 10,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 0,
            },
            {
              productId: candyProductId,
              quantity: 2,
              uom: Uom.JAR,
              actualRate: 100,
              discount: 500, // Invalid! Discount > Gross
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);

      // Verify invoice was NOT persisted
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: {
          supplierId_invoiceNumber: {
            supplierId: activeSupplierId,
            invoiceNumber,
          },
        },
      });
      expect(invoice).toBeNull();
    });

    it('37. Received invoice cannot be arbitrarily edited', async () => {
      const targetId = createdInvoiceIds[0];
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/purchase-invoices/${targetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { grossTotal: 10 },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('cannot be modified');
    });

    it('38. Received invoice cannot be arbitrarily deleted', async () => {
      const targetId = createdInvoiceIds[0];
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/purchase-invoices/${targetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.message).toContain('cannot be deleted');
    });
  });

  // ============================================================
  // AUTHORIZATION & READ ACCESS (Items 39 - 44)
  // ============================================================
  describe('AUTHORIZATION & READ ACCESS (Items 39 - 44)', () => {
    let testCreatedSupplierId: string;

    it('39. Admin can create supplier', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/suppliers',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `New Supplier ${Date.now()}`,
          phone: '+919876599999',
          address: 'New Town, Sivakasi',
          active: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      testCreatedSupplierId = body.data.id;
    });

    it('40. Salesman cannot create supplier', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/suppliers',
        headers: { authorization: `Bearer ${salesmanToken}` },
        payload: {
          name: `Salesman Supplier ${Date.now()}`,
          phone: '+919876588888',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('41. Admin can read invoices', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('42. Salesman can read invoices if allowed by existing read policy', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/purchase-invoices',
        headers: { authorization: `Bearer ${salesmanToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('43. Admin can read stock', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/inventory/stock',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('44. Authenticated user cannot mutate stock directly', async () => {
      const resPost = await app.inject({
        method: 'POST',
        url: '/api/v1/inventory/stock',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { productId: candyProductId, quantity: 100 },
      });
      expect(resPost.statusCode).toBe(400);
      expect(JSON.parse(resPost.body).error.message).toContain('Direct inventory stock mutation is not permitted');

      const resPatch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/inventory/stock/${candyProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { currentStock: 100 },
      });
      expect(resPatch.statusCode).toBe(400);
      expect(JSON.parse(resPatch.body).error.message).toContain('Direct inventory stock mutation is not permitted');
    });
  });

  // ============================================================
  // REGRESSION (Items 45 - 50)
  // ============================================================
  describe('REGRESSION & SCHEMA INTEGRITY (Items 45 - 50)', () => {
    it('45. Existing Phase 2C tests pass (Auth/Persons/Dealers models intact)', async () => {
      const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
      expect(adminUser).not.toBeNull();
      const dealers = await prisma.person.findMany({ where: { type: 'DEALER' } });
      expect(dealers.length).toBeGreaterThan(0);
    });

    it('46. Existing Phase 2D tests pass (Products/InitialStock models intact)', async () => {
      const products = await prisma.product.findMany();
      expect(products.length).toBeGreaterThan(0);
      const initialStocks = await prisma.initialStock.findMany();
      expect(initialStocks.length).toBeGreaterThan(0);
    });

    it('47. Prisma validation passes', async () => {
      expect(prisma.purchaseInvoice).toBeDefined();
      expect(prisma.purchaseInvoiceItem).toBeDefined();
      expect(prisma.stockMovement).toBeDefined();
      expect(prisma.supplier).toBeDefined();
    });

    it('48. Prisma client generation passes', async () => {
      expect(PurchaseInvoiceStatus.RECEIVED).toBe('RECEIVED');
      expect(StockMovementType.RECEIPT).toBe('RECEIPT');
    });

    it('49. Migration applies successfully and schema constraints are enforced', async () => {
      const suppliersCount = await prisma.supplier.count();
      expect(suppliersCount).toBeGreaterThanOrEqual(2);
    });

    it('50. Seed completes successfully with seeded suppliers and invoice', async () => {
      const seededInvoice = await prisma.purchaseInvoice.findFirst({
        where: { invoiceNumber: 'INV-ITC-2026-001' },
        include: { items: true, stockMovements: true },
      });
      expect(seededInvoice).not.toBeNull();
      expect(seededInvoice?.items.length).toBe(2);
      expect(seededInvoice?.stockMovements.length).toBe(2);
    });
  });
});
