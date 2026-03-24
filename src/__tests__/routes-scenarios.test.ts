/**
 * Integration tests for scenario routes (CRUD /api/me/scenarios).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userScenario: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'basic' };
  }),
  requireTier: vi.fn((_tier: string) => async (request: Record<string, unknown>) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'basic' };
  }),
}));

import prisma from '../db/prisma.js';
import scenarioRoutes from '../routes/scenarios.js';

describe('Scenario routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(scenarioRoutes, { prefix: '/api/me/scenarios' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me/scenarios', () => {
    it('returns list of scenarios', async () => {
      prisma.userScenario.findMany.mockResolvedValue([
        { id: 's1', name: 'Base Case', scenarioData: {} },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/me/scenarios' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Base Case');
    });

    it('sets no-store cache header', async () => {
      prisma.userScenario.findMany.mockResolvedValue([]);
      const res = await app.inject({ method: 'GET', url: '/api/me/scenarios' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('POST /api/me/scenarios', () => {
    it('creates a new scenario', async () => {
      prisma.userScenario.count.mockResolvedValue(0);
      prisma.userScenario.create.mockResolvedValue({
        id: 's-new',
        name: 'Early Retirement',
        scenarioData: { retirementAge: 60 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/me/scenarios',
        payload: { name: 'Early Retirement', scenarioData: { retirementAge: 60 } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).name).toBe('Early Retirement');
    });

    it('enforces 50 scenario limit', async () => {
      prisma.userScenario.count.mockResolvedValue(50);

      const res = await app.inject({
        method: 'POST',
        url: '/api/me/scenarios',
        payload: { name: 'Too Many', scenarioData: {} },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects missing name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/scenarios',
        payload: { scenarioData: {} },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/me/scenarios/:id', () => {
    it('updates an existing scenario', async () => {
      prisma.userScenario.findFirst.mockResolvedValue({ id: 's1', userId: 'test-user-id' });
      prisma.userScenario.update.mockResolvedValue({
        id: 's1',
        name: 'Updated',
        scenarioData: { updated: true },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/scenarios/s1',
        payload: { name: 'Updated', scenarioData: { updated: true } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 404 for non-existent scenario', async () => {
      prisma.userScenario.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/scenarios/nonexistent',
        payload: { name: 'Test', scenarioData: {} },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/me/scenarios/:id', () => {
    it('deletes an owned scenario', async () => {
      prisma.userScenario.findFirst.mockResolvedValue({ id: 's1', userId: 'test-user-id' });
      prisma.userScenario.delete.mockResolvedValue({});

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/me/scenarios/s1',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).message).toBe('Scenario deleted');
    });

    it('returns 404 for non-owned scenario', async () => {
      prisma.userScenario.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/me/scenarios/other-users',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
