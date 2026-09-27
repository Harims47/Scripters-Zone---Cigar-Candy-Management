import { z } from 'zod';
import { ProductCategory, Uom } from '@prisma/client';

export const CANDY_BRANDS = ['GPI', 'Fereo'] as const;
export const CIGARETTE_BRANDS = ['GPI', 'IPM'] as const;

export const CANDY_UOMS: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX];
export const CIGARETTE_UOMS: Uom[] = [Uom.CASE, Uom.M, Uom.PACKET];

// Helper to normalize input UOM (e.g. 'POCKET' -> 'PACKET')
export function normalizeUom(val: string): Uom {
  const upper = val.toUpperCase().trim();
  if (upper === 'POCKET') return Uom.PACKET;
  return upper as Uom;
}

export const uomSchema = z.string().transform((val, ctx) => {
  const normalized = normalizeUom(val);
  const validUoms: Uom[] = [Uom.JAR, Uom.HANGER, Uom.BOX, Uom.CASE, Uom.M, Uom.PACKET];
  if (!validUoms.includes(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid UOM "${val}". Allowed UOMs are: JAR, HANGER, BOX, CASE, M, PACKET.`,
    });
    return z.NEVER;
  }
  return normalized;
});

export const createProductSchema = z
  .object({
    name: z.string().min(2, 'Product name must be at least 2 characters').max(100),
    sku: z.string().max(50).optional(),
    category: z.nativeEnum(ProductCategory, {
      errorMap: () => ({ message: 'Category must be CANDY or CIGARETTE' }),
    }),
    brand: z.string().min(1, 'Brand is required').max(50),
    baseUom: uomSchema,
    salesUom: uomSchema.optional(),
    purchaseUom: uomSchema.optional(),
    standardPurchasePrice: z
      .number({ required_error: 'standardPurchasePrice is required' })
      .min(0, 'standardPurchasePrice must be greater than or equal to 0'),
    rate: z
      .number({ required_error: 'rate is required' })
      .min(0, 'rate must be greater than or equal to 0'),
    active: z.boolean().default(true),
    // Optional Cigarette Unit Configuration
    caseConversionFactor: z.number().positive('Case conversion factor must be greater than zero').optional(),
    caseConversionUnit: z.enum(['M', 'PACKET']).optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Brand validation by category
    if (data.category === ProductCategory.CANDY) {
      if (['IPM'].includes(data.brand.toUpperCase())) {
        ctx.addIssue({
          path: ['brand'],
          code: z.ZodIssueCode.custom,
          message: `Invalid brand "${data.brand}" for Candy category. Allowed brands: ${CANDY_BRANDS.join(', ')} or any confectionery brand`,
        });
      }

      // 2. UOM validation by category (Candy)
      if (!CANDY_UOMS.includes(data.baseUom)) {
        ctx.addIssue({
          path: ['baseUom'],
          code: z.ZodIssueCode.custom,
          message: `Invalid UOM "${data.baseUom}" for Candy category. Allowed UOMs: ${CANDY_UOMS.join(', ')}`,
        });
      }

      // 3. Candy products must NOT expose or receive cigarette unit configuration
      if (data.caseConversionFactor !== undefined || data.caseConversionUnit !== undefined) {
        ctx.addIssue({
          path: ['caseConversionFactor'],
          code: z.ZodIssueCode.custom,
          message: 'Candy products must NOT have cigarette Unit Configuration',
        });
      }
    } else if (data.category === ProductCategory.CIGARETTE) {
      if (['FEREO'].includes(data.brand.toUpperCase())) {
        ctx.addIssue({
          path: ['brand'],
          code: z.ZodIssueCode.custom,
          message: `Invalid brand "${data.brand}" for Cigarette category. Allowed brands: ${CIGARETTE_BRANDS.join(', ')} or any tobacco brand`,
        });
      }

      // UOM validation by category (Cigarette)
      if (!CIGARETTE_UOMS.includes(data.baseUom)) {
        ctx.addIssue({
          path: ['baseUom'],
          code: z.ZodIssueCode.custom,
          message: `Invalid UOM "${data.baseUom}" for Cigarette category. Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`,
        });
      }
    }
  });

export const updateProductSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    sku: z.string().max(50).optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    brand: z.string().min(1).max(50).optional(),
    baseUom: uomSchema.optional(),
    salesUom: uomSchema.optional(),
    purchaseUom: uomSchema.optional(),
    standardPurchasePrice: z.number().min(0).optional(),
    rate: z.number().min(0).optional(),
    active: z.boolean().optional(),
    caseConversionFactor: z.number().positive().optional(),
    caseConversionUnit: z.enum(['M', 'PACKET']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === ProductCategory.CANDY) {
      if (data.brand && ['IPM'].includes(data.brand.toUpperCase())) {
        ctx.addIssue({
          path: ['brand'],
          code: z.ZodIssueCode.custom,
          message: `Invalid brand "${data.brand}" for Candy category.`,
        });
      }
      if (data.baseUom && !CANDY_UOMS.includes(data.baseUom)) {
        ctx.addIssue({
          path: ['baseUom'],
          code: z.ZodIssueCode.custom,
          message: `Invalid UOM "${data.baseUom}" for Candy category. Allowed UOMs: ${CANDY_UOMS.join(', ')}`,
        });
      }
      if (data.caseConversionFactor !== undefined || data.caseConversionUnit !== undefined) {
        ctx.addIssue({
          path: ['caseConversionFactor'],
          code: z.ZodIssueCode.custom,
          message: 'Candy products must NOT have cigarette Unit Configuration',
        });
      }
    } else if (data.category === ProductCategory.CIGARETTE) {
      if (data.brand && ['FEREO'].includes(data.brand.toUpperCase())) {
        ctx.addIssue({
          path: ['brand'],
          code: z.ZodIssueCode.custom,
          message: `Invalid brand "${data.brand}" for Cigarette category.`,
        });
      }
      if (data.baseUom && !CIGARETTE_UOMS.includes(data.baseUom)) {
        ctx.addIssue({
          path: ['baseUom'],
          code: z.ZodIssueCode.custom,
          message: `Invalid UOM "${data.baseUom}" for Cigarette category. Allowed UOMs: ${CIGARETTE_UOMS.join(', ')}`,
        });
      }
    }
  });

export const updateProductStatusSchema = z.object({
  active: z.boolean({ required_error: 'active status is required' }),
});

export const productFilterQuerySchema = z.object({
  category: z.nativeEnum(ProductCategory).optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export const createInitialStockSchema = z.object({
  quantity: z.number({ required_error: 'quantity is required' }).positive('Initial stock quantity must be greater than zero'),
  uom: uomSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;
export type ProductFilterQueryParams = z.infer<typeof productFilterQuerySchema>;
export type CreateInitialStockInput = z.infer<typeof createInitialStockSchema>;
