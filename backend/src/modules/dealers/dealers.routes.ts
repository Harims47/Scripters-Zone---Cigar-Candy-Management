import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DealersService } from './dealers.service.js';
import {
  createDealerSchema,
  dealerFilterQuerySchema,
  updateDealerSchema,
  updateDealerStatusSchema,
} from './dealers.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { UserRole } from '@prisma/client';

export const dealerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/dealers — List all dealers (ADMIN or SALESMAN)
  fastify.get(
    '/dealers',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = dealerFilterQuerySchema.parse(request.query);
      const dealers = await DealersService.getAllDealers(query);
      return reply.send(successResponse(dealers));
    }
  );

  // 2. GET /api/v1/dealers/:id — Get dealer by ID (ADMIN or SALESMAN)
  fastify.get<{ Params: { id: string } }>(
    '/dealers/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const dealer = await DealersService.getDealerById(request.params.id);
      return reply.send(successResponse(dealer));
    }
  );

  // 3. POST /api/v1/dealers — Create new dealer (ADMIN only)
  fastify.post(
    '/dealers',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createDealerSchema.parse(request.body);
      const dealer = await DealersService.createDealer(parsed);
      return reply.status(201).send(successResponse(dealer));
    }
  );

  // 4. PATCH /api/v1/dealers/:id — Update dealer (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/dealers/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateDealerSchema.parse(request.body);
      const dealer = await DealersService.updateDealer(request.params.id, parsed);
      return reply.send(successResponse(dealer));
    }
  );

  // 5. PATCH /api/v1/dealers/:id/status — Activate/Deactivate dealer (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/dealers/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateDealerStatusSchema.parse(request.body);
      const dealer = await DealersService.updateDealerStatus(request.params.id, parsed.active);
      return reply.send(successResponse(dealer));
    }
  );

  // 6. DELETE /api/v1/dealers/:id — Delete or deactivate dealer (ADMIN only)
  fastify.delete<{ Params: { id: string } }>(
    '/dealers/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const result = await DealersService.deleteDealer(request.params.id);
      return reply.send(successResponse(result, 'Dealer deleted successfully'));
    }
  );
};
