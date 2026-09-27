import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UserRole } from '@prisma/client';
import { SalesmanLedgerService } from './salesman-ledger.service.js';
import {
  createManualTransactionSchema,
  salesmanLedgerFiltersSchema,
} from './salesman-ledger.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';

export const salesmanLedgerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All endpoints require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /salesman-ledger
   * View ledger transactions and balances.
   * Admin can query for any salesman. Salesman automatically scoped to self.
   */
  fastify.get('/salesman-ledger', async (request, reply) => {
    const parseResult = salesmanLedgerFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const summary = await SalesmanLedgerService.getSalesmanLedger(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: summary,
    });
  });

  /**
   * GET /salesman-ledger/my
   * Convenience endpoint for authenticated Salesman to view own ledger.
   */
  fastify.get('/salesman-ledger/my', async (request, reply) => {
    if (request.user.role !== UserRole.SALESMAN) {
      throw AppError.forbidden('Only Salesmen can access /salesman-ledger/my');
    }

    const parseResult = salesmanLedgerFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const summary = await SalesmanLedgerService.getSalesmanLedger(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: summary,
    });
  });

  /**
   * POST /salesman-ledger/transactions
   * Admin-only: Create a manual ledger transaction (ADVANCE, RECOVERY, SALARY_DEDUCTION, MANUAL_ADJUSTMENT).
   */
  fastify.post(
    '/salesman-ledger/transactions',
    { preHandler: [fastify.requireRole(UserRole.ADMIN)] },
    async (request, reply) => {
      const parseResult = createManualTransactionSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
      }

      const transaction = await SalesmanLedgerService.createManualTransaction(
        parseResult.data,
        request.user
      );

      return reply.status(201).send({
        success: true,
        message: 'Salesman ledger transaction created successfully',
        data: transaction,
      });
    }
  );

  /**
   * GET /salesman-ledger/:id
   * Get single transaction by ID.
   */
  fastify.get<{ Params: { id: string } }>('/salesman-ledger/:id', async (request, reply) => {
    const { id } = request.params;
    const transaction = await SalesmanLedgerService.getTransactionById(id, request.user);

    return reply.status(200).send({
      success: true,
      data: transaction,
    });
  });

  /**
   * PATCH /salesman-ledger/:id
   * Shielded: Ledger transactions are immutable financial records.
   */
  fastify.patch<{ Params: { id: string } }>('/salesman-ledger/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message:
          'Salesman ledger transactions are immutable financial audit records and cannot be edited. Create an offsetting transaction instead.',
      },
    });
  });

  /**
   * DELETE /salesman-ledger/:id
   * Shielded: Ledger transactions are immutable financial records.
   */
  fastify.delete<{ Params: { id: string } }>('/salesman-ledger/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message:
          'Salesman ledger transactions are immutable financial audit records and cannot be deleted.',
      },
    });
  });
};
