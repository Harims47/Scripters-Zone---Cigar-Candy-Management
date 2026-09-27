import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { checkDatabaseConnection } from '../../db/prisma.js';
import { successResponse } from '../../shared/types/api-response.js';
import { env } from '../../config/env.js';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', async (_request, reply) => {
    const dbStatus = await checkDatabaseConnection();

    const healthData = {
      status: 'UP',
      api: {
        healthy: true,
        environment: env.ENVIRONMENT,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      },
      database: {
        healthy: dbStatus.isConnected,
        status: dbStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED',
        latencyMs: dbStatus.latencyMs,
        error: dbStatus.error
      }
    };

    // If DB is healthy or in dev/test, return 200 with complete diagnostics
    return reply.status(200).send(successResponse(healthData, 'API service is operational'));
  });
};
