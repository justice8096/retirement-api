/**
 * Integration tests for billing routes:
 *   POST /api/billing/checkout-feature  — one-time feature unlock
 *   POST /api/billing/portal            — legacy Stripe Customer Portal
 *   GET  /api/billing/status            — tier + unlocks + badges + release access
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Set env vars before any module imports (must be in vi.hoisted to run before ESM evaluation).
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_PRICE_FEATURE_BASIC = 'price_feature_basic_123';
  process.env.STRIPE_PRICE_FEATURE_PREMIUM = 'price_feature_premium_456';
  process.env.APP_URL = 'http://localhost:5173';
});

// Mock Stripe — hoisted so the mock object is available in the vi.mock factory.
const mockStripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));

// Under vitest 4, `new Stripe(...)` invokes the mock implementation as a
// constructor. Arrow functions aren't constructors (vitest 3 tolerated
// this; 4 does not), so use a regular function whose explicit return
// value becomes the constructed instance.
vi.mock('stripe', () => ({
  default: vi.fn(function Stripe() { return mockStripe; }),
}));

vi.mock('../db/prisma.js', () => ({
  default: {
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userFeatureUnlock: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userReleasePurchase: {
      findMany: vi.fn(),
    },
    dataRelease: {
      findFirst: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      tier: 'free',
      stripeCustomerId: null,
    };
  }),
}));

import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import billingRoutes from '../routes/billing.js';

/** Default no-op mocks for `/status` multi-table query. */
function primeStatusDefaults() {
  (prisma.userFeatureUnlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.userReleasePurchase.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.dataRelease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ version: 1 });
  (prisma.userBadge.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.userBadge.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

describe('Billing routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    vi.clearAllMocks();
    primeStatusDefaults();
    // `ensureStripeCustomer` helper needs updateMany to exist and default to 1 row updated.
    (prisma.user.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    await app.register(billingRoutes, { prefix: '/api/billing' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // ─── POST /api/billing/checkout-feature ──────────────────────────

  describe('POST /api/billing/checkout-feature', () => {
    it('creates checkout session for valid basic featureSet', async () => {
      (prisma.userFeatureUnlock.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new_123' });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_abc',
        id: 'cs_abc',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'basic' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.url).toBe('https://checkout.stripe.com/session_abc');
      expect(body.sessionId).toBe('cs_abc');
    });

    it('creates checkout session for valid premium featureSet', async () => {
      (prisma.userFeatureUnlock.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new_456' });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_def',
        id: 'cs_def',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'premium' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.url).toContain('stripe.com');
    });

    it('rejects invalid featureSet enum value', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'not-a-tier' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
      // Plain-language envelope per Dyslexia F-007 / F-011.
      expect(JSON.parse(res.payload).error).toBe('Validation failed');
    });

    it('rejects missing featureSet', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: {},
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 409 when feature is already unlocked', async () => {
      (prisma.userFeatureUnlock.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'test-user-id',
        featureSet: 'basic',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'basic' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.payload).error).toContain('already unlocked');
    });

    it('reuses existing Stripe customer ID when present', async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(async (request) => {
        request.userId = 'test-user-id';
        request.user = {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'free',
          stripeCustomerId: 'cus_existing_789',
        };
      });
      (prisma.userFeatureUnlock.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_ghi',
        id: 'cs_ghi',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'basic' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      // Should NOT create a new customer.
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      // Checkout session should use existing customer.
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing_789' }),
      );
    });

    it('creates Stripe customer via ensureStripeCustomer for first-time user', async () => {
      (prisma.userFeatureUnlock.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_brand_new' });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/s',
        id: 'cs_s',
      });

      await app.inject({
        method: 'POST',
        url: '/api/billing/checkout-feature',
        payload: { featureSet: 'basic' },
        headers: { 'content-type': 'application/json' },
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          metadata: { userId: 'test-user-id' },
        }),
      );
      // The ensureStripeCustomer helper uses `updateMany where stripeCustomerId: null`
      // as an optimistic-concurrency guard (SAST L-NEW-02).
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'test-user-id', stripeCustomerId: null },
        data: { stripeCustomerId: 'cus_brand_new' },
      });
    });
  });

  // ─── POST /api/billing/portal ────────────────────────────────────

  describe('POST /api/billing/portal', () => {
    it('creates portal session for user with Stripe customer', async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(async (request) => {
        request.userId = 'test-user-id';
        request.user = {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'basic',
          stripeCustomerId: 'cus_portal_123',
        };
      });

      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal_abc',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/portal',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).url).toContain('stripe.com');
    });

    it('rejects portal request without Stripe customer', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/portal',
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe('No billing account found');
    });
  });

  // ─── GET /api/billing/status ─────────────────────────────────────

  describe('GET /api/billing/status', () => {
    it('returns tier, masked customer ID, and empty unlocks for free user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tier).toBe('free');
      expect(body.stripeCustomerId).toBeNull();
      expect(body.featureUnlocks).toEqual([]);
      expect(body.purchasedReleases).toEqual([]);
      expect(body.badges).toEqual([]);
      expect(body.isFoundingMember).toBe(false);
    });

    it('masks the Stripe customer id for paid users', async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(async (request) => {
        request.userId = 'test-user-id';
        request.user = {
          id: 'test-user-id',
          tier: 'premium',
          stripeCustomerId: 'cus_real_id_here',
        };
      });
      (prisma.userFeatureUnlock.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { featureSet: 'basic', unlockedVia: 'purchase' },
        { featureSet: 'premium', unlockedVia: 'purchase' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tier).toBe('premium');
      expect(body.stripeCustomerId).toBe('***');
      expect(body.featureUnlocks).toEqual(['basic', 'premium']);
    });

    it('flags founding-member badge when present', async () => {
      (prisma.userBadge.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'test-user-id',
        badgeKey: 'founding_member',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).isFoundingMember).toBe(true);
    });

    it('sets no-store cache header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.headers['cache-control']).toBe('private, no-store');
    });
  });
});
