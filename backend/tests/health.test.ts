import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/shared/errors/app-error.js';

describe('Phase 2A: Backend Foundation & Health Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    // Register test route to verify AppError handling
    app.get('/test-app-error', async () => {
      throw AppError.conflict('Test conflict detected', { resource: 'inventory' });
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET / returns welcome and health link', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('active');
    expect(body.healthUrl).toBe('/api/v1/health');
  });

  it('2. GET /api/v1/health returns structured operational health data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('UP');
    expect(body.data.api.healthy).toBe(true);
    expect(body.data.database).toBeDefined();
    expect(['CONNECTED', 'DISCONNECTED']).toContain(body.data.database.status);
    expect(body.timestamp).toBeDefined();
  });

  it('3. Structured error handling intercepts AppError correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-app-error'
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toBe('Test conflict detected');
    expect(body.error.details).toEqual({ resource: 'inventory' });
  });

  it('4. CORS configuration allows standard headers', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET'
      }
    });

    expect(response.statusCode).toBe(204);
  });
});
