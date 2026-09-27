import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceFilterQueryParams,
} from './purchase-invoices.schemas.js';
import {
  PurchaseInvoiceItemSummary,
  PurchaseInvoiceSummary,
} from './purchase-invoices.types.js';
import {
  Prisma,
  ProductCategory,
  PurchaseInvoiceStatus,
  StockMovementType,
  Uom,
} from '@prisma/client';
import { UnitConversionService } from '../products/unit-conversion.service.js';

const CANDY_UOMS: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX];
const CIGARETTE_UOMS: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET, Uom.POCKET];

export class PurchaseInvoicesService {
  /**
   * Helper to format Prisma purchase invoice into clean PurchaseInvoiceSummary
   */
  private static sanitizeInvoice(invoice: any): PurchaseInvoiceSummary {
    return {
      id: invoice.id,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier?.name || '',
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      grossTotal: invoice.grossTotal.toNumber(),
      totalItemDiscount: invoice.totalItemDiscount.toNumber(),
      netTotal: invoice.netTotal.toNumber(),
      status: invoice.status,
      createdBy: invoice.createdBy,
      itemsCount: invoice.items?.length || invoice._count?.items || 0,
      items: invoice.items?.map((item: any): PurchaseInvoiceItemSummary => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || '',
        productSku: item.product?.sku || null,
        productCategory: item.product?.category || '',
        quantity: item.quantity.toNumber(),
        uom: item.uom,
        actualRate: item.actualRate.toNumber(),
        discount: item.discount.toNumber(),
        grossTotal: item.grossTotal.toNumber(),
        netTotal: item.netTotal.toNumber(),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  /**
   * Retrieves all purchase invoices with optional filters
   */
  public static async getAllPurchaseInvoices(
    filters?: PurchaseInvoiceFilterQueryParams
  ): Promise<PurchaseInvoiceSummary[]> {
    const where: Prisma.PurchaseInvoiceWhereInput = {};

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.invoiceNumber && filters.invoiceNumber.trim().length > 0) {
      where.invoiceNumber = { contains: filters.invoiceNumber.trim(), mode: 'insensitive' };
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) {
        where.invoiceDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.invoiceDate.lte = new Date(filters.endDate);
      }
    }

    const invoices = await prisma.purchaseInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true } },
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return invoices.map((inv) => this.sanitizeInvoice(inv));
  }

  /**
   * Retrieves single purchase invoice by ID with items and calculations
   */
  public static async getPurchaseInvoiceById(id: string): Promise<PurchaseInvoiceSummary> {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, category: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw AppError.notFound(`Purchase invoice with ID "${id}" not found`);
    }

    return this.sanitizeInvoice(invoice);
  }

  /**
   * Creates a new Purchase Invoice and atomically records stock receiving.
   * STRICT BUSINESS RULES (Sections 4, 10, 11, 14, 16, 17, 19, 20):
   * 1. Purchase Invoice is the ONLY normal stock receiving flow.
   * 2. Supplier must exist and be active.
   * 3. Invoice Number must be unique per supplier.
   * 4. Products must exist and be active.
   * 5. UOM must match product category.
   * 6. Calculations are server-authoritative.
   * 7. Discount <= Item Gross.
   * 8. Creation of Purchase Invoice, Items, and StockMovements (RECEIPT) is 100% atomic in a transaction.
   */
  public static async createPurchaseInvoice(
    input: CreatePurchaseInvoiceInput,
    createdBy?: string
  ): Promise<PurchaseInvoiceSummary> {
    const trimmedInvoiceNumber = input.invoiceNumber.trim();

    // 1. Validate Supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
    });

    if (!supplier) {
      throw AppError.notFound(`Supplier with ID "${input.supplierId}" not found`);
    }

    if (!supplier.active) {
      throw AppError.badRequest(`Cannot create purchase invoice for inactive supplier "${supplier.name}"`);
    }

    // 2. Validate Duplicate Invoice for Supplier
    const existingInvoice = await prisma.purchaseInvoice.findUnique({
      where: {
        supplierId_invoiceNumber: {
          supplierId: input.supplierId,
          invoiceNumber: trimmedInvoiceNumber,
        },
      },
    });

    if (existingInvoice) {
      throw AppError.conflict(
        `Purchase invoice with number "${trimmedInvoiceNumber}" already exists for supplier "${supplier.name}"`
      );
    }

    // 3. Validate Items and Products
    if (!input.items || input.items.length === 0) {
      throw AppError.badRequest('Purchase invoice must contain at least one item');
    }

    interface ProcessedItem {
      productId: string;
      productName: string;
      category: ProductCategory;
      baseUom: Uom;
      quantity: number;
      uom: Uom;
      actualRate: number;
      discount: Prisma.Decimal;
      grossTotal: Prisma.Decimal;
      netTotal: Prisma.Decimal;
      baseQuantity: Prisma.Decimal;
    }

    const processedItems: ProcessedItem[] = [];
    let invoiceGross = new Prisma.Decimal(0);
    let invoiceDiscount = new Prisma.Decimal(0);

    for (let index = 0; index < input.items.length; index++) {
      const item = input.items[index];

      // Product validation
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { uomConversions: true },
      });

      if (!product) {
        throw AppError.notFound(`Product with ID "${item.productId}" (item #${index + 1}) not found`);
      }

      if (!product.active) {
        throw AppError.badRequest(
          `Cannot purchase inactive product "${product.name}" (item #${index + 1})`
        );
      }

      // UOM category validation
      if (product.category === ProductCategory.CANDY && !CANDY_UOMS.includes(item.uom)) {
        throw AppError.badRequest(
          `Invalid UOM "${item.uom}" for CANDY product "${product.name}". Allowed UOMs: ${CANDY_UOMS.join(', ')}`
        );
      }

      if (product.category === ProductCategory.CIGARETTE && !CIGARETTE_UOMS.includes(item.uom)) {
        throw AppError.badRequest(
          `Invalid UOM "${item.uom}" for CIGARETTE product "${product.name}". Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`
        );
      }

      // Quantity and rate validation
      if (item.quantity <= 0) {
        throw AppError.badRequest(`Quantity must be greater than 0 for product "${product.name}"`);
      }

      if (item.actualRate < 0) {
        throw AppError.badRequest(`Actual rate cannot be negative for product "${product.name}"`);
      }

      const discountValue = item.discount ?? 0;
      if (discountValue < 0) {
        throw AppError.badRequest(`Discount cannot be negative for product "${product.name}"`);
      }

      // Item Gross: quantity * actualRate
      const itemGrossNumber = Math.round(item.quantity * item.actualRate * 100) / 100;
      const itemDiscountNumber = Math.round(discountValue * 100) / 100;

      // Rule: Discount <= Item Gross
      if (itemDiscountNumber > itemGrossNumber) {
        throw AppError.badRequest(
          `Item discount (₹${itemDiscountNumber}) cannot exceed item gross total (₹${itemGrossNumber}) for product "${product.name}"`
        );
      }

      const itemGross = new Prisma.Decimal(itemGrossNumber);
      const itemDiscount = new Prisma.Decimal(itemDiscountNumber);
      const itemNet = itemGross.minus(itemDiscount);

      invoiceGross = invoiceGross.plus(itemGross);
      invoiceDiscount = invoiceDiscount.plus(itemDiscount);

      // Normalize received quantity to product base UOM
      let baseQtyNumber = item.quantity;
      if (item.uom !== product.baseUom) {
        const conversion = await UnitConversionService.convertQuantity({
          productId: product.id,
          quantity: item.quantity,
          fromUom: item.uom,
          toUom: product.baseUom,
        });
        baseQtyNumber = conversion.convertedQuantity;
      }

      processedItems.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        baseUom: product.baseUom,
        quantity: item.quantity,
        uom: item.uom,
        actualRate: item.actualRate,
        discount: itemDiscount,
        grossTotal: itemGross,
        netTotal: itemNet,
        baseQuantity: new Prisma.Decimal(baseQtyNumber),
      });
    }

    const invoiceNet = invoiceGross.minus(invoiceDiscount);

    // 4. Atomic Transaction: Purchase Invoice + Items + StockMovements
    let createdInvoiceId: string;

    try {
      createdInvoiceId = await prisma.$transaction(async (tx) => {
        // 4a. Create Purchase Invoice
        const invoice = await tx.purchaseInvoice.create({
          data: {
            supplierId: input.supplierId,
            invoiceNumber: trimmedInvoiceNumber,
            invoiceDate: new Date(input.invoiceDate),
            grossTotal: invoiceGross,
            totalItemDiscount: invoiceDiscount,
            netTotal: invoiceNet,
            status: PurchaseInvoiceStatus.RECEIVED,
            createdBy: createdBy || null,
          },
        });

        // 4b. Create Purchase Invoice Items and StockMovements
        for (const item of processedItems) {
          await tx.purchaseInvoiceItem.create({
            data: {
              purchaseInvoiceId: invoice.id,
              productId: item.productId,
              quantity: new Prisma.Decimal(item.quantity),
              uom: item.uom,
              actualRate: new Prisma.Decimal(item.actualRate),
              discount: item.discount,
              grossTotal: item.grossTotal,
              netTotal: item.netTotal,
            },
          });

          // 4c. Create StockMovement representing RECEIPT
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: StockMovementType.RECEIPT,
              quantity: new Prisma.Decimal(item.quantity),
              uom: item.uom,
              baseQuantity: item.baseQuantity,
              purchaseInvoiceId: invoice.id,
              createdBy: createdBy || null,
            },
          });
        }

        return invoice.id;
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw AppError.conflict(
          `Purchase invoice with number "${trimmedInvoiceNumber}" already exists for this supplier`
        );
      }
      throw err;
    }

    return this.getPurchaseInvoiceById(createdInvoiceId);
  }
}
