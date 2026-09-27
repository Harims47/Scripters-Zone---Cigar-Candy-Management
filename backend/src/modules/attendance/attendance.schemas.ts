import { z } from 'zod';
import { AttendanceStatus } from './attendance.types.js';

export const createAttendanceSchema = z.object({
  salesmanId: z
    .string({ required_error: 'salesmanId is required' })
    .uuid('Invalid salesman ID format'),
  attendanceDate: z
    .string({ required_error: 'attendanceDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'attendanceDate must be in YYYY-MM-DD format'),
  status: z.nativeEnum(AttendanceStatus, {
    errorMap: () => ({ message: 'status must be PRESENT or ABSENT' }),
  }),
  notes: z.string().max(500, 'notes cannot exceed 500 characters').optional(),
});

export const attendanceFiltersSchema = z.object({
  salesmanId: z.string().uuid('Invalid salesman ID format').optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be in YYYY-MM-DD format')
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be in YYYY-MM-DD format')
    .optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const attendanceSummaryFiltersSchema = z.object({
  salesmanId: z.string().uuid('Invalid salesman ID format').optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be in YYYY-MM-DD format')
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be in YYYY-MM-DD format')
    .optional(),
});
