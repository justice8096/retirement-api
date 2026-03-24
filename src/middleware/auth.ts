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
import prisma from '../db/prisma.js';

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

  const auth = getAuth(request);

  if (!auth?.userId) {
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  // Clerk subject ID (e.g. "user_2abc...")
  request.authProviderId = auth.userId;

  // Find or create local DB user
  request.user = await prisma.user.upsert({
    where: { authProviderId: auth.userId },
    update: { updatedAt: new Date() },
    create: {
      authProviderId: auth.userId,
      email: (auth as unknown as { sessionClaims?: { email?: string; name?: string } }).sessionClaims?.email ?? `${auth.userId}@placeholder.local`,
      displayName: (auth as unknown as { sessionClaims?: { email?: string; name?: string } }).sessionClaims?.name ?? null,
    },
  });

  request.userId = request.user.id;
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

// ─── Admin guard: requireAuth + admin tier ────────────────────────────────

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return; // requireAuth already sent 401

  if (request.user.tier !== 'admin') {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }
}
