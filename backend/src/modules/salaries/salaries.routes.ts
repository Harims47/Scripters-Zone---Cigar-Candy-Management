import { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../shared/errors/app-error.js';
import { SalariesService } from './salaries.service.js';
import {
  createSalarySchema,
  salaryFiltersSchema,
  mySalaryFiltersSchema,
} from './salaries.schemas.js';

export const salariesRoutes: FastifyPluginAsync = async (fastify) => {
  // All salary routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /salaries
   * Admin-only: Record monthly salary payment.
   */
  fastify.post('/salaries', async (request, reply) => {
    const parseResult = createSalarySchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
    }

    const created = await SalariesService.createSalary(
      parseResult.data,
      request.user
    );

    return reply.status(201).send({
      success: true,
      message: 'Salary payment recorded successfully',
      data: created,
    });
  });

  /**
   * GET /salaries
   * Admin-only: List salary records with filtering and pagination.
   */
  fastify.get('/salaries', async (request, reply) => {
    const parseResult = salaryFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const result = await SalariesService.getSalaries(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: result.salaries,
      pagination: result.pagination,
    });
  });

  /**
   * GET /salaries/my
   * Salesman-only: View personal salary records.
   * Placed BEFORE /salaries/:id to avoid parameter collision.
   */
  fastify.get('/salaries/my', async (request, reply) => {
    const parseResult = mySalaryFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const result = await SalariesService.getMySalaries(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: result.salaries,
      pagination: result.pagination,
    });
  });

  /**
   * GET /salaries/:id
   * Admin: any salary; Salesman: own salary only.
   */
  fastify.get<{ Params: { id: string } }>('/salaries/:id', async (request, reply) => {
    const { id } = request.params;
    const salary = await SalariesService.getSalaryById(id, request.user);

    return reply.status(200).send({
      success: true,
      data: salary,
    });
  });

  /**
   * PATCH /salaries/:id
   * Shielded: Salary payments are immutable financial records.
   */
  fastify.patch<{ Params: { id: string } }>('/salaries/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Salary records are immutable financial records. Modifications are not permitted.',
      },
    });
  });

  /**
   * DELETE /salaries/:id
   * Shielded: Salary payments are immutable financial records.
   */
  fastify.delete<{ Params: { id: string } }>('/salaries/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Salary records are immutable financial records. Deletion is not permitted.',
      },
    });
  });
};
