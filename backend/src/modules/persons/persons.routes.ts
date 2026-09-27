import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PersonsService } from './persons.service.js';
import {
  createPersonSchema,
  personFilterQuerySchema,
  updatePersonSchema,
  updatePersonStatusSchema,
} from './persons.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { UserRole } from '@prisma/client';

export const personRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Helpers
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/persons — List persons with filters (ADMIN or SALESMAN)
  fastify.get(
    '/persons',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = personFilterQuerySchema.parse(request.query);
      const persons = await PersonsService.getAllPersons(query);
      return reply.send(successResponse(persons));
    }
  );

  // 2. GET /api/v1/persons/:id — Get person by ID (ADMIN or SALESMAN)
  fastify.get<{ Params: { id: string } }>(
    '/persons/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const person = await PersonsService.getPersonById(request.params.id);
      return reply.send(successResponse(person));
    }
  );

  // 3. POST /api/v1/persons — Create person (ADMIN only, SALESMAN forbidden)
  fastify.post(
    '/persons',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createPersonSchema.parse(request.body);
      const person = await PersonsService.createPerson(parsed);
      return reply.status(201).send(successResponse(person));
    }
  );

  // 4. PATCH /api/v1/persons/:id — Update person (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/persons/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updatePersonSchema.parse(request.body);
      const person = await PersonsService.updatePerson(request.params.id, parsed);
      return reply.send(successResponse(person));
    }
  );

  // 5. PATCH /api/v1/persons/:id/status — Activate/Deactivate person (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/persons/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updatePersonStatusSchema.parse(request.body);
      const person = await PersonsService.updatePersonStatus(request.params.id, parsed.active);
      return reply.send(successResponse(person));
    }
  );
};
