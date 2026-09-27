import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SalesLedgerService } from './sales-ledger.service.js';
import { SalesLedgerFilterSchema, SalesLedgerSummaryFilterSchema } from './sales-ledger.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';

export async function salesLedgerRoutes(app: FastifyInstance) {
  // All endpoints require authentication
  app.addHook('onRequest', app.authenticate);

  /**
   * GET /api/v1/sales-ledger/summary
   * Aggregated Sales Ledger KPIs.
   */
  app.get(
    '/sales-ledger/summary',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedQuery = SalesLedgerSummaryFilterSchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw AppError.badRequest(parsedQuery.error.errors.map((e) => e.message).join(', '));
      }

      const summary = await SalesLedgerService.getSummary(
        parsedQuery.data,
        request.user
      );

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );

  /**
   * GET /api/v1/sales-ledger
   * Detailed Sales Ledger with KPIs, pagination, and product breakdown.
   */
  app.get(
    '/sales-ledger',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedQuery = SalesLedgerFilterSchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw AppError.badRequest(parsedQuery.error.errors.map((e) => e.message).join(', '));
      }

      const result = await SalesLedgerService.getSalesLedger(
        parsedQuery.data,
        request.user
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * Shielded endpoints: Sales ledger is a dynamic reporting model derived from Daily Handover.
   * Direct mutation / deletion of sales ledger records is rejected with 400 Bad Request.
   */
  app.patch(
    '/sales-ledger/:id',
    async () => {
      throw AppError.badRequest('Sales Ledger entries cannot be modified. They are derived from authoritative Daily Handovers.');
    }
  );

  app.delete(
    '/sales-ledger/:id',
    async () => {
      throw AppError.badRequest('Sales Ledger entries cannot be deleted. They are derived from authoritative Daily Handovers.');
    }
  );
}
