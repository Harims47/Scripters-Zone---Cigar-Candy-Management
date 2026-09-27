import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SuppliersService } from './suppliers.service.js';
import {
  createSupplierSchema,
  supplierFilterQuerySchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
} from './suppliers.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { UserRole } from '@prisma/client';

export const supplierRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/suppliers — List suppliers (Authenticated)
  fastify.get(
    '/suppliers',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = supplierFilterQuerySchema.parse(request.query);
      const suppliers = await SuppliersService.getAllSuppliers(query);
      return reply.send(successResponse(suppliers));
    }
  );

  // 2. GET /api/v1/suppliers/:id — Get supplier by ID (Authenticated)
  fastify.get<{ Params: { id: string } }>(
    '/suppliers/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const supplier = await SuppliersService.getSupplierById(request.params.id);
      return reply.send(successResponse(supplier));
    }
  );

  // 3. POST /api/v1/suppliers — Create supplier (ADMIN only)
  fastify.post(
    '/suppliers',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createSupplierSchema.parse(request.body);
      const supplier = await SuppliersService.createSupplier(parsed);
      return reply.status(201).send(successResponse(supplier));
    }
  );

  // 4. PATCH /api/v1/suppliers/:id — Update supplier (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/suppliers/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateSupplierSchema.parse(request.body);
      const supplier = await SuppliersService.updateSupplier(request.params.id, parsed);
      return reply.send(successResponse(supplier));
    }
  );

  // 5. PATCH /api/v1/suppliers/:id/status — Activate/Deactivate supplier (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/suppliers/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateSupplierStatusSchema.parse(request.body);
      const supplier = await SuppliersService.updateSupplierStatus(request.params.id, parsed.active);
      return reply.send(successResponse(supplier));
    }
  );
};
