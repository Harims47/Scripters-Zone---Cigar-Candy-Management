import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']).default(
    (process.env.NODE_ENV as any) || 'development'
  ),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_EXPIRE: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRE: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5175'),
  FRONTEND_URL: z.string().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed.');
}

const rawOrigins = parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
if (parsed.data.FRONTEND_URL && !rawOrigins.includes(parsed.data.FRONTEND_URL.trim())) {
  rawOrigins.push(parsed.data.FRONTEND_URL.trim());
}

export const env = {
  ...parsed.data,
  corsOriginsList: rawOrigins
};
