/**
 * Integration tests for admin location routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock Prisma
vi.mock('../db/prisma.js', () => ({
  default: {
    adminLocation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    adminLocationHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  requireAdmin: vi.fn(async (request) => {
    request.userId = 'admin-user-id';
    request.user = {
      id: 'admin-user-id',
      email: 'admin@example.com',
      tier: 'admin',
    };
  }),
}));

import prisma from '../db/prisma.js';
import adminRoutes from '../routes/admin.js';

describe('Admin location routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(adminRoutes, { prefix: '/api/admin' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('POST /api/admin/locations', () => {
    it('creates a new location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          adminLocation: {
            create: vi.fn().mockResolvedValue({
              id: 'test-city',
              version: 1,
              locationData: { name: 'Test City' },
            }),
          },
          adminLocationHistory: { create: vi.fn() },
        });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/locations',
        payload: { id: 'test-city', locationData: { name: 'Test City' } },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe('test-city');
    });

    it('rejects duplicate locations', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue({ id: 'test-city' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/locations',
        payload: { id: 'test-city', locationData: { name: 'Test City' } },
      });

      expect(res.statusCode).toBe(409);
    });

    it('validates required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/locations',
        payload: { locationData: { name: 'No ID' } },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid location IDs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/locations',
        payload: { id: 'INVALID ID!', locationData: { name: 'Test' } },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/admin/locations/:id', () => {
    it('updates an existing location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue({ id: 'test-city', version: 2 });
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          adminLocation: {
            update: vi.fn().mockResolvedValue({
              id: 'test-city',
              version: 3,
              locationData: { name: 'Updated City' },
            }),
          },
          adminLocationHistory: { create: vi.fn() },
        });
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/locations/test-city',
        payload: { locationData: { name: 'Updated City' } },
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 404 for nonexistent location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/locations/nonexistent',
        payload: { locationData: { name: 'Nope' } },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/admin/locations/:id', () => {
    it('deletes a location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue({ id: 'test-city' });
      prisma.adminLocation.delete.mockResolvedValue({});

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/locations/test-city',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).id).toBe('test-city');
    });

    it('returns 404 for nonexistent location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/locations/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/admin/locations/:id/history', () => {
    it('returns paginated version history', async () => {
      prisma.adminLocationHistory.findMany.mockResolvedValue([
        { version: 2, changedBy: 'admin@example.com', createdAt: new Date() },
        { version: 1, changedBy: 'admin@example.com', createdAt: new Date() },
      ]);
      prisma.adminLocationHistory.count.mockResolvedValue(2);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/locations/test-city/history',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].version).toBe(2);
      expect(body.pagination.total).toBe(2);
    });
  });
});
