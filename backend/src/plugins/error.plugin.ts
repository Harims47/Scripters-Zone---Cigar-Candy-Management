import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/app-error.js';
import { errorResponse } from '../shared/types/api-response.js';
import { logger } from '../shared/utils/logger.js';

const errorPluginAsync: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error, request, reply) => {
    // 1. Domain / AppError
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(
        errorResponse(error.code, error.message, error.details)
      );
    }

    // 2. Zod Schema Validation Error
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const message = firstIssue?.message || 'Input validation failed';
      return reply.status(400).send(
        errorResponse('VALIDATION_ERROR', message, error.format())
      );
    }

    // 3. Fastify Schema Validation Error
    if (error.validation) {
      return reply.status(400).send(
        errorResponse('SCHEMA_VALIDATION_ERROR', error.message, error.validation)
      );
    }

    // 4. JWT / Authentication Errors from Fastify
    if (error.statusCode === 401 || (error as any).name === 'FastifyJWTError') {
      return reply.status(401).send(
        errorResponse('UNAUTHORIZED', error.message || 'Authentication required')
      );
    }

    // 5. Forbidden Errors
    if (error.statusCode === 403) {
      return reply.status(403).send(
        errorResponse('FORBIDDEN', error.message || 'Access denied')
      );
    }

    // 6. Unhandled Internal Server Errors
    logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled Exception');

    return reply.status(500).send(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred. Please try again.')
    );
  });
};

export const errorPlugin = fp(errorPluginAsync, {
  name: 'error-plugin'
});
