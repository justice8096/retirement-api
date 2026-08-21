/**
 * Tests for POST /api/auth/login and GET /api/auth/me. Prisma is mocked;
 * hashing and JWT verification are real (no auth mocks in this file, so
 * /me exercises the actual requireAuth chain with the login's token).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

import prisma from '../db/prisma.js';
import authRoutes from '../routes/auth.js';
import { hashPassword } from '../lib/passwords.js';
import { invalidateUserCache } from '../middleware/auth.js';

describe('auth routes', () => {
  let app: FastifyInstance;
  let dbUser: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateUserCache('user-1');
    dbUser = {
      id: 'user-1', authProviderId: 'local:justice', username: 'justice',
      email: 'justice@example.com', displayName: 'Justice', tier: 'admin',
      passwordHash: await hashPassword('morgaine'),
      stripeCustomerId: null, createdAt: new Date(), updatedAt: new Date(),
    };
    app = Fastify({ logger: false });
    await app.register(authRoutes, { prefix: '/api/auth' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const login = (body: unknown) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: body });

  it('logs in and the issued token works on /me', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const res = await login({ username: 'justice', password: 'morgaine' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(body.user).toEqual({ username: 'justice', displayName: 'Justice', tier: 'admin' });

    const me = await app.inject({
      method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe('justice');
  });

  it('normalizes username case and whitespace', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const res = await login({ username: '  Justice ', password: 'morgaine' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'justice' } });
  });

  it('wrong password and unknown username return the identical generic 401', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const wrongPw = await login({ username: 'justice', password: 'nope' });
    prisma.user.findUnique.mockResolvedValue(null);
    const noUser = await login({ username: 'ghost', password: 'nope' });
    expect(wrongPw.statusCode).toBe(401);
    expect(noUser.statusCode).toBe(401);
    expect(wrongPw.json()).toEqual(noUser.json());
    expect(wrongPw.json().error).toBe("That username or password didn't match.");
  });

  it('400s on malformed bodies with the standard validation envelope', async () => {
    const res = await login({ username: 'justice' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Validation failed');
  });
});
