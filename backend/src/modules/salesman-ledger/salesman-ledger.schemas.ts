import { z } from 'zod';
import { LedgerTransactionType, LedgerDirection } from './salesman-ledger.types.js';

export const createManualTransactionSchema = z
  .object({
    salesmanId: z.string().uuid('Invalid salesman ID'),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'transactionDate must be in YYYY-MM-DD format'),
    type: z.nativeEnum(LedgerTransactionType, {
      errorMap: () => ({ message: 'Invalid transaction type' }),
    }),
    direction: z.nativeEnum(LedgerDirection).optional(),
    amount: z.number().positive('Amount must be greater than zero'),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === LedgerTransactionType.HANDOVER_SHORT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HANDOVER_SHORT cannot be manually created. It is system-generated from Daily Handover.',
        path: ['type'],
      });
    }

    if (data.type === LedgerTransactionType.MANUAL_ADJUSTMENT) {
      if (!data.direction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'direction (DEBIT or CREDIT) is required for MANUAL_ADJUSTMENT',
          path: ['direction'],
        });
      }
      if (!data.notes || data.notes.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'notes/reason is required for MANUAL_ADJUSTMENT',
          path: ['notes'],
        });
      }
    }
  });

export const salesmanLedgerFiltersSchema = z.object({
  salesmanId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.nativeEnum(LedgerTransactionType).optional(),
  direction: z.nativeEnum(LedgerDirection).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
