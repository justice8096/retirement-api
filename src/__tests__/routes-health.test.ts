/**
 * Integration tests for health check routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Set env vars before module evaluation
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  process.env.STRIPE_PRICE_BASIC = 'price_basic_fake';
  process.env.STRIPE_PRICE_PREMIUM = 'price_premium_fake';
  process.env.APP_URL = 'http://localhost:5173';
});

// Mock Prisma
vi.mock('../db/prisma.js', () => ({
  default: {
    $queryRaw: vi.fn(),
    processedEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

// Mock Stripe — regular function so `new Stripe(...)` works under vitest 4.
vi.mock('stripe', () => ({
  default: vi.fn(function Stripe() {
    return { webhooks: { constructEvent: vi.fn() } };
  }),
}));

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  requireAdmin: vi.fn((req, reply, done) => done()),
  requireAuth: vi.fn(async () => {}),
  clerkEnabled: true,
}));

// Mock Clerk (getAuth used in health route for conditional details)
vi.mock('@clerk/fastify', () => ({
  getAuth: vi.fn(() => null), // default: unauthenticated
}));

import prisma from '../db/prisma.js';
import healthRoutes from '../routes/health.js';
import { getAuth } from '@clerk/fastify';

describe('Health routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes, { prefix: '/api' });
  });

  /**
   * Helper: mark the next request as admin. The health route only exposes
   * `encryption`, `auth`, `stripe`, and `memory` details to admin users
   * (prevent info disclosure). Tests that want those branches need the
   * decorated `request.user.tier = 'admin'`.
   */
  function injectAsAdmin(url: string) {
    return app.inject({
      method: 'GET',
      url,
      // Fastify's `.inject()` supports `server` + `cookies` + `headers`;
      // we pipe the admin tier through a request header that the hook
      // below converts into `request.user`.
      headers: { 'x-test-tier': 'admin' },
    });
  }

  // Register the hook once — idempotent: onRequest runs per-request and
  // honors the test's `x-test-tier` header to fake the admin gate.
  beforeEach(() => {
    app.addHook('onRequest', (req, _reply, done) => {
      const tier = req.headers['x-test-tier'];
      if (tier) {
        (req as unknown as { user: { tier: string } }).user = { tier: String(tier) };
      }
      done();
    });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns healthy status when DB is reachable', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(body.checks.database.status).toBe('ok');
    });

    it('returns degraded when DB fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);

      const body = JSON.parse(res.payload);
      expect(body.status).toBe('degraded');
      expect(body.checks.database.status).toBe('error');
    });

    it('hides config details from unauthenticated requests', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (getAuth as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/health' });
      const body = JSON.parse(res.payload);
      expect(body.checks.encryption).toBeUndefined();
      expect(body.checks.auth).toBeUndefined();
      expect(body.checks.stripe).toBeUndefined();
      expect(body.memory).toBeUndefined();
    });

    it('reports encryption warning when admin and key not set', async () => {
      // Encryption / auth / stripe / memory details are admin-only (info
      // disclosure hardening). Mark the request as admin via the test
      // helper.
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'user_admin' });
      delete process.env.ENCRYPTION_MASTER_KEY;

      const res = await injectAsAdmin('/api/health');
      const body = JSON.parse(res.payload);
      expect(body.checks.encryption.status).toBe('warning');
    });

    it('reports Redis info status when not configured', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      delete process.env.REDIS_URL;

      const res = await app.inject({ method: 'GET', url: '/api/health' });
      const body = JSON.parse(res.payload);
      expect(body.checks.redis.status).toBe('info');
    });

    it('includes memory stats for admin users', async () => {
      // Memory stats are admin-only (info disclosure hardening).
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({ userId: 'user_admin' });

      const res = await injectAsAdmin('/api/health');
      const body = JSON.parse(res.payload);
      expect(body.memory).toBeDefined();
      expect(body.memory.rss).toMatch(/MB$/);
      expect(body.memory.heapUsed).toMatch(/MB$/);
    });

    it('includes uptime', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const res = await app.inject({ method: 'GET', url: '/api/health' });
      const body = JSON.parse(res.payload);
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('GET /api/health/ready', () => {
    it('returns ready when DB is reachable', async () => {
      prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ ready: true });
    });

    it('returns 503 when DB is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ ready: false });
    });
  });

  describe('POST /api/health/cleanup', () => {
    it('cleans up old processed events', async () => {
      prisma.processedEvent.deleteMany.mockResolvedValue({ count: 5 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/health/cleanup',
        payload: { olderThanDays: 7 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.cleaned).toBe(5);
      expect(body.olderThanDays).toBe(7);
    });

    it('uses default 7 days when not specified', async () => {
      prisma.processedEvent.deleteMany.mockResolvedValue({ count: 0 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/health/cleanup',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.olderThanDays).toBe(7);
    });
  });
});
