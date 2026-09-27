import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, or hyphens'),
  email: z.string().email('Invalid email address').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Role must be ADMIN or SALESMAN' }) }),
  personId: z.string().uuid('Invalid person ID format').optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional().nullable(),
  role: z.nativeEnum(UserRole).optional(),
  personId: z.string().uuid('Invalid person ID format').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive is required' }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
