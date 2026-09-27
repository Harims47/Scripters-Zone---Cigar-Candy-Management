import { z } from 'zod';
import { HandoverRecipientType } from '@prisma/client';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const SalesLedgerFilterSchema = z.object({
  fromDate: z.string().regex(dateRegex, 'fromDate must be in YYYY-MM-DD format').optional(),
  toDate: z.string().regex(dateRegex, 'toDate must be in YYYY-MM-DD format').optional(),
  productId: z.string().uuid('Invalid productId UUID').optional(),
  recipientType: z.nativeEnum(HandoverRecipientType).optional(),
  salesmanId: z.string().uuid('Invalid salesmanId UUID').optional(),
  dealerId: z.string().uuid('Invalid dealerId UUID').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const SalesLedgerSummaryFilterSchema = z.object({
  fromDate: z.string().regex(dateRegex, 'fromDate must be in YYYY-MM-DD format').optional(),
  toDate: z.string().regex(dateRegex, 'toDate must be in YYYY-MM-DD format').optional(),
  productId: z.string().uuid('Invalid productId UUID').optional(),
  recipientType: z.nativeEnum(HandoverRecipientType).optional(),
  salesmanId: z.string().uuid('Invalid salesmanId UUID').optional(),
  dealerId: z.string().uuid('Invalid dealerId UUID').optional(),
});
