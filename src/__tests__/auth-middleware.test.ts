/**
 * Tests for the local-auth requireAuth middleware (JWT verification path).
 * Prisma is mocked; tokens are real fast-jwt tokens signed by the module's
 * own signer (signAuthToken) so verification exercises real crypto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createSigner } from 'fast-jwt';

vi.mock('../db/prisma.js', () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

import prisma from '../db/prisma.js';
import { requireAuth, signAuthToken, verifyAuthHeader, invalidateUserCache } from '../middleware/auth.js';

const dbUser = {
  id: 'user-1', authProviderId: 'local:justice', username: 'justice',
  email: 'justice@example.com', displayName: 'Justice', tier: 'admin',
  passwordHash: 'scrypt$…', stripeCustomerId: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/protected', { preHandler: requireAuth }, async (req) => ({
    userId: req.userId, tier: req.user.tier,
  }));
  return app;
}

describe('requireAuth (local JWT)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateUserCache(dbUser.id);
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('accepts a token from signAuthToken and decorates the request', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const { token, expiresAt } = signAuthToken(dbUser as never);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    const res = await app.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: 'user-1', tier: 'admin' });
  });

  it('401s with a plain-language message when the header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Please sign in to use this feature.');
  });

  it('401s on garbage tokens and tokens signed with a different secret', async () => {
    const garbage = await app.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(garbage.statusCode).toBe(401);

    const foreignSigner = createSigner({ key: 'some-other-secret', expiresIn: 60_000 });
    const foreign = await app.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: `Bearer ${foreignSigner({ sub: 'user-1' })}` },
    });
    expect(foreign.statusCode).toBe(401);
    expect(foreign.json().error).toBe('Your session has expired. Please sign in again.');
  });

  it('401s when the token is valid but the user row is gone', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { token } = signAuthToken(dbUser as never);
    const res = await app.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('verifyAuthHeader soft-verifies without throwing', () => {
    const { token } = signAuthToken(dbUser as never);
    expect(verifyAuthHeader(`Bearer ${token}`)?.sub).toBe('user-1');
    expect(verifyAuthHeader('Bearer junk')).toBeNull();
    expect(verifyAuthHeader(undefined)).toBeNull();
  });
});
