import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService } from './auth.service.js';
import { changePasswordSchema, loginSchema } from './auth.schemas.js';
import { successResponse } from '../../shared/types/api-response.js';
import { env } from '../../config/env.js';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. POST /api/v1/auth/login — User login (Admin or Salesman)
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.parse(request.body);

    const result = await AuthService.login(parsed, (payload) =>
      fastify.jwt.sign(payload)
    );

    const isProduction = env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
    const sameSiteSetting = env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
    const secureSetting = isProduction;

    reply.setCookie('token', result.accessToken, {
      path: '/',
      httpOnly: true,
      secure: secureSetting,
      sameSite: sameSiteSetting,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.send(successResponse(result));
  });

  // 2. POST /api/v1/auth/logout — User logout (Clears HttpOnly cookie)
  fastify.post('/auth/logout', async (_request, reply) => {
    const isProduction = env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
    const sameSiteSetting = env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
    const secureSetting = isProduction;

    reply.clearCookie('token', {
      path: '/',
      httpOnly: true,
      secure: secureSetting,
      sameSite: sameSiteSetting,
    });
    return reply.send(successResponse({ message: 'Logged out successfully' }));
  });

  // 3. GET /api/v1/auth/me — Current authenticated user profile
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await AuthService.getCurrentUser(request.user.userId);
      return reply.send(successResponse(user));
    }
  );

  // 4. PATCH /api/v1/auth/password — Change current user's password
  fastify.patch(
    '/auth/password',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = changePasswordSchema.parse(request.body);
      const result = await AuthService.changePassword(request.user.userId, parsed);
      return reply.send(successResponse(result));
    }
  );
};
