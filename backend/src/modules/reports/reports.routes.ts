import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportsService } from './reports.service.js';
import { PnLFilterSchema } from './reports.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { UserRole } from '@prisma/client';

export async function reportsRoutes(app: FastifyInstance) {
  // All endpoints require authentication
  app.addHook('onRequest', app.authenticate);

  /**
   * GET /api/v1/reports/pnl
   * Authoritative Management Profit & Loss financial summary. Admin only.
   */
  app.get(
    '/reports/pnl',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.user.role !== UserRole.ADMIN) {
        throw AppError.forbidden('Only Admin can access the financial P&L report');
      }

      const parsedQuery = PnLFilterSchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw AppError.badRequest(parsedQuery.error.errors.map((e) => e.message).join(', '));
      }

      const report = await ReportsService.getPnLReport(
        parsedQuery.data,
        request.user
      );

      return reply.send({
        success: true,
        data: report,
      });
    }
  );

  /**
   * Shielded mutations for P&L reports.
   */
  app.patch('/reports/pnl', async () => {
    throw AppError.badRequest('P&L report cannot be modified. It is derived from authoritative transactions.');
  });

  app.delete('/reports/pnl', async () => {
    throw AppError.badRequest('P&L report cannot be deleted. It is derived from authoritative transactions.');
  });
}
