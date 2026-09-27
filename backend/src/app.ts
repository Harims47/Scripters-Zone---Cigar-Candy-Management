import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { errorPlugin } from './plugins/error.plugin.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { personRoutes } from './modules/persons/persons.routes.js';
import { dealerRoutes } from './modules/dealers/dealers.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { supplierRoutes } from './modules/suppliers/suppliers.routes.js';
import { purchaseInvoiceRoutes } from './modules/purchase-invoices/purchase-invoices.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { salesTargetRoutes } from './modules/sales-targets/sales-targets.routes.js';
import { issueStockRoutes } from './modules/issue-stock/issue-stock.routes.js';
import { dailyHandoverRoutes } from './modules/daily-handovers/daily-handovers.routes.js';
import { salesmanLedgerRoutes } from './modules/salesman-ledger/salesman-ledger.routes.js';
import { expensesRoutes } from './modules/expenses/expenses.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { salariesRoutes } from './modules/salaries/salaries.routes.js';
import { salesLedgerRoutes } from './modules/sales-ledger/sales-ledger.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { logger } from './shared/utils/logger.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use custom Pino logger to avoid redundant line logging in test/dev
    trustProxy: true,
    disableRequestLogging: env.ENVIRONMENT === 'test'
  });

  // Core Plugins
  await app.register(sensible);
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return cb(null, true);
      if (env.corsOriginsList.includes(origin) || env.ENVIRONMENT === 'development') {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });

  // Global Error Handler Plugin
  await app.register(errorPlugin);

  // Authentication & Authorization Plugin
  await app.register(authPlugin);

  // API v1 Routes Registration
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(personRoutes, { prefix: '/api/v1' });
  await app.register(dealerRoutes, { prefix: '/api/v1' });
  await app.register(productRoutes, { prefix: '/api/v1' });
  await app.register(supplierRoutes, { prefix: '/api/v1' });
  await app.register(purchaseInvoiceRoutes, { prefix: '/api/v1' });
  await app.register(inventoryRoutes, { prefix: '/api/v1' });
  await app.register(salesTargetRoutes, { prefix: '/api/v1' });
  await app.register(issueStockRoutes, { prefix: '/api/v1' });
  await app.register(dailyHandoverRoutes, { prefix: '/api/v1' });
  await app.register(salesmanLedgerRoutes, { prefix: '/api/v1' });
  await app.register(expensesRoutes, { prefix: '/api/v1' });
  await app.register(attendanceRoutes, { prefix: '/api/v1' });
  await app.register(salariesRoutes, { prefix: '/api/v1' });
  await app.register(salesLedgerRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.register(reportsRoutes, { prefix: '/api/v1' });


  // Root Welcome & Health Redirect
  app.get('/', async (_req, reply) => {
    return reply.send({
      name: 'Candy & Cigarette Management System API',
      version: '1.0.0',
      status: 'active',
      healthUrl: '/api/v1/health'
    });
  });

  // Root lightweight health check for hosting platforms (Render, etc.)
  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  return app;
}
