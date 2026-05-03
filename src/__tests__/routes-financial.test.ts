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
    // vitest 4: call history on module mocks no longer cleared by
    // restoreAllMocks in afterEach. Clear explicitly to prevent bleed.
    vi.clearAllMocks();
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

  describe('rentalProperties (Todo #36)', () => {
    const validRental = {
      id: 'rental-abc12345-xyz',
      label: 'Boulder duplex',
      monthlyGrossRent: 2500,
      vacancyRatePct: 8,
      propertyTaxAnnual: 4000,
      otherOpExAnnual: 3000,
      mortgageInterestAnnual: 0,
      depreciableBasis: 200000,
      depreciationStartYear: 0,
      ownedFromYear: 0,
    };

    it('GET returns empty rentalProperties array when no settings exist', async () => {
      prisma.userFinancialSettings.findUnique.mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/me/financial' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.rentalProperties).toEqual([]);
    });

    it('GET round-trips rentalProperties JSONB array verbatim', async () => {
      const props = [validRental];
      prisma.userFinancialSettings.findUnique.mockResolvedValue({
        userId: 'test-user-id',
        portfolioBalance: 'ENC:500000',
        rentalProperties: props,
      });

      const res = await app.inject({ method: 'GET', url: '/api/me/financial' });
      const body = JSON.parse(res.payload);

      expect(res.statusCode).toBe(200);
      expect(body.rentalProperties).toEqual(props);
    });

    it('PUT persists valid rentalProperties array', async () => {
      prisma.userFinancialSettings.upsert.mockResolvedValue({
        userId: 'test-user-id',
        rentalProperties: [validRental],
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [validRental] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const call = prisma.userFinancialSettings.upsert.mock.calls[0][0];
      // Persisted verbatim — no PCT_FIELDS conversion or encryption
      // touches the rental array.
      expect(call.update.rentalProperties).toEqual([validRental]);
    });

    it('PUT accepts empty array (clears portfolio)', async () => {
      prisma.userFinancialSettings.upsert.mockResolvedValue({
        rentalProperties: [],
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('PUT accepts negative depreciationStartYear (pre-sim depreciation)', async () => {
      // Property placed in service before sim window starts. The dashboard
      // explicitly supports this; the api Zod schema must too.
      prisma.userFinancialSettings.upsert.mockResolvedValue({
        rentalProperties: [{ ...validRental, depreciationStartYear: -10 }],
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [{ ...validRental, depreciationStartYear: -10 }] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('PUT rejects rentalProperty with negative monthlyGrossRent', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [{ ...validRental, monthlyGrossRent: -100 }] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects rentalProperty with vacancyRatePct > 100', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [{ ...validRental, vacancyRatePct: 150 }] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects rentalProperty with extra fields (strict)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [{ ...validRental, sneakyField: 'evil' }] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects rentalProperty with missing required field', async () => {
      const incomplete = { ...validRental };
      delete (incomplete as Record<string, unknown>).id;
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: [incomplete] },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('PUT rejects array with > 50 properties', async () => {
      const tooMany = Array(51).fill(validRental).map((p, i) => ({ ...p, id: `rental-${i}` }));
      const res = await app.inject({
        method: 'PUT',
        url: '/api/me/financial',
        payload: { rentalProperties: tooMany },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
