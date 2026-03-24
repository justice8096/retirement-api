/**
 * Integration tests for preferences routes (GET/PATCH /api/me/preferences).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userPreferences: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
import preferencesRoutes from '../routes/preferences.js';

describe('Preferences routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(preferencesRoutes, { prefix: '/api/me/preferences' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me/preferences', () => {
    it('returns existing preferences', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue({
        preferences: { theme: 'dark', projectionYears: { overview: 2030 } },
      });

      const res = await app.inject({ method: 'GET', url: '/api/me/preferences' });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.theme).toBe('dark');
      expect(body.projectionYears.overview).toBe(2030);
    });

    it('returns empty object for new users', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/preferences' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({});
    });

    it('sets private cache headers', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/preferences' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('PATCH /api/me/preferences', () => {
    it('creates preferences for new user', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.userPreferences.upsert.mockResolvedValue({
        preferences: { theme: 'dark' },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/me/preferences',
        payload: { theme: 'dark' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).theme).toBe('dark');
    });

    it('shallow-merges with existing preferences', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue({
        preferences: { theme: 'dark', lang: 'en' },
      });
      prisma.userPreferences.upsert.mockResolvedValue({
        preferences: { theme: 'light', lang: 'en' },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/me/preferences',
        payload: { theme: 'light' },
      });

      expect(res.statusCode).toBe(200);
      // Verify upsert was called with merged data
      const upsertCall = prisma.userPreferences.upsert.mock.calls[0][0];
      expect(upsertCall.update.preferences.theme).toBe('light');
      expect(upsertCall.update.preferences.lang).toBe('en');
    });

    it('accepts nested objects (projection years)', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue(null);
      prisma.userPreferences.upsert.mockResolvedValue({
        preferences: { projectionYears: { overview: 2030, compare: 2028 } },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/me/preferences',
        payload: { projectionYears: { overview: 2030, compare: 2028 } },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
