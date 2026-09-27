import { z } from 'zod';

export const createSalarySchema = z.object({
  salesmanId: z
    .string({ required_error: 'salesmanId is required' })
    .uuid('Invalid salesman ID format'),
  salaryMonth: z
    .string({ required_error: 'salaryMonth is required' })
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'salaryMonth must be in YYYY-MM or YYYY-MM-DD format'),
  baseSalary: z
    .number({ required_error: 'baseSalary is required' })
    .positive('baseSalary must be greater than zero'),
});

export const salaryFiltersSchema = z.object({
  salesmanId: z.string().uuid('Invalid salesman ID format').optional(),
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'fromMonth must be in YYYY-MM or YYYY-MM-DD format')
    .optional(),
  toMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'toMonth must be in YYYY-MM or YYYY-MM-DD format')
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const mySalaryFiltersSchema = z.object({
  fromMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'fromMonth must be in YYYY-MM or YYYY-MM-DD format')
    .optional(),
  toMonth: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'toMonth must be in YYYY-MM or YYYY-MM-DD format')
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});
