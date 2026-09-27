import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';
import { prisma } from '../db/prisma.js';

export interface JwtPayload {
  userId: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: UserRole | UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPluginAsync: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.ACCESS_TOKEN_EXPIRE,
    },
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  // Reusable authenticate preHandler
  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication token missing or invalid';
      throw AppError.unauthorized(msg);
    }

    // Verify user exists and is active in database
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) {
      throw AppError.unauthorized('User account no longer exists');
    }

    if (!user.isActive) {
      throw AppError.unauthorized('User account is deactivated. Contact Administrator.');
    }
  });

  // Reusable requireRole preHandler factory
  fastify.decorate('requireRole', (roles: UserRole | UserRole[]) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Must first be authenticated
      if (!request.user) {
        await fastify.authenticate(request, reply);
      }
      if (!allowed.includes(request.user.role)) {
        throw AppError.forbidden(`Access forbidden: required role ${allowed.join(' or ')}`);
      }
    };
  });
};

export const authPlugin = fp(authPluginAsync, {
  name: 'auth-plugin',
});
