import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CANDY_UOMS,
  CIGARETTE_UOMS,
  CreateInitialStockInput,
  CreateProductInput,
  ProductFilterQueryParams,
  UpdateProductInput,
} from './products.schemas.js';
import { InitialStockSummary, ProductSummary } from './products.types.js';
import { Prisma, ProductCategory, Uom } from '@prisma/client';

export class ProductsService {
  /**
   * Helper to format Prisma product into clean ProductSummary without floating point issues
   */
  private static sanitizeProduct(product: any): ProductSummary {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      brand: product.brand,
      baseUom: product.baseUom,
      salesUom: product.salesUom,
      purchaseUom: product.purchaseUom,
      standardPurchasePrice: product.standardPurchasePrice.toNumber(),
      salesRate: product.salesRate.toNumber(),
      active: product.active,
      conversions: product.uomConversions?.map((c: any) => ({
        fromUom: c.fromUom,
        toUom: c.toUom,
        conversionFactor: c.conversionFactor.toNumber(),
      })),
      hasInitialStock: !!product.initialStock,
      initialStock: product.initialStock
        ? {
            id: product.initialStock.id,
            quantity: product.initialStock.quantity.toNumber(),
            uom: product.initialStock.uom,
            createdAt: product.initialStock.createdAt,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Retrieves all products matching optional filter criteria
   */
  public static async getAllProducts(filters?: ProductFilterQueryParams): Promise<ProductSummary[]> {
    const where: Prisma.ProductWhereInput = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.brand) {
      where.brand = filters.brand;
    }

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        uomConversions: true,
        initialStock: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => this.sanitizeProduct(p));
  }

