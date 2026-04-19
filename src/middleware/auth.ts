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

// ─── Clerk user profile fetch ────────────────────────────────────────────���

/**
 * Fetches the full user profile from Clerk's Backend API.
 * Used on first sign-in to get the real email + name,
 * since the JWT session claims may not include them by default.
 */
async function fetchClerkUser(clerkUserId: string): Promise<{ email: string | null; name: string | null }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { email: null, name: null };
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) return { email: null, name: null };
    const data = await res.json() as {
      email_addresses?: Array<{ email_address?: string }>;
      first_name?: string | null;
      last_name?: string | null;
    };
    const email = data.email_addresses?.[0]?.email_address ?? null;
    const parts = [data.first_name, data.last_name].filter(Boolean);
    const name = parts.length > 0 ? parts.join(' ') : null;
    return { email, name };
  } catch {
    return { email: null, name: null };
  }
}

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

/**
 * Invalidate the in-memory user cache for a specific authProviderId.
 * Call from tier-change paths (webhooks, admin endpoints) so that elevated
 * or downgraded permissions take effect within the next request instead of
 * waiting for the 10-second TTL.
 *
 * SAST H-05 (2026-04-19). For multi-replica deployments, also publish the
 * authProviderId on a Redis channel and have each replica subscribe.
 */
export function invalidateUserCache(authProviderId: string): void {
  userCache.delete(authProviderId);
}

/**
 * Startup safety check. Refuses to boot when running with `NODE_ENV=production`
 * but the dev-bypass user still exists in the DB — this indicates a staging /
 * prod deploy that was previously a dev environment. Prevents the silent-admin
 * scenario that M-NEW-01 flags.
 */
export async function assertNoDevBypassUserInProd(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  const devUser = await prisma.user.findFirst({
    where: { OR: [{ authProviderId: 'dev_local_bypass' }, { email: 'dev@localhost' }] },
    select: { id: true },
  });
  if (devUser) {
    throw new Error(
      'Refusing to start in production — a dev-bypass user (dev@localhost / dev_local_bypass) exists in the DB. ' +
        'Delete it before launching.',
    );
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
  // ─── Dev bypass: skip auth in development when no Authorization header ──
  // Requires BOTH NODE_ENV=development AND DEV_AUTH_BYPASS=1 — guards against a
  // misconfigured prod deploy (NODE_ENV unset/development) silently granting admin.
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.DEV_AUTH_BYPASS === '1' &&
    !request.headers.authorization
  ) {
    try {
      // Find or create a dev user for local frontend testing
      let devUser = await prisma.user.findFirst({ where: { email: 'dev@localhost' } });
      if (!devUser) {
        devUser = await prisma.user.create({
          data: {
            authProviderId: 'dev_local_bypass',
            email: 'dev@localhost',
            displayName: 'Dev User',
            tier: 'admin',
          },
        });
        request.log.info('Created dev bypass user (dev@localhost, admin tier)');
      }
      request.user = devUser;
      request.userId = devUser.id;
      request.authProviderId = devUser.authProviderId;
      return;
    } catch (err) {
      request.log.warn({ err: (err as Error).message }, 'Dev bypass failed — falling through to Clerk');
    }
  }

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

    // Check if user already exists
    let existingUser = await prisma.user.findUnique({ where: { authProviderId: auth.userId } });

    if (existingUser) {
      // Backfill email/name if user was created with a placeholder
      if (existingUser.email.endsWith('@placeholder.local') || !existingUser.displayName) {
        const clerkProfile = await fetchClerkUser(auth.userId);
        const updates: { email?: string; displayName?: string; updatedAt: Date } = { updatedAt: new Date() };
        if (clerkProfile.email && existingUser.email.endsWith('@placeholder.local')) {
          updates.email = clerkProfile.email;
        }
        if (clerkProfile.name && !existingUser.displayName) {
          updates.displayName = clerkProfile.name;
        }
        existingUser = await prisma.user.update({ where: { id: existingUser.id }, data: updates });
      } else {
        await prisma.user.update({ where: { id: existingUser.id }, data: { updatedAt: new Date() } });
      }
      request.user = existingUser;
    } else {
      // New user — fetch real email/name from Clerk Backend API
      const clerkProfile = await fetchClerkUser(auth.userId);
      request.user = await prisma.user.create({
        data: {
          authProviderId: auth.userId,
          email: clerkProfile.email ?? `${auth.userId}@placeholder.local`,
          displayName: clerkProfile.name ?? null,
        },
      });
    }

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
