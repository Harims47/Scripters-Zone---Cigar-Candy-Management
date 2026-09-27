import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SalesTargetsService } from './sales-targets.service.js';
import {
  createSalesTargetSchema,
  salesTargetFilterQuerySchema,
  updateSalesTargetSchema,
  updateSalesTargetStatusSchema,
} from './sales-targets.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UserRole } from '@prisma/client';

export const salesTargetRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/sales-targets — List sales targets (Authenticated: Admins see all/filtered, Salesmen see only their own)
  fastify.get(
    '/sales-targets',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = salesTargetFilterQuerySchema.parse(request.query);
      const targets = await SalesTargetsService.getAllSalesTargets(query, request.user);
      return reply.send(successResponse(targets));
    }
  );

  // 2. GET /api/v1/sales-targets/my — Retrieve current logged-in salesman's targets
  fastify.get<{ Querystring: { targetDate?: string } }>(
    '/sales-targets/my',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const targets = await SalesTargetsService.getMySalesTargets(
        request.user.userId,
        request.query.targetDate
      );
      return reply.send(successResponse(targets));
    }
  );

  // 3. GET /api/v1/sales-targets/:id — Get sales target by ID (Authenticated: Admins or target owner)
  fastify.get<{ Params: { id: string } }>(
    '/sales-targets/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const target = await SalesTargetsService.getSalesTargetById(request.params.id, request.user);
      return reply.send(successResponse(target));
    }
  );

  // 4. POST /api/v1/sales-targets — Create sales target (ADMIN only)
  fastify.post(
    '/sales-targets',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createSalesTargetSchema.parse(request.body);
      const created = await SalesTargetsService.createSalesTarget(parsed, request.user.userId);
      return reply.status(201).send(successResponse(created));
    }
  );

  // 5. PATCH /api/v1/sales-targets/:id — Update sales target (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/sales-targets/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateSalesTargetSchema.parse(request.body);
      const updated = await SalesTargetsService.updateSalesTarget(request.params.id, parsed);
      return reply.send(successResponse(updated));
    }
  );

  // 6. PATCH /api/v1/sales-targets/:id/status — Activate/deactivate target (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/sales-targets/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateSalesTargetStatusSchema.parse(request.body);
      const updated = await SalesTargetsService.updateSalesTargetStatus(
        request.params.id,
        parsed.active
      );
      return reply.send(successResponse(updated));
    }
  );

  // 7. DELETE /api/v1/sales-targets/:id — Direct deletion prohibited (Section 17)
  fastify.delete<{ Params: { id: string } }>(
    '/sales-targets/:id',
    { preHandler: [requireAdmin] },
    async () => {
      throw AppError.badRequest(
        'Direct deletion of sales targets is not permitted. Please deactivate the target instead to preserve historical records.'
      );
    }
  );
};
