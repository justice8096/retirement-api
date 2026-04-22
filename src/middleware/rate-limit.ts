/**
 * Per-tier rate limiting configuration.
 *
 * Tiers (ordered — every authenticated tier must be ≥ unauth so signing in
 * never *reduces* a user's quota):
 *   - unauthenticated: 100 req/min (public endpoints)
 *   - free:            150 req/min
 *   - basic:           300 req/min
 *   - premium:         600 req/min
 *   - admin:          1200 req/min
 *
 * In production, configure REDIS_URL for distributed rate limiting.
 * Without Redis, uses in-memory store (resets on restart, per-process only).
 */
import type { FastifyRequest } from 'fastify';

const TIER_LIMITS: Record<string, number> = {
  free: 150,
  basic: 300,
  premium: 600,
  admin: 1200,
};

const DEFAULT_LIMIT = 100; // unauthenticated (auth resolves after rate-limit in dev)

/**
 * Endpoints exempt from rate limiting.
 * These are critical bootstrap paths — if billing/status is rate-limited,
 * the frontend can't resolve the user's tier and falls back to "free",
 * locking the user out of features they've paid for.
 */
const EXEMPT_PATHS = new Set([
  '/api/health',
  '/api/billing/status',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
]);

/**
 * Build a Redis store for @fastify/rate-limit if REDIS_URL is set.
 * Falls back to the built-in in-memory store otherwise.
 *
 * IMPORTANT: If Redis connection fails or is unreliable, returns undefined
 * so that rate limiting continues with the in-memory fallback rather than
 * crashing the entire request pipeline.
 */
async function buildRedisStore(): Promise<unknown> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined; // use default in-memory store

  try {
    const ioredis = await import('ioredis');
    const Redis = ioredis.default || ioredis;
    const client = new (Redis as any)(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      },
    });

    await client.connect();

    // Verify the connection actually works
    const pong = await client.ping();
    if (pong !== 'PONG') {
      console.warn('[rate-limit] Redis ping failed, using in-memory store');
      await client.quit().catch(() => {});
      return undefined;
    }

    console.log('[rate-limit] Connected to Redis for distributed rate limiting');

    // Handle connection loss gracefully — log but don't crash
    client.on('error', (err: Error) => {
      console.warn('[rate-limit] Redis error (rate-limit will use in-memory fallback):', err.message);
    });

    return client;
  } catch (err) {
    console.warn('[rate-limit] Redis unavailable, using in-memory store:', (err as Error).message);
    return undefined;
  }
}

/**
 * Rate limit config for @fastify/rate-limit.
 * Uses `request.user.tier` if available, else falls back to default.
 */
const rateLimitConfig = {
  max: (request: FastifyRequest) => {
    // Safely access user tier (user may not be populated yet at this stage)
    try {
      const tier = request.user?.tier;
      if (tier && TIER_LIMITS[tier]) {
        return TIER_LIMITS[tier]!;
      }
    } catch {
      // request.user might throw if not decorated yet
    }
    return DEFAULT_LIMIT;
  },
  timeWindow: '1 minute',
  allowList: (request: FastifyRequest) => {
    // Never rate-limit critical bootstrap endpoints
    return EXEMPT_PATHS.has(request.url.split('?')[0]!);
  },
  keyGenerator: (request: FastifyRequest) => {
    // Use userId for authenticated users (more accurate than IP)
    try {
      return request.userId || request.ip;
    } catch {
      return request.ip;
    }
  },
  errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number; max: number; statusCode: number; after: string }) => {
    const err = new Error('Too many requests') as Error & { statusCode: number; retryAfter: number; limit: number };
    err.statusCode = context.statusCode || 429;
    err.retryAfter = Math.ceil(context.ttl / 1000);
    err.limit = context.max;
    return err;
  },
};

export { rateLimitConfig, TIER_LIMITS, DEFAULT_LIMIT, buildRedisStore };
