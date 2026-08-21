/**
 * Local-auth middleware for Fastify (Clerk removed 2026-08-21 — see
 * docs/superpowers/specs/2026-08-21-local-auth-design.md).
 *
 * Verifies self-issued HS256 JWTs from the Authorization header. On
 * success, decorates `request.userId` (DB id), `request.user` (DB row via
 * a short-lived cache) and `request.authProviderId`.
 *
 * Environment:
 *   AUTH_JWT_SECRET      — required in production (startup assert);
 *                          dev generates an ephemeral secret + warning
 *   AUTH_TOKEN_TTL_DAYS  — token lifetime, default 30
 */
import { createSigner, createVerifier } from 'fast-jwt';
import { randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User } from '@prisma/client';
import prisma from '../db/prisma.js';

// ─── Token signing / verification ─────────────────────────────────────────

/** True when the secret came from the environment (vs dev-ephemeral). */
export const authSecretConfigured = !!process.env.AUTH_JWT_SECRET;

const authSecret = process.env.AUTH_JWT_SECRET ?? randomBytes(32).toString('hex');
if (!authSecretConfigured && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('[auth] AUTH_JWT_SECRET not set — using an ephemeral dev secret; tokens die on restart.');
}

const AUTH_TTL_DAYS = Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 30);
const AUTH_TTL_MS = AUTH_TTL_DAYS * 24 * 60 * 60 * 1000;

const signToken = createSigner({ key: authSecret, expiresIn: AUTH_TTL_MS });
const verifyToken = createVerifier({ key: authSecret });

export interface AuthTokenPayload {
  sub: string;
  username: string | null;
  tier: string;
  iat: number;
  exp: number;
}

/**
 * Startup safety check — refuse to boot in production without a real
 * secret (mirrors the encryption-key enforcement).
 */
export function assertAuthSecretInProd(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_JWT_SECRET) {
    throw new Error('AUTH_JWT_SECRET must be set in production');
  }
}

/** Issue a bearer token for a user. */
export function signAuthToken(user: User): { token: string; expiresAt: string } {
  const token = signToken({ sub: user.id, username: user.username, tier: user.tier });
  return { token, expiresAt: new Date(Date.now() + AUTH_TTL_MS).toISOString() };
}

/**
 * Soft verification: parse + verify a `Bearer <token>` Authorization header
 * value, returning the payload or null. Never throws. Used by routes that
 * only OPTIONALLY elevate on auth (e.g. the health endpoint's admin
 * detail section) without rejecting unauthenticated callers.
 */
export function verifyAuthHeader(header: string | undefined): AuthTokenPayload | null {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7)) as AuthTokenPayload;
  } catch {
    return null;
  }
}

// ─── User cache — avoids a DB hit on every authenticated request ──────────
// Key: user id (JWT `sub`) → { user, expiresAt }
// TTL: 10 seconds — short enough to pick up tier changes quickly

const USER_CACHE_TTL_MS = 10_000;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function getCachedUser(userId: string): User | null {
  const entry = userCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.user;
  if (entry) userCache.delete(userId);
  return null;
}

function setCachedUser(userId: string, user: User): void {
  userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  // Prevent unbounded growth: evict expired entries when map grows large
  if (userCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of userCache) {
      if (val.expiresAt <= now) userCache.delete(key);
    }
  }
}

/**
 * Invalidate the in-memory user cache for a specific user id.
 * Call from tier-change paths (webhooks, admin endpoints) so that elevated
 * or downgraded permissions take effect within the next request instead of
 * waiting for the 10-second TTL.
 *
 * SAST H-05 (2026-04-19). For multi-replica deployments, also publish the
 * user id on a Redis channel and have each replica subscribe.
 */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
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
      request.log.warn({ err: (err as Error).message }, 'Dev bypass failed — falling through to token auth');
    }
  }

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Please sign in to use this feature.' });
    return;
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyToken(header.slice(7)) as AuthTokenPayload;
  } catch {
    // Expired, malformed, or signed with a rotated secret — all read the
    // same to the user: sign in again. (Plain-language per house style.)
    reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  try {
    const cached = getCachedUser(payload.sub);
    if (cached) {
      request.user = cached;
      request.userId = cached.id;
      request.authProviderId = cached.authProviderId;
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      // Token is valid but the account is gone (deleted user).
      reply.code(401).send({ error: 'Your session has expired. Please sign in again.' });
      return;
    }

    setCachedUser(user.id, user);
    request.user = user;
    request.userId = user.id;
    request.authProviderId = user.authProviderId;
  } catch (err) {
    request.log.error({ err: (err as Error).message }, 'Failed to load user for auth token');
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
