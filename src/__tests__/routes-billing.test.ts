/**
 * Integration tests for billing routes (POST /api/billing/checkout, /portal, GET /status).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Set env vars before any module imports (must be in vi.hoisted to run before ESM evaluation)
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_PRICE_BASIC = 'price_basic_123';
  process.env.STRIPE_PRICE_PREMIUM = 'price_premium_456';
  process.env.APP_URL = 'http://localhost:5173';
});

// Mock Stripe — use vi.hoisted so mock object is available in hoisted vi.mock factory
const mockStripe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripe),
}));

vi.mock('../db/prisma.js', () => ({
  default: {
    user: {
      update: vi.fn(),
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

describe('Billing routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(billingRoutes, { prefix: '/api/billing' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // ─── POST /api/billing/checkout ──────────────────────────────────

  describe('POST /api/billing/checkout', () => {
    it('creates checkout session for valid basic price', async () => {
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new_123' });
      prisma.user.update.mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_abc',
        id: 'cs_abc',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: { priceId: 'price_basic_123' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.url).toBe('https://checkout.stripe.com/session_abc');
      expect(body.sessionId).toBe('cs_abc');
    });

    it('creates checkout session for valid premium price', async () => {
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new_456' });
      prisma.user.update.mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_def',
        id: 'cs_def',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: { priceId: 'price_premium_456' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.url).toContain('stripe.com');
    });

    it('rejects invalid price ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: { priceId: 'price_invalid_999' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe('Invalid price ID');
    });

    it('rejects missing price ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: {},
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('reuses existing Stripe customer ID', async () => {
      // User already has a stripeCustomerId
      (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(async (request) => {
        request.userId = 'test-user-id';
        request.user = {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'free',
          stripeCustomerId: 'cus_existing_789',
        };
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_ghi',
        id: 'cs_ghi',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: { priceId: 'price_basic_123' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      // Should NOT create a new customer
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      // Checkout session should use existing customer
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing_789' }),
      );
    });

    it('creates Stripe customer for first-time subscriber', async () => {
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_brand_new' });
      prisma.user.update.mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/s',
        id: 'cs_s',
      });

      await app.inject({
        method: 'POST',
        url: '/api/billing/checkout',
        payload: { priceId: 'price_basic_123' },
        headers: { 'content-type': 'application/json' },
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          metadata: { userId: 'test-user-id' },
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
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
    it('returns tier and masked customer ID for paid user', async () => {
      (requireAuth as ReturnType<typeof vi.fn>).mockImplementationOnce(async (request) => {
        request.userId = 'test-user-id';
        request.user = {
          id: 'test-user-id',
          tier: 'premium',
          stripeCustomerId: 'cus_real_id_here',
        };
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tier).toBe('premium');
      expect(body.stripeCustomerId).toBe('***'); // masked
    });

    it('returns free tier with null customer for free user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/billing/status',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.tier).toBe('free');
      expect(body.stripeCustomerId).toBeNull();
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
