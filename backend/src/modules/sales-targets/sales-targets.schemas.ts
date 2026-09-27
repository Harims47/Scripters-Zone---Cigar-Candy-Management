import { z } from 'zod';
import { Uom } from '@prisma/client';

export const salesTargetProductInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  targetQuantity: z.number().positive('Target quantity must be greater than 0'),
  uom: z.nativeEnum(Uom, { errorMap: () => ({ message: 'Invalid UOM' }) }),
});

export const createSalesTargetSchema = z.object({
  salesmanId: z.string().min(1, 'Salesman ID is required'),
  targetDate: z
    .string()
    .trim()
    .min(1, 'Target date is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid target date format. Expected YYYY-MM-DD',
    }),
  dailyRevenueTarget: z.number().nonnegative('Daily revenue target cannot be negative').default(0),
  productTargets: z.array(salesTargetProductInputSchema).optional().default([]),
});

export const updateSalesTargetSchema = z.object({
  dailyRevenueTarget: z.number().nonnegative('Daily revenue target cannot be negative').optional(),
  targetDate: z
    .string()
    .trim()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid target date format. Expected YYYY-MM-DD',
    })
    .optional(),
  active: z.boolean().optional(),
  productTargets: z.array(salesTargetProductInputSchema).optional(),
});

export const updateSalesTargetStatusSchema = z.object({
  active: z.boolean({ required_error: 'Active status is required' }),
});

export const salesTargetFilterQuerySchema = z.object({
  salesmanId: z.string().optional(),
  targetDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type SalesTargetProductInput = z.infer<typeof salesTargetProductInputSchema>;
export type CreateSalesTargetInput = z.infer<typeof createSalesTargetSchema>;
export type UpdateSalesTargetInput = z.infer<typeof updateSalesTargetSchema>;
export type UpdateSalesTargetStatusInput = z.infer<typeof updateSalesTargetStatusSchema>;
export type SalesTargetFilterQueryParams = z.infer<typeof salesTargetFilterQuerySchema>;
