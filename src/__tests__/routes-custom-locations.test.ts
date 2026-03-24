/**
 * Integration tests for custom location routes (CRUD /api/me/locations + overrides).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userCustomLocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userLocationOverride: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    adminLocation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'premium' };
  }),
  requireTier: vi.fn((_tier: string) => async (request: Record<string, unknown>) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'premium' };
  }),
}));

import prisma from '../db/prisma.js';
import customLocationRoutes from '../routes/custom-locations.js';

describe('Custom location routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(customLocationRoutes, { prefix: '/api/me/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // ─── Custom Locations ────────────────────────────────────────────

  describe('GET /api/me/locations', () => {
    it('returns list of custom locations', async () => {
      prisma.userCustomLocation.findMany.mockResolvedValue([
        { id: 'cl1', locationData: { name: 'My Custom City' } },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/me/locations' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(1);
    });

    it('sets no-store cache header', async () => {
      prisma.userCustomLocation.findMany.mockResolvedValue([]);
      const res = await app.inject({ method: 'GET', url: '/api/me/locations' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('POST /api/me/locations', () => {
    it('creates a custom location', async () => {
      prisma.userCustomLocation.count.mockResolvedValue(0);
      prisma.userCustomLocation.create.mockResolvedValue({
        id: 'cl-new',
        locationData: { name: 'Costa Rica' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/me/locations',
        payload: { locationData: { name: 'Costa Rica', country: 'CR' } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('enforces 20 location limit', async () => {
      prisma.userCustomLocation.count.mockResolvedValue(20);

      const res = await app.inject({
        method: 'POST',
        url: '/api/me/locations',
        payload: { locationData: { name: 'One Too Many' } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects missing locationData', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/locations',
        payload: {},
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/me/locations/:id', () => {
    it('updates an owned custom location', async () => {
      prisma.userCustomLocation.findFirst.mockResolvedValue({ id: 'cl1' });
      prisma.userCustomLocation.update.mockResolvedValue({
        id: 'cl1',
        locationData: { name: 'Updated' },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/locations/cl1',
        payload: { locationData: { name: 'Updated' } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 404 for non-owned location', async () => {
      prisma.userCustomLocation.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/locations/other-user',
        payload: { locationData: {} },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/me/locations/:id', () => {
    it('deletes an owned custom location', async () => {
      prisma.userCustomLocation.findFirst.mockResolvedValue({ id: 'cl1' });
      prisma.userCustomLocation.delete.mockResolvedValue({});

      const res = await app.inject({ method: 'DELETE', url: '/api/me/locations/cl1' });
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 for non-owned location', async () => {
      prisma.userCustomLocation.findFirst.mockResolvedValue(null);

      const res = await app.inject({ method: 'DELETE', url: '/api/me/locations/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ─── Location Overrides ──────────────────────────────────────────

  describe('GET /api/me/locations/overrides', () => {
    it('returns list of overrides', async () => {
      prisma.userLocationOverride.findMany.mockResolvedValue([
        { baseLocationId: 'fairfax-va', overrides: { rent: 2500 } },
      ]);

      const res = await app.inject({ method: 'GET', url: '/api/me/locations/overrides' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toHaveLength(1);
    });
  });

  describe('PUT /api/me/locations/overrides', () => {
    it('upserts an override with base location version', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue({ version: 3 });
      prisma.userLocationOverride.upsert.mockResolvedValue({
        baseLocationId: 'fairfax-va',
        overrides: { rent: 2500 },
        baseLocationVersion: 3,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/locations/overrides',
        payload: { baseLocationId: 'fairfax-va', overrides: { rent: 2500 } },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.userLocationOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ baseLocationVersion: 3 }),
        }),
      );
    });

    it('returns 404 for non-existent base location', async () => {
      prisma.adminLocation.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/locations/overrides',
        payload: { baseLocationId: 'fake-city', overrides: {} },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/me/locations/overrides/:baseLocationId', () => {
    it('removes an existing override', async () => {
      prisma.userLocationOverride.findFirst.mockResolvedValue({ id: 'ov1' });
      prisma.userLocationOverride.delete.mockResolvedValue({});

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/me/locations/overrides/fairfax-va',
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 404 for non-existent override', async () => {
      prisma.userLocationOverride.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/me/locations/overrides/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
