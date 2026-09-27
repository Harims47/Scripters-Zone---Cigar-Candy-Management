import { z } from 'zod';
import { PersonType } from '@prisma/client';

export const createPersonSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    phone: z.string().min(5, 'Phone number must be at least 5 digits').max(20).optional().nullable(),
    address: z.string().max(255).optional().nullable(),
    type: z.nativeEnum(PersonType, {
      errorMap: () => ({ message: 'Type must be SALESMAN, DEALER, or STAFF' }),
    }),
    active: z.boolean().default(true),
    // Credentials for SALESMAN
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username cannot exceed 50 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, or hyphens')
      .optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === PersonType.DEALER && (data.username || data.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dealers are business contacts and MUST NOT receive login credentials',
        path: ['username'],
      });
    }
    if (data.username && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required when creating login credentials',
        path: ['password'],
      });
    }
    if (!data.username && data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Username is required when creating login credentials',
        path: ['username'],
      });
    }
  });

export const updatePersonSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(5).max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  type: z.nativeEnum(PersonType).optional(),
  active: z.boolean().optional(),
});

export const updatePersonStatusSchema = z.object({
  active: z.boolean({ required_error: 'active status is required' }),
});

export const personFilterQuerySchema = z.object({
  type: z.nativeEnum(PersonType).optional(),
  active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type UpdatePersonStatusInput = z.infer<typeof updatePersonStatusSchema>;
export type PersonFilterQueryParams = z.infer<typeof personFilterQuerySchema>;
