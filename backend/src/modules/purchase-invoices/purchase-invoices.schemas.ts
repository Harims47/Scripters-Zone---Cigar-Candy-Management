import { z } from 'zod';
import { PurchaseInvoiceStatus, Uom } from '@prisma/client';

export const purchaseInvoiceItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  uom: z.nativeEnum(Uom, { errorMap: () => ({ message: 'Invalid UOM' }) }),
  actualRate: z.number().nonnegative('Actual rate cannot be negative'),
  discount: z.number().nonnegative('Discount cannot be negative').default(0),
});

export const createPurchaseInvoiceSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  invoiceNumber: z
    .string()
    .trim()
    .min(1, 'Invoice number is required and cannot be empty')
    .max(50, 'Invoice number cannot exceed 50 characters'),
  invoiceDate: z.string().refine(
    (val) => {
      const parsed = Date.parse(val);
      return !isNaN(parsed);
    },
    { message: 'Valid invoice date is required (e.g., YYYY-MM-DD)' }
  ),
  items: z
    .array(purchaseInvoiceItemInputSchema)
    .min(1, 'Purchase invoice must contain at least one item'),
});

export const purchaseInvoiceFilterQuerySchema = z.object({
  supplierId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.nativeEnum(PurchaseInvoiceStatus).optional(),
});

export type PurchaseInvoiceItemInput = z.infer<typeof purchaseInvoiceItemInputSchema>;
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;
export type PurchaseInvoiceFilterQueryParams = z.infer<typeof purchaseInvoiceFilterQuerySchema>;
