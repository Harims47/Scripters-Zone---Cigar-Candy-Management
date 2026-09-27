import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(100),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits').max(20).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  active: z.boolean().default(true),
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits').max(20).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  active: z.boolean().optional(),
});

export const updateSupplierStatusSchema = z.object({
  active: z.boolean({ required_error: 'active status is required' }),
});

export const supplierFilterQuerySchema = z.object({
  active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type UpdateSupplierStatusInput = z.infer<typeof updateSupplierStatusSchema>;
export type SupplierFilterQueryParams = z.infer<typeof supplierFilterQuerySchema>;
