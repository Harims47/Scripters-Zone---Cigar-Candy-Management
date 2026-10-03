import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { IssueStockService } from './issue-stock.service.js';
import {
  createIssueStockSchema,
  issueStockFilterQuerySchema,
} from './issue-stock.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UserRole } from '@prisma/client';

export const issueStockRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/issue-stock — List stock issues (Authenticated: Admin views all, Salesman views own)
  fastify.get(
    '/issue-stock',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = issueStockFilterQuerySchema.parse(request.query);
      const issues = await IssueStockService.getAllIssueStocks(query, request.user);
      return reply.send(successResponse(issues));
    }
  );

  // 2. GET /api/v1/issue-stock/:id — Get stock issue by ID (Authenticated: Admin or issue owner)
  fastify.get<{ Params: { id: string } }>(
    '/issue-stock/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const issue = await IssueStockService.getIssueStockById(request.params.id, request.user);
      return reply.send(successResponse(issue));
    }
  );

  // 3. POST /api/v1/issue-stock — Create stock issue (ADMIN only)
  fastify.post(
    '/issue-stock',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createIssueStockSchema.parse(request.body);
      const created = await IssueStockService.createIssueStock(parsed, request.user.userId);
      return reply.status(201).send(successResponse(created));
    }
  );

  // 4. PATCH /api/v1/issue-stock/:id — Modification prohibited to preserve inventory integrity (Section 31)
  fastify.patch<{ Params: { id: string } }>(
    '/issue-stock/:id',
    { preHandler: [requireAdmin] },
    async () => {
      throw AppError.badRequest(
        'Direct modification of stock issues is not permitted to preserve inventory ledger integrity.'
      );
    }
  );

  // 5. DELETE /api/v1/issue-stock/:id — Delete stock issue & revert movements (ADMIN only)
  fastify.delete<{ Params: { id: string } }>(
    '/issue-stock/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      await IssueStockService.deleteIssueStock(request.params.id);
      return reply.send(successResponse(null, 'Stock issue deleted successfully'));
    }
  );
};
