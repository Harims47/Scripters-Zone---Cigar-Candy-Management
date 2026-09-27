import { z } from 'zod';
import { HandoverRecipientType, HandoverStatus } from './daily-handovers.types.js';

export const createHandoverItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  uom: z.string().min(1, 'UOM is required'),
  openingQuantity: z.number().positive('Opening quantity must be greater than zero'),
  closingQuantity: z.number().min(0, 'Closing quantity cannot be negative'),
  freeQuantity: z.number().min(0, 'Free quantity cannot be negative').optional().default(0),
  discount: z.number().min(0, 'Discount cannot be negative').optional().default(0),
});

export const createEmptyPacketSchema = z.object({
  productId: z.string().uuid('Invalid product ID').optional(),
  quantity: z.number().positive('Empty packet quantity must be greater than zero'),
  actualAmount: z.number().min(0, 'Empty packet amount cannot be negative'),
});

export const createCouponSchema = z.object({
  productId: z.string().uuid('Invalid product ID').optional(),
  denomination: z.number().positive('Coupon denomination must be greater than zero'),
  quantity: z.number().positive('Coupon quantity must be greater than zero'),
});

export const createDailyHandoverSchema = z.object({
  recipientType: z.nativeEnum(HandoverRecipientType, {
    errorMap: () => ({ message: 'recipientType must be SALESMAN or DEALER' }),
  }),
  salesmanId: z.string().uuid('Invalid salesman ID').optional(),
  dealerId: z.string().uuid('Invalid dealer ID').optional(),
  handoverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'handoverDate must be in YYYY-MM-DD format'),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  status: z.nativeEnum(HandoverStatus).optional(),
  items: z.array(createHandoverItemSchema).min(1, 'At least one product item is required'),
  emptyPackets: z.array(createEmptyPacketSchema).optional(),
  coupons: z.array(createCouponSchema).optional(),
  cashCollected: z.number().min(0, 'Cash collected cannot be negative').optional(),
  gpayCollected: z.number().min(0, 'GPay collected cannot be negative').optional(),
  notes: z.string().max(500).optional(),
});

export const updateDailyHandoverSchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  items: z.array(createHandoverItemSchema).min(1, 'At least one product item is required').optional(),
  emptyPackets: z.array(createEmptyPacketSchema).optional(),
  coupons: z.array(createCouponSchema).optional(),
  notes: z.string().max(500).optional(),
});

export const recordCollectionSchema = z.object({
  cashCollected: z.number().min(0, 'Cash collected cannot be negative'),
  gpayCollected: z.number().min(0, 'GPay collected cannot be negative'),
  notes: z.string().max(500).optional(),
});

export const dailyHandoverFiltersSchema = z.object({
  recipientType: z.nativeEnum(HandoverRecipientType).optional(),
  salesmanId: z.string().uuid().optional(),
  dealerId: z.string().uuid().optional(),
  handoverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(HandoverStatus).optional(),
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
