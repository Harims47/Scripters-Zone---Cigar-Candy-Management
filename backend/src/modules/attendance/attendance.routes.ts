import { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../shared/errors/app-error.js';
import { AttendanceService } from './attendance.service.js';
import {
  createAttendanceSchema,
  attendanceFiltersSchema,
  attendanceSummaryFiltersSchema,
} from './attendance.schemas.js';

export const attendanceRoutes: FastifyPluginAsync = async (fastify) => {
  // All attendance routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /attendance
   * Admin-only: Record daily attendance.
   */
  fastify.post('/attendance', async (request, reply) => {
    const parseResult = createAttendanceSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid request body');
    }

    const created = await AttendanceService.createAttendance(
      parseResult.data,
      request.user
    );

    return reply.status(201).send({
      success: true,
      message: 'Attendance recorded successfully',
      data: created,
    });
  });

  /**
   * GET /attendance
   * Admin-only: List attendance records with filtering and pagination.
   */
  fastify.get('/attendance', async (request, reply) => {
    const parseResult = attendanceFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const result = await AttendanceService.getAttendance(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: result.attendances,
      pagination: result.pagination,
    });
  });

  /**
   * GET /attendance/summary
   * Admin-only: Aggregated attendance counts (presentDays, absentDays, totalRecordedDays).
   * Placed BEFORE /attendance/:id to avoid parameter collision.
   */
  fastify.get('/attendance/summary', async (request, reply) => {
    const parseResult = attendanceSummaryFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw AppError.badRequest(firstIssue ? firstIssue.message : 'Invalid query parameters');
    }

    const summary = await AttendanceService.getAttendanceSummary(
      parseResult.data,
      request.user
    );

    return reply.status(200).send({
      success: true,
      data: summary,
    });
  });

  /**
   * GET /attendance/:id
   * Admin-only: Retrieve single attendance record by ID.
   */
  fastify.get<{ Params: { id: string } }>('/attendance/:id', async (request, reply) => {
    const { id } = request.params;
    const attendance = await AttendanceService.getAttendanceById(id, request.user);

    return reply.status(200).send({
      success: true,
      data: attendance,
    });
  });

  /**
   * PATCH /attendance/:id
   * Shielded: Attendance records are immutable after creation.
   */
  fastify.patch<{ Params: { id: string } }>('/attendance/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Attendance records are immutable. Modifications are not permitted.',
      },
    });
  });

  /**
   * DELETE /attendance/:id
   * Shielded: Attendance records are immutable audit logs.
   */
  fastify.delete<{ Params: { id: string } }>('/attendance/:id', async (_request, reply) => {
    return reply.status(400).send({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST',
        message: 'Attendance records are immutable audit logs. Deletion is not permitted.',
      },
    });
  });
};
