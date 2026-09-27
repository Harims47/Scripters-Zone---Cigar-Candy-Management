import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service.js';
import { DashboardFilterSchema } from './dashboard.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UserRole } from '@prisma/client';

export async function dashboardRoutes(app: FastifyInstance) {
  // All endpoints require authentication
  app.addHook('onRequest', app.authenticate);

  /**
   * GET /api/v1/dashboard/admin
   * Aggregated operational command center data. Admin only.
   */
  app.get(
    '/dashboard/admin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.user.role !== UserRole.ADMIN) {
        throw AppError.forbidden('Only Admin can access the operational command center dashboard');
      }

      const parsedQuery = DashboardFilterSchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw AppError.badRequest(parsedQuery.error.errors.map((e) => e.message).join(', '));
      }

      const data = await DashboardService.getAdminDashboard(
        parsedQuery.data,
        request.user
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  /**
   * Shielded mutations for dashboard.
   */
  app.patch('/dashboard/:id', async () => {
    throw AppError.badRequest('Dashboard data cannot be modified. It is aggregated in real time.');
  });

  app.delete('/dashboard/:id', async () => {
    throw AppError.badRequest('Dashboard data cannot be deleted. It is aggregated in real time.');
  });
}
