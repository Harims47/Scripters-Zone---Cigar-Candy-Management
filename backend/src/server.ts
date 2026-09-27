import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/utils/logger.js';
import { prisma } from './db/prisma.js';

async function startServer() {
  try {
    const app = await buildApp();

    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });

    logger.info(`🚀 Candy & Cigarette Management System Backend running on ${address}`);
    logger.info(`🩺 Health check available at ${address}/api/v1/health`);

    // Graceful Shutdown Handlers
    const closeGracefully = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down Fastify server gracefully...`);
      try {
        await app.close();
        await prisma.$disconnect();
        logger.info('Database and Fastify server successfully closed.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => closeGracefully('SIGINT'));
    process.on('SIGTERM', () => closeGracefully('SIGTERM'));
  } catch (err) {
    logger.fatal({ err }, 'Failed to start Fastify server');
    process.exit(1);
  }
}

startServer();
