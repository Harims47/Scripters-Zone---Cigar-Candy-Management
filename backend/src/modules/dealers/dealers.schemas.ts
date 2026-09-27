import { z } from 'zod';

export const createDealerSchema = z.object({
  name: z.string().min(2, 'Dealer name must be at least 2 characters').max(100),
  phone: z.string().min(5, 'Phone number must be at least 5 digits').max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  active: z.boolean().default(true),
});

export const updateDealerSchema = z.object({
  name: z.string().min(2, 'Dealer name must be at least 2 characters').max(100).optional(),
  phone: z.string().min(5, 'Phone number must be at least 5 digits').max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  active: z.boolean().optional(),
});

export const updateDealerStatusSchema = z.object({
  active: z.boolean({ required_error: 'active status is required' }),
});

export const dealerFilterQuerySchema = z.object({
  active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
});

export type CreateDealerInput = z.infer<typeof createDealerSchema>;
export type UpdateDealerInput = z.infer<typeof updateDealerSchema>;
export type UpdateDealerStatusInput = z.infer<typeof updateDealerStatusSchema>;
export type DealerFilterQueryParams = z.infer<typeof dealerFilterQuerySchema>;
