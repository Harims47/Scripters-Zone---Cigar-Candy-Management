import { z } from 'zod';
import { ExpenseCategory } from './expenses.types.js';

export const createExpenseSchema = z
  .object({
    expenseDate: z
      .string({ required_error: 'expenseDate is required' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expenseDate must be in YYYY-MM-DD format'),
    category: z.nativeEnum(ExpenseCategory, {
      errorMap: (_issue, ctx) => {
        const val = ctx.data;
        if (val === 'EMPTY_PACKET' || val === 'COUPON' || val === 'DISCOUNT') {
          return {
            message: `${val} cannot be manually created. It is derived automatically from Daily Handover.`,
          };
        }
        return {
          message: `category must be one of: ${Object.values(ExpenseCategory).join(', ')}`,
        };
      },
    }),
    amount: z
      .number({ required_error: 'amount is required' })
      .positive('amount must be greater than zero'),
    notes: z
      .string({ required_error: 'notes are required' })
      .min(1, 'notes are mandatory for expenses')
      .max(500, 'notes cannot exceed 500 characters'),
  });

export const expenseFiltersSchema = z.object({
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be in YYYY-MM-DD format')
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be in YYYY-MM-DD format')
    .optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const expenseSummaryFiltersSchema = z.object({
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be in YYYY-MM-DD format')
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be in YYYY-MM-DD format')
    .optional(),
});
