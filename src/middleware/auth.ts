/**
 * Clerk JWT authentication middleware for Fastify.
 *
 * Verifies the Bearer token from the Authorization header using Clerk's
 * JWKS endpoint. On success, decorates `request.userId` (Clerk sub) and
 * `request.user` (DB row, lazy-loaded).
 *
 * Environment:
 *   CLERK_SECRET_KEY   — required
 *   CLERK_PUBLISHABLE_KEY — required (used by Clerk SDK internally)
 */
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { User } from '@prisma/client';
import prisma from '../db/prisma.js';

// ─── User cache — avoids DB upsert on every authenticated request ─────────
// Key: Clerk authProviderId → { user, expiresAt }
// TTL: 10 seconds — short enough to pick up tier changes quickly

const USER_CACHE_TTL_MS = 10_000;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function getCachedUser(authProviderId: string): User | null {
  const entry = userCache.get(authProviderId);
  if (entry && entry.expiresAt > Date.now()) return entry.user;
  if (entry) userCache.delete(authProviderId);
  return null;
}

function setCachedUser(authProviderId: string, user: User): void {
  userCache.set(authProviderId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  // Prevent unbounded growth: evict expired entries when map grows large
  if (userCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of userCache) {
      if (val.expiresAt <= now) userCache.delete(key);
    }
  }
}

// ─── Clerk plugin registration ────────────────────────────────────────────

export let clerkEnabled = false;

export async function registerClerk(app: FastifyInstance): Promise<void> {
  if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    app.log.warn('CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY not set — auth disabled (local mode)');
    return;
  }
  await app.register(clerkPlugin);
  clerkEnabled = true;
}

// ─── Auth hook: require signed-in user ────────────────────────────────────

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!clerkEnabled) {
    reply.code(503).send({ error: 'Authentication not configured (local mode)' });
    return;
  }

  let auth: ReturnType<typeof getAuth>;
  try {
    auth = getAuth(request);
  } catch (err) {
    // Clerk SDK can throw on malformed/invalid tokens — treat as 401, not 500
    request.log.warn({ err: (err as Error).message }, 'Clerk getAuth threw — rejecting as 401');
    reply.code(401).send({ error: 'Invalid authentication token' });
    return;
  }

  if (!auth?.userId) {
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  // Clerk subject ID (e.g. "user_2abc...")
  request.authProviderId = auth.userId;

  // Find or create local DB user (with short-lived cache to avoid DB hit on every request)
  try {
    const cached = getCachedUser(auth.userId);
    if (cached) {
      request.user = cached;
      request.userId = cached.id;
      return;
    }

    request.user = await prisma.user.upsert({
      where: { authProviderId: auth.userId },
      update: { updatedAt: new Date() },
      create: {
        authProviderId: auth.userId,
        email: (auth as unknown as { sessionClaims?: { email?: string; name?: string } }).sessionClaims?.email ?? `${auth.userId}@placeholder.local`,
        displayName: (auth as unknown as { sessionClaims?: { email?: string; name?: string } }).sessionClaims?.name ?? null,
      },
    });

    setCachedUser(auth.userId, request.user);
    request.userId = request.user.id;
  } catch (err) {
    request.log.error({ err: (err as Error).message }, 'Failed to upsert user from Clerk auth');
    reply.code(500).send({ error: 'Authentication processing failed' });
    return;
  }
}

// ─── Tier guard: requireAuth + minimum tier check ─────────────────────────

const TIER_ORDER: Record<string, number> = { free: 0, basic: 1, premium: 2, admin: 3 };

/**
 * Factory that returns a preHandler enforcing a minimum subscription tier.
 * Usage: `{ preHandler: requireTier('basic') }` or `app.addHook('preHandler', requireTier('basic'))`
 */
export function requireTier(minimumTier: 'basic' | 'premium' | 'admin') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const userLevel = TIER_ORDER[request.user.tier] ?? 0;
    const requiredLevel = TIER_ORDER[minimumTier] ?? 0;

    if (userLevel < requiredLevel) {
      reply.code(403).send({ error: `Requires ${minimumTier} tier or higher` });
      return;
    }
  };
}

// ─── Feature guard: requireAuth + feature set check ──────────────────────

/**
 * Factory that returns a preHandler enforcing a feature set unlock.
 * Checks UserFeatureUnlock table. Admin users and grandfathered users pass through.
 * Usage: `{ preHandler: requireFeature('basic') }`
 */
export function requireFeature(featureSet: 'basic' | 'premium') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    // Admin always passes
    if (request.user.tier === 'admin') return;

    // Check feature unlock table
    const unlock = await prisma.userFeatureUnlock.findUnique({
      where: {
        userId_featureSet: {
          userId: request.userId,
          featureSet,
        },
      },
    });

    if (unlock) return; // User has this feature unlocked

    // Premium unlock also covers basic
    if (featureSet === 'basic') {
      const premiumUnlock = await prisma.userFeatureUnlock.findUnique({
        where: {
          userId_featureSet: {
            userId: request.userId,
            featureSet: 'premium',
          },
        },
      });
      if (premiumUnlock) return;
    }

    reply.code(403).send({
      error: `Requires ${featureSet} access`,
      unlockOptions: ['contribute', 'purchase'],
    });
    return;
  };
}

// ─── Admin guard: requireAuth + admin tier ────────────────────────────────

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return; // requireAuth already sent 401

  if (request.user.tier !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }
}
