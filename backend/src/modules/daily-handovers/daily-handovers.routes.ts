import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DailyHandoversService } from './daily-handovers.service.js';
import {
  createDailyHandoverSchema,
  updateDailyHandoverSchema,
  recordCollectionSchema,
  dailyHandoverFiltersSchema,
} from './daily-handovers.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';

export const dailyHandoverRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All endpoints require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /daily-handovers
   * Create a new Daily Handover (Draft or Submitted).
   */
  fastify.post('/daily-handovers', async (request, reply) => {
    const parseResult = createDailyHandoverSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
    }

    const handover = await DailyHandoversService.createDailyHandover(
      parseResult.data,
      request.user
    );

    return reply.status(201).send({
      success: true,
      message: 'Daily handover created successfully',
      data: handover,
    });
  });

  /**
   * GET /daily-handovers
   * List daily handovers with filtering and pagination.
   */
  fastify.get('/daily-handovers', async (request, reply) => {
    const parseResult = dailyHandoverFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const result = await DailyHandoversService.listDailyHandovers(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      ...result,
    });
  });

  /**
   * GET /daily-handovers/:id
   * Get a single daily handover by ID.
   */
  fastify.get<{ Params: { id: string } }>('/daily-handovers/:id', async (request, reply) => {
    const { id } = request.params;
    const handover = await DailyHandoversService.getDailyHandoverById(id, request.user);

    return reply.status(200).send({
      success: true,
      data: handover,
    });
  });

  /**
   * PATCH /daily-handovers/:id
   * Update a draft daily handover.
   */
  fastify.patch<{ Params: { id: string } }>('/daily-handovers/:id', async (request, reply) => {
    const { id } = request.params;
    const parseResult = updateDailyHandoverSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
    }

    const updated = await DailyHandoversService.updateDailyHandover(
      id,
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      message: 'Daily handover updated successfully',
      data: updated,
    });
  });

  /**
   * POST /daily-handovers/:id/submit
   * Submit a draft daily handover.
   */
  fastify.post<{ Params: { id: string } }>('/daily-handovers/:id/submit', async (request, reply) => {
    const { id } = request.params;
    const updated = await DailyHandoversService.submitDailyHandover(id, request.user);

    return reply.status(200).send({
      success: true,
      message: 'Daily handover submitted successfully',
      data: updated,
    });
  });

  /**
   * POST /daily-handovers/:id/collection
   * Admin-only: Record Cash and GPay collection.
   */
  fastify.post<{ Params: { id: string } }>(
    '/daily-handovers/:id/collection',
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = recordCollectionSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
      }

      const updated = await DailyHandoversService.recordCollection(
        id,
        parseResult.data,
        request.user
      );

      return reply.status(200).send({
        success: true,
        message: 'Daily handover collection recorded successfully',
        data: updated,
      });
    }
  );

  /**
   * DELETE /daily-handovers/:id
   * Shielded: Daily Handovers are immutable financial audit records.
   */
  fastify.delete<{ Params: { id: string } }>('/daily-handovers/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message:
          'Daily handovers cannot be deleted. Daily handovers represent immutable actual-sales and financial audit records.',
      },
    });
  });
};