  /**
   * Retrieves single product by ID with unit conversions and initial stock status
   */
  public static async getProductById(id: string): Promise<ProductSummary> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        uomConversions: true,
        initialStock: true,
      },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${id}" not found`);
    }

    return this.sanitizeProduct(product);
  }

  /**
   * Creates a new Product Master record with duplicate protection and cigarette unit configuration
   */
  public static async createProduct(input: CreateProductInput): Promise<ProductSummary> {
    const trimmedName = input.name.trim();

    // 1. Duplicate check: prevent duplicate product with same name, category, and brand
    const existing = await prisma.product.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        category: input.category,
        brand: input.brand,
      },
    });

    if (existing) {
      if (!existing.active) {
        // If the product was previously deactivated/deleted, remove it so new creation succeeds cleanly
        await this.deleteProduct(existing.id);
      } else {
        throw AppError.conflict(
          `A product named "${trimmedName}" under category ${input.category} and brand ${input.brand} already exists`
        );
      }
    }

    // 2. Generate or validate SKU
    let sku = input.sku?.trim().toUpperCase();
    if (!sku) {
      let candidate = '';
      let exists = true;
      while (exists) {
        candidate = `${input.category === ProductCategory.CANDY ? 'CND' : 'CIG'}-${input.brand.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
        const check = await prisma.product.findUnique({ where: { sku: candidate } });
        if (!check) {
          sku = candidate;
          exists = false;
        }
      }
    } else {
      const existingSku = await prisma.product.findUnique({ where: { sku } });
      if (existingSku) {
        throw AppError.conflict(`Product with SKU "${sku}" already exists`);
      }
    }

    // 3. Persist product record
    const newProduct = await prisma.product.create({
      data: {
        name: trimmedName,
        sku,
        category: input.category,
        brand: input.brand,
        baseUom: input.baseUom,
        salesUom: input.salesUom || input.baseUom,
        purchaseUom: input.purchaseUom || input.baseUom,
        standardPurchasePrice: new Prisma.Decimal(input.standardPurchasePrice),
        salesRate: new Prisma.Decimal(input.rate),
        active: input.active ?? true,
      },
    });

    // 4. Attach Unit Configuration for Cigarette products
    if (input.category === ProductCategory.CIGARETTE) {
      // Standard cigarette rule: 1 M = 100 PACKET
      await prisma.productUomConversion.create({
        data: {
          productId: newProduct.id,
          fromUom: Uom.M,
          toUom: Uom.PACKET,
          conversionFactor: new Prisma.Decimal(100),
        },
      });

      // Product-specific Case conversion if provided
      if (input.caseConversionFactor && input.caseConversionFactor > 0) {
        const targetUnit = input.caseConversionUnit === 'PACKET' ? Uom.PACKET : Uom.M;
        await prisma.productUomConversion.create({
          data: {
            productId: newProduct.id,
            fromUom: Uom.CASE,
            toUom: targetUnit,
            conversionFactor: new Prisma.Decimal(input.caseConversionFactor),
          },
        });
      }
    }

    return this.getProductById(newProduct.id);
  }

  /**
   * Updates an existing product record
   */
  public static async updateProduct(id: string, input: UpdateProductInput): Promise<ProductSummary> {
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { uomConversions: true },
    });

    if (!existing) {
      throw AppError.notFound(`Product with ID "${id}" not found`);
    }

    const targetCategory = input.category || existing.category;
    const targetBrand = input.brand || existing.brand;
    const targetName = input.name !== undefined ? input.name.trim() : existing.name;

    // Check duplicate if name/category/brand changed
    if (
      targetName !== existing.name ||
      targetCategory !== existing.category ||
      targetBrand !== existing.brand
    ) {
      const duplicate = await prisma.product.findFirst({
        where: {
          id: { not: id },
          name: { equals: targetName, mode: 'insensitive' },
          category: targetCategory,
          brand: targetBrand,
        },
      });

      if (duplicate) {
        throw AppError.conflict(
          `Another product named "${targetName}" under category ${targetCategory} and brand ${targetBrand} already exists`
        );
      }
    }

    // Update product table
    await prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: targetName } : {}),
        ...(input.sku !== undefined ? { sku: input.sku.trim().toUpperCase() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.baseUom !== undefined ? { baseUom: input.baseUom } : {}),
        ...(input.salesUom !== undefined ? { salesUom: input.salesUom } : {}),
        ...(input.purchaseUom !== undefined ? { purchaseUom: input.purchaseUom } : {}),
        ...(input.standardPurchasePrice !== undefined
          ? { standardPurchasePrice: new Prisma.Decimal(input.standardPurchasePrice) }
          : {}),
        ...(input.rate !== undefined ? { salesRate: new Prisma.Decimal(input.rate) } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    // Update product-specific Case conversion if cigarette
    if (targetCategory === ProductCategory.CIGARETTE && input.caseConversionFactor && input.caseConversionFactor > 0) {
      const targetUnit = input.caseConversionUnit === 'PACKET' ? Uom.PACKET : Uom.M;
      await prisma.productUomConversion.upsert({
        where: {
          productId_fromUom_toUom: {
            productId: id,
            fromUom: Uom.CASE,
            toUom: targetUnit,
          },
        },
        update: {
          conversionFactor: new Prisma.Decimal(input.caseConversionFactor),
        },
        create: {
          productId: id,
          fromUom: Uom.CASE,
          toUom: targetUnit,
          conversionFactor: new Prisma.Decimal(input.caseConversionFactor),
        },
      });
    }

    return this.getProductById(id);
  }

  /**
   * Activates or deactivates a product
   */
  public static async updateProductStatus(id: string, active: boolean): Promise<ProductSummary> {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound(`Product with ID "${id}" not found`);
    }

    await prisma.product.update({
      where: { id },
      data: { active },
    });

    return this.getProductById(id);
  }

  /**
   * Retrieves initial opening stock for a product
   */
  public static async getInitialStock(productId: string): Promise<InitialStockSummary> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { initialStock: true },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${productId}" not found`);
    }

    if (!product.initialStock) {
      throw AppError.notFound(`No initial stock recorded for product "${product.name}"`);
    }

    return {
      id: product.initialStock.id,
      productId: product.id,
      productName: product.name,
      quantity: product.initialStock.quantity.toNumber(),
      uom: product.initialStock.uom,
      createdBy: product.initialStock.createdBy,
      createdAt: product.initialStock.createdAt,
      updatedAt: product.initialStock.updatedAt,
    };
  }

  /**
   * Records initial opening stock for a product.
   * STRICT BUSINESS RULES (Section 21 - 25):
   * 1. Initial Stock can be entered ONLY ONCE per product.
   * 2. Repeated initialization attempt MUST BE REJECTED with 409 Conflict.
   * 3. Quantity must be > 0.
   * 4. UOM must match product category UOM.
   * 5. Product must exist and be active.
   */
  public static async createInitialStock(
    productId: string,
    input: CreateInitialStockInput,
    createdBy?: string
  ): Promise<InitialStockSummary> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { initialStock: true },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${productId}" not found`);
    }

    if (!product.active) {
      throw AppError.badRequest(`Cannot record initial stock for inactive product "${product.name}"`);
    }

    // 1. One-time initialization rule
    if (product.initialStock) {
      throw AppError.conflict(
        `Initial stock has already been recorded for product "${product.name}". Repeated initialization is strictly prohibited.`
      );
    }

    // 2. Validate UOM matches product category
    if (product.category === ProductCategory.CANDY && !CANDY_UOMS.includes(input.uom)) {
      throw AppError.badRequest(
        `Invalid initial stock UOM "${input.uom}" for CANDY product "${product.name}". Allowed UOMs: ${CANDY_UOMS.join(', ')}`
      );
    }

    if (product.category === ProductCategory.CIGARETTE && !CIGARETTE_UOMS.includes(input.uom)) {
      throw AppError.badRequest(
        `Invalid initial stock UOM "${input.uom}" for CIGARETTE product "${product.name}". Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`
      );
    }

    const created = await prisma.initialStock.create({
      data: {
        productId,
        quantity: new Prisma.Decimal(input.quantity),
        uom: input.uom,
        createdBy: createdBy || null,
      },
    });

    return {
      id: created.id,
      productId: product.id,
      productName: product.name,
      quantity: created.quantity.toNumber(),
      uom: created.uom,
      createdBy: created.createdBy,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Delete product by ID. If product has no transaction history, hard deletes it.
   * If product has transaction history, sets active = false.
   */
  public static async deleteProduct(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        purchaseInvoiceItems: { select: { id: true } },
        stockMovements: { select: { id: true } },
        issueStockItems: { select: { id: true } },
        handoverItems: { select: { id: true } },
      },
    });

    if (!product) {
      throw AppError.notFound(`Product with ID "${id}" not found.`);
    }

    const hasTransactions =
      product.purchaseInvoiceItems.length > 0 ||
      product.stockMovements.length > 0 ||
      product.issueStockItems.length > 0 ||
      product.handoverItems.length > 0;

    if (!hasTransactions) {
      await prisma.$transaction(async (tx) => {
        await tx.salesTargetProduct.deleteMany({ where: { productId: id } });
        await tx.dailyHandoverEmptyPacket.deleteMany({ where: { productId: id } });
        await tx.dailyHandoverCoupon.deleteMany({ where: { productId: id } });
        await tx.productUomConversion.deleteMany({ where: { productId: id } });
        await tx.initialStock.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
      return { deleted: true };
    } else {
      await prisma.product.update({
        where: { id },
        data: { active: false },
      });
      return { deleted: false, deactivated: true };
    }
  }
}

