import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UsersService } from './users.service.js';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from './users.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { UserRole } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All user management routes require authentication and ADMIN role
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/users — List all users (ADMIN only)
  fastify.get('/users', { preHandler: [requireAdmin] }, async (_request, reply) => {
    const users = await UsersService.getAllUsers();
    return reply.send(successResponse(users));
  });

  // 2. GET /api/v1/users/:id — Get user by ID (ADMIN or self)
  fastify.get<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      // Non-admin can only access own profile
      if (request.user.role !== UserRole.ADMIN && request.user.userId !== request.params.id) {
        throw AppError.forbidden('You are only authorized to access your own user profile');
      }

      const user = await UsersService.getUserById(request.params.id);
      return reply.send(successResponse(user));
    }
  );

  // 3. POST /api/v1/users — Create new user (ADMIN only)
  fastify.post(
    '/users',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createUserSchema.parse(request.body);
      const user = await UsersService.createUser(parsed);
      return reply.status(201).send(successResponse(user));
    }
  );

  // 4. PATCH /api/v1/users/:id — Update user (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateUserSchema.parse(request.body);
      const user = await UsersService.updateUser(request.params.id, parsed);
      return reply.send(successResponse(user));
    }
  );

  // 5. PATCH /api/v1/users/:id/status — Activate/Deactivate user (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/users/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateUserStatusSchema.parse(request.body);
      const user = await UsersService.updateUserStatus(request.params.id, parsed.isActive);
      return reply.send(successResponse(user));
    }
  );
};
