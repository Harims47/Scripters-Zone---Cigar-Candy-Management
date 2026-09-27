import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const DashboardFilterSchema = z.object({
  fromDate: z.string().regex(dateRegex, 'fromDate must be in YYYY-MM-DD format').optional(),
  toDate: z.string().regex(dateRegex, 'toDate must be in YYYY-MM-DD format').optional(),
});
