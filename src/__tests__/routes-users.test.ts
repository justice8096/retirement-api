/**
 * Integration tests for user routes (GET/PUT/DELETE /api/me, GET /api/me/export).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', email: 'test@example.com', tier: 'free' };
  }),
}));

import prisma from '../db/prisma.js';
import userRoutes from '../routes/users.js';

describe('User routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(userRoutes, { prefix: '/api/me' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me', () => {
    it('returns user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        tier: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({ method: 'GET', url: '/api/me' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).email).toBe('test@example.com');
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/me', () => {
    it('updates display name', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        displayName: 'New Name',
        tier: 'free',
        updatedAt: new Date(),
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me',
        payload: { displayName: 'New Name' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).displayName).toBe('New Name');
    });

    it('rejects invalid email', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me',
        payload: { email: 'not-an-email' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects unknown fields', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me',
        payload: { tier: 'admin' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/me', () => {
    it('deletes the user account', async () => {
      prisma.user.delete.mockResolvedValue({});

      const res = await app.inject({ method: 'DELETE', url: '/api/me' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).message).toContain('deleted');
    });
  });

  describe('GET /api/me/export', () => {
    it('exports all user data', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test',
        tier: 'free',
        authProviderId: 'clerk_xxx',
        stripeCustomerId: 'cus_xxx',
        household: null,
        financialSettings: null,
        preferences: null,
        customLocations: [],
        locationOverrides: [],
        scenarios: [],
        groceryData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await app.inject({ method: 'GET', url: '/api/me/export' });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      // Sensitive fields should be stripped
      expect(body.authProviderId).toBeUndefined();
      expect(body.stripeCustomerId).toBeUndefined();
      // Regular fields should be present
      expect(body.email).toBe('test@example.com');
      expect(res.headers['content-disposition']).toContain('retirement-data-export');
    });

    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/export' });
      expect(res.statusCode).toBe(404);
    });
  });
});
