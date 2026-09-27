import { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../shared/errors/app-error.js';
import { ExpensesService } from './expenses.service.js';
import {
  createExpenseSchema,
  expenseFiltersSchema,
  expenseSummaryFiltersSchema,
} from './expenses.schemas.js';

export const expensesRoutes: FastifyPluginAsync = async (fastify) => {
  // All expense routes require valid authentication
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /expenses
   * Admin-only: Create manual operating expense (OFFICE, HOUSE, GPI).
   */
  fastify.post('/expenses', async (request, reply) => {
    const parseResult = createExpenseSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
    }

    const created = await ExpensesService.createExpense(
      parseResult.data,
      request.user
    );

    return reply.status(201).send({
      success: true,
      message: 'Expense created successfully',
      data: created,
    });
  });

  /**
   * GET /expenses
   * List manual operating expenses with filters and pagination.
   */
  fastify.get('/expenses', async (request, reply) => {
    const parseResult = expenseFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const result = await ExpensesService.getExpenses(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: result.expenses,
      pagination: result.pagination,
    });
  });

  /**
   * GET /expenses/summary
   * Aggregated reporting summary: Manual (OFFICE, HOUSE, GPI) + Derived (EMPTY_PACKET, COUPON, DISCOUNT).
   * Placed BEFORE /expenses/:id to avoid parameter collision.
   */
  fastify.get('/expenses/summary', async (request, reply) => {
    const parseResult = expenseSummaryFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const summary = await ExpensesService.getExpenseSummary(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: summary,
    });
  });

  /**
   * GET /expenses/:id
   * Retrieve single manual expense by ID.
   */
  fastify.get<{ Params: { id: string } }>('/expenses/:id', async (request, reply) => {
    const { id } = request.params;
    const expense = await ExpensesService.getExpenseById(id, request.user);

    return reply.status(200).send({
      success: true,
      data: expense,
    });
  });

  /**
   * PATCH /expenses/:id
   * Shielded: Operating expenses are immutable financial audit records.
   */
  fastify.patch<{ Params: { id: string } }>('/expenses/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Expenses are immutable financial records. Modifications are not permitted.',
      },
    });
  });

  /**
   * DELETE /expenses/:id
   * Shielded: Operating expenses are immutable financial audit records.
   */
  fastify.delete<{ Params: { id: string } }>('/expenses/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Expenses are immutable financial records. Deletion is not permitted.',
      },
    });
  });
};
