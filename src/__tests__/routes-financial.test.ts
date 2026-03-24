/**
 * Integration tests for financial routes (GET/PUT /api/me/financial).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userFinancialSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'free' };
  }),
}));

vi.mock('../middleware/encryption.js', () => ({
  encryptField: vi.fn((v) => `ENC:${v}`),
  decryptField: vi.fn((v) => typeof v === 'string' && v.startsWith('ENC:') ? Number(v.slice(4)) : v),
}));

import prisma from '../db/prisma.js';
import financialRoutes from '../routes/financial.js';

describe('Financial routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(financialRoutes, { prefix: '/api/me/financial' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me/financial', () => {
    it('returns defaults when no settings exist', async () => {
      prisma.userFinancialSettings.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/financial' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.portfolioBalance).toBe(500000);
      expect(body.ssCutYear).toBe(2033);
      expect(body.ssCola).toBe(2.5);
    });

    it('returns decrypted settings when they exist', async () => {
      prisma.userFinancialSettings.findUnique.mockResolvedValue({
        userId: 'test-user-id',
        portfolioBalance: 'ENC:750000',
        fxDriftEnabled: false,
        ssCola: 3.0,
      });

      const res = await app.inject({ method: 'GET', url: '/api/me/financial' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.portfolioBalance).toBe(750000);
    });

    it('sets no-store cache header', async () => {
      prisma.userFinancialSettings.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/financial' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('PUT /api/me/financial', () => {
    it('upserts financial settings', async () => {
      prisma.userFinancialSettings.upsert.mockResolvedValue({
        userId: 'test-user-id',
        portfolioBalance: 'ENC:600000',
        ssCola: 2.0,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { portfolioBalance: 600000, ssCola: 2.0 },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.userFinancialSettings.upsert).toHaveBeenCalled();
    });

    it('encrypts portfolioBalance before writing', async () => {
      prisma.userFinancialSettings.upsert.mockResolvedValue({
        portfolioBalance: 'ENC:800000',
      });

      await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { portfolioBalance: 800000 },
        headers: { 'content-type': 'application/json' },
      });

      const call = prisma.userFinancialSettings.upsert.mock.calls[0][0];
      expect(call.update.portfolioBalance).toBe('ENC:800000');
    });

    it('rejects invalid schema (extra fields)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { portfolioBalance: 500000, unknownField: true },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects out-of-range values', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { portfolioBalance: -1 },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
