/**
 * Integration tests for grocery routes (GET/PUT /api/me/groceries).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userGroceryData: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'basic' };
  }),
}));

import prisma from '../db/prisma.js';
import groceryRoutes from '../routes/groceries.js';

describe('Grocery routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(groceryRoutes, { prefix: '/api/me/groceries' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me/groceries', () => {
    it('returns empty defaults when no data exists', async () => {
      prisma.userGroceryData.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/groceries' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.overrides).toEqual({});
      expect(body.lists).toEqual({});
    });

    it('returns existing grocery data', async () => {
      prisma.userGroceryData.findUnique.mockResolvedValue({
        overrides: { milk: 4.50 },
        lists: { weekly: ['milk', 'bread'] },
      });

      const res = await app.inject({ method: 'GET', url: '/api/me/groceries' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).overrides.milk).toBe(4.50);
    });

    it('sets no-store cache header', async () => {
      prisma.userGroceryData.findUnique.mockResolvedValue(null);
      const res = await app.inject({ method: 'GET', url: '/api/me/groceries' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('PUT /api/me/groceries', () => {
    it('upserts grocery data', async () => {
      prisma.userGroceryData.upsert.mockResolvedValue({
        overrides: { eggs: 3.00 },
        lists: {},
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/groceries',
        payload: { overrides: { eggs: 3.00 } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.userGroceryData.upsert).toHaveBeenCalled();
    });

    it('rejects extra fields (strict schema)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/groceries',
        payload: { overrides: {}, unknownField: 'bad' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
