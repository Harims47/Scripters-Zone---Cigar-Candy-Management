import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { InventoryService } from './inventory.service.js';
import { successResponse } from '../../shared/types/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';

export const inventoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;

  // 1. GET /api/v1/inventory/stock — Read stock balance for all products (Authenticated)
  fastify.get<{ Querystring: { category?: string } }>(
    '/inventory/stock',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const stock = await InventoryService.getAllStock(request.query.category);
      return reply.send(successResponse(stock));
    }
  );

  // 2. GET /api/v1/inventory/stock/:productId — Read stock balance for a product (Authenticated)
  fastify.get<{ Params: { productId: string } }>(
    '/inventory/stock/:productId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const stock = await InventoryService.getStockByProductId(request.params.productId);
      return reply.send(successResponse(stock));
    }
  );

  // 3. Mutation shield: authenticated users cannot mutate stock directly
  fastify.post(
    '/inventory/stock',
    { preHandler: [requireAuth] },
    async () => {
      throw AppError.badRequest(
        'Direct inventory stock mutation is not permitted. Stock can only be altered through valid business documents (Purchase Invoices).'
      );
    }
  );

  fastify.patch(
    '/inventory/stock/:productId',
    { preHandler: [requireAuth] },
    async () => {
      throw AppError.badRequest(
        'Direct inventory stock mutation is not permitted. Stock can only be altered through valid business documents (Purchase Invoices).'
      );
    }
  );
};
