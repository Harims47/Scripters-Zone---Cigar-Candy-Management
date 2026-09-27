import { z } from 'zod';
import { IssueRecipientType, Uom } from '@prisma/client';

export const issueStockItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  uom: z.nativeEnum(Uom, { errorMap: () => ({ message: 'Invalid UOM' }) }),
});

export const createIssueStockSchema = z
  .object({
    recipientType: z.nativeEnum(IssueRecipientType, {
      errorMap: () => ({ message: 'Recipient type must be either SALESMAN or DEALER' }),
    }),
    salesmanId: z.string().optional().nullable(),
    dealerId: z.string().optional().nullable(),
    issueDate: z
      .string()
      .trim()
      .min(1, 'Issue date is required')
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid issue date format. Expected YYYY-MM-DD',
      }),
    items: z.array(issueStockItemInputSchema).min(1, 'Issue stock must contain at least one item'),
  })
  .refine(
    (data) => {
      if (data.recipientType === IssueRecipientType.SALESMAN) {
        return !!data.salesmanId && !data.dealerId;
      }
      if (data.recipientType === IssueRecipientType.DEALER) {
        return !!data.dealerId && !data.salesmanId;
      }
      return false;
    },
    {
      message:
        'Must specify exactly one recipient: salesmanId when recipientType is SALESMAN, or dealerId when recipientType is DEALER',
    }
  );

export const issueStockFilterQuerySchema = z.object({
  recipientType: z.nativeEnum(IssueRecipientType).optional(),
  salesmanId: z.string().optional(),
  dealerId: z.string().optional(),
  productId: z.string().optional(),
  issueDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type IssueStockItemInput = z.infer<typeof issueStockItemInputSchema>;
export type CreateIssueStockInput = z.infer<typeof createIssueStockSchema>;
export type IssueStockFilterQueryParams = z.infer<typeof issueStockFilterQuerySchema>;
