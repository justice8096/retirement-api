/**
 * Per-tier rate limiting configuration.
 *
 * Tiers:
 *   - unauthenticated: 30 req/min (public endpoints)
 *   - free:            60 req/min
 *   - basic:          120 req/min
 *   - premium:        300 req/min
 *   - admin:          600 req/min
 *
 * In production, configure REDIS_URL for distributed rate limiting.
 * Without Redis, uses in-memory store (resets on restart, per-process only).
 */
import type { FastifyRequest } from 'fastify';

const TIER_LIMITS: Record<string, number> = {
  free: 60,
  basic: 120,
  premium: 300,
  admin: 600,
};

const DEFAULT_LIMIT = 30; // unauthenticated

/**
 * Build a Redis store for @fastify/rate-limit if REDIS_URL is set.
 * Falls back to the built-in in-memory store otherwise.
 */
async function buildRedisStore(): Promise<unknown> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined; // use default in-memory store

  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    await client.connect();
    console.log('[rate-limit] Connected to Redis for distributed rate limiting');

    // @fastify/rate-limit expects a store with get/increment interface
    // ioredis can be passed directly to the redis option
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
    const tier = request.user?.tier;
    if (tier && TIER_LIMITS[tier]) {
      return TIER_LIMITS[tier]!;
    }
    return DEFAULT_LIMIT;
  },
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest) => {
    // Use userId for authenticated users (more accurate than IP)
    return request.userId || request.ip;
  },
  errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number; max: number }) => ({
    error: 'Too many requests',
    retryAfter: Math.ceil(context.ttl / 1000),
    limit: context.max,
  }),
};

export { rateLimitConfig, TIER_LIMITS, DEFAULT_LIMIT, buildRedisStore };
