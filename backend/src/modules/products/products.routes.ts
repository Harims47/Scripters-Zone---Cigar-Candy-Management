import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ProductsService } from './products.service.js';
import {
  createInitialStockSchema,
  createProductSchema,
  productFilterQuerySchema,
  updateProductSchema,
  updateProductStatusSchema,
} from './products.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { UserRole } from '@prisma/client';

export const productRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const requireAuth = fastify.authenticate;
  const requireAdmin = fastify.requireRole(UserRole.ADMIN);

  // 1. GET /api/v1/products — List all products with filtering (ADMIN or SALESMAN)
  fastify.get(
    '/products',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = productFilterQuerySchema.parse(request.query);
      const products = await ProductsService.getAllProducts(query);
      return reply.send(successResponse(products));
    }
  );

  // 2. GET /api/v1/products/:id — Get single product by ID (ADMIN or SALESMAN)
  fastify.get<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const product = await ProductsService.getProductById(request.params.id);
      return reply.send(successResponse(product));
    }
  );

  // 3. POST /api/v1/products — Create new product (ADMIN only)
  fastify.post(
    '/products',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createProductSchema.parse(request.body);
      const product = await ProductsService.createProduct(parsed);
      return reply.status(201).send(successResponse(product));
    }
  );

  // 4. PATCH /api/v1/products/:id — Update existing product (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateProductSchema.parse(request.body);
      const product = await ProductsService.updateProduct(request.params.id, parsed);
      return reply.send(successResponse(product));
    }
  );

  // 5. PATCH /api/v1/products/:id/status — Activate/deactivate product (ADMIN only)
  fastify.patch<{ Params: { id: string } }>(
    '/products/:id/status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = updateProductStatusSchema.parse(request.body);
      const product = await ProductsService.updateProductStatus(request.params.id, parsed.active);
      return reply.send(successResponse(product));
    }
  );

  // 6. GET /api/v1/products/:productId/initial-stock — View opening stock (ADMIN or SALESMAN)
  fastify.get<{ Params: { productId: string } }>(
    '/products/:productId/initial-stock',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const initialStock = await ProductsService.getInitialStock(request.params.productId);
      return reply.send(successResponse(initialStock));
    }
  );

  // 7. POST /api/v1/products/:productId/initial-stock — Record one-time initial stock (ADMIN only)
  fastify.post<{ Params: { productId: string } }>(
    '/products/:productId/initial-stock',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = createInitialStockSchema.parse(request.body);
      const initialStock = await ProductsService.createInitialStock(
        request.params.productId,
        parsed,
        request.user?.userId
      );
      return reply.status(201).send(successResponse(initialStock));
    }
  );

  // 8. DELETE /api/v1/products/:id — Delete or deactivate product (ADMIN only)
  fastify.delete<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const result = await ProductsService.deleteProduct(request.params.id);
      return reply.send(successResponse(result, 'Product deleted successfully'));
    }
  );
};
