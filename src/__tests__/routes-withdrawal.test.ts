/**
 * Integration tests for withdrawal-strategy routes (GET/PUT/DELETE
 * /api/me/withdrawal).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    userWithdrawalStrategy: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
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
import withdrawalRoutes from '../routes/withdrawal.js';

describe('Withdrawal strategy routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // vitest 4: call history on module mocks no longer cleared by
    // restoreAllMocks in afterEach. Clear explicitly to prevent bleed.
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(withdrawalRoutes, { prefix: '/api/me/withdrawal' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/me/withdrawal', () => {
    it('returns fixed 4% defaults when no strategy exists', async () => {
      prisma.userWithdrawalStrategy.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/withdrawal' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.strategyType).toBe('fixed');
      expect(body.withdrawalRate).toBe(0.04);
      expect(body.capeMultiplier).toBeNull();
      expect(body.capeFixedComponent).toBeNull();
    });

    it('sets no-store cache header', async () => {
      prisma.userWithdrawalStrategy.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/withdrawal' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });

  describe('PUT /api/me/withdrawal', () => {
    it('rejects invalid schema (extra fields)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: { strategyType: 'fixed', unknownField: true },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects out-of-range withdrawalRate', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: { withdrawalRate: 5 },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("strategyType 'cape' (Big ERN)", () => {
    const capeStrategy = {
      userId: 'test-user-id',
      strategyType: 'cape',
      withdrawalRate: 0.04,
      ceilingRate: 0.06,
      floorRate: 0.02,
      capeMultiplier: 0.5,
      capeFixedComponent: 0.015,
    };

    it('PUT accepts strategyType cape with its params', async () => {
      prisma.userWithdrawalStrategy.upsert.mockResolvedValue(capeStrategy);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: {
          strategyType: 'cape',
          ceilingRate: 0.06,
          floorRate: 0.02,
          capeMultiplier: 0.5,
          capeFixedComponent: 0.015,
        },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const call = prisma.userWithdrawalStrategy.upsert.mock.calls[0][0];
      // Persisted verbatim — capeMultiplier/capeFixedComponent are plain
      // decimal-fraction knobs, not encrypted (unlike essentialSpending etc).
      expect(call.update.strategyType).toBe('cape');
      expect(call.update.capeMultiplier).toBe(0.5);
      expect(call.update.capeFixedComponent).toBe(0.015);
      expect(call.update.ceilingRate).toBe(0.06);
      expect(call.update.floorRate).toBe(0.02);
    });

    it('save+load round-trip: GET reflects what PUT persisted', async () => {
      prisma.userWithdrawalStrategy.upsert.mockResolvedValue(capeStrategy);

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: {
          strategyType: 'cape',
          ceilingRate: 0.06,
          floorRate: 0.02,
          capeMultiplier: 0.5,
          capeFixedComponent: 0.015,
        },
        headers: { 'content-type': 'application/json' },
      });
      expect(putRes.statusCode).toBe(200);

      // Simulate the round trip: GET now returns what was just stored.
      prisma.userWithdrawalStrategy.findUnique.mockResolvedValue(capeStrategy);

      const getRes = await app.inject({ method: 'GET', url: '/api/me/withdrawal' });
      const body = JSON.parse(getRes.payload);

      expect(getRes.statusCode).toBe(200);
      expect(body.strategyType).toBe('cape');
      expect(body.capeMultiplier).toBe(0.5);
      expect(body.capeFixedComponent).toBe(0.015);
      expect(body.ceilingRate).toBe(0.06);
      expect(body.floorRate).toBe(0.02);
      // Plain-language decoration + glossary link routed to the cape term.
      expect(body.explanation).toContain('cape');
      expect(body.glossary).toBe('/api/glossary?key=cape');
      expect(body._units.capeMultiplier.encoding).toBe('fraction');
      expect(body._units.capeFixedComponent.encoding).toBe('fraction');
    });

    it('PUT rejects capeMultiplier out of range with a plain-language fieldLabel', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: { strategyType: 'cape', capeMultiplier: 5 },
        headers: { 'content-type': 'application/json' },
      });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(400);
      // FIELD_LABELS convention (validation.ts): every schema field ships a
      // hand-written label, not the auto title-case fallback ("Cape Multiplier").
      const issue = body.details.find((d: { field: string }) => d.field === 'capeMultiplier');
      expect(issue.fieldLabel).toBe('CAPE multiplier');
    });

    it('PUT rejects negative capeFixedComponent with a plain-language fieldLabel', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: { strategyType: 'cape', capeFixedComponent: -0.01 },
        headers: { 'content-type': 'application/json' },
      });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(400);
      const issue = body.details.find((d: { field: string }) => d.field === 'capeFixedComponent');
      expect(issue.fieldLabel).toBe('CAPE fixed component');
    });

    it('PUT accepts null capeMultiplier/capeFixedComponent (fall back to shared-lib defaults)', async () => {
      prisma.userWithdrawalStrategy.upsert.mockResolvedValue({
        ...capeStrategy,
        capeMultiplier: null,
        capeFixedComponent: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/withdrawal',
        payload: { strategyType: 'cape', capeMultiplier: null, capeFixedComponent: null },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/me/withdrawal', () => {
    it('resets to fixed 4% defaults', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/me/withdrawal' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.strategyType).toBe('fixed');
      expect(prisma.userWithdrawalStrategy.deleteMany).toHaveBeenCalled();
    });
  });
});
