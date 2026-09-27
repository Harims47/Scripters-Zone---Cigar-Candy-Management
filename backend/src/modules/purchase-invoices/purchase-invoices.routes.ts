import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PurchaseInvoicesService } from './purchase-invoices.service.js';
import {
  createPurchaseInvoiceSchema,
  purchaseInvoiceFilterQuerySchema,
} from './purchase-invoices.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UserRole } from '@prisma/client';

export const purchaseInvoiceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/purchase-invoices — List purchase invoices (Authenticated)
  fastify.get(
    '/purchase-invoices',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = purchaseInvoiceFilterQuerySchema.parse(request.query);
      const invoices = await PurchaseInvoicesService.getAllPurchaseInvoices(query);
      return reply.send(successResponse(invoices));
    }
  );

  // 2. GET /api/v1/purchase-invoices/:id — Get purchase invoice by ID (Authenticated)
  fastify.get<{ Params: { id: string } }>(
    '/purchase-invoices/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const invoice = await PurchaseInvoicesService.getPurchaseInvoiceById(request.params.id);
      return reply.send(successResponse(invoice));
    }
  );

  // 3. POST /api/v1/purchase-invoices — Create purchase invoice & stock receipt (ADMIN only)
  fastify.post(
    '/purchase-invoices',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createPurchaseInvoiceSchema.parse(request.body);
      const created = await PurchaseInvoicesService.createPurchaseInvoice(
        parsed,
        request.user?.userId
      );
      return reply.status(201).send(successResponse(created));
    }
  );

  // 4. PATCH /api/v1/purchase-invoices/:id — Modification prohibited to protect inventory integrity
  fastify.patch<{ Params: { id: string } }>(
    '/purchase-invoices/:id',
    { preHandler: [requireAdmin] },
    async () => {
      throw AppError.badRequest(
        'Received purchase invoices cannot be modified directly as this would compromise inventory ledger integrity'
      );
    }
  );

  // 5. DELETE /api/v1/purchase-invoices/:id — Deletion prohibited to protect inventory integrity
  fastify.delete<{ Params: { id: string } }>(
    '/purchase-invoices/:id',
    { preHandler: [requireAdmin] },
    async () => {
      throw AppError.badRequest(
        'Received purchase invoices cannot be deleted directly as this would compromise inventory ledger integrity'
      );
    }
  );
};
