import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../shared/utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __globalPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__globalPrisma__ ||
  new PrismaClient({
    log:
      env.ENVIRONMENT === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' }
          ]
        : [{ emit: 'stdout', level: 'error' }]
  });

if (env.ENVIRONMENT !== 'production') {
  globalThis.__globalPrisma__ = prisma;
}

export async function checkDatabaseConnection(): Promise<{ isConnected: boolean; latencyMs?: number; error?: string }> {
  const start = performance.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    const latencyMs = Math.round(performance.now() - start);
    return { isConnected: true, latencyMs };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: errorMsg }, 'Database health check failed');
    return { isConnected: false, error: errorMsg };
  }
}
