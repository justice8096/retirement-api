/**
 * Local auth routes — username/password login issuing self-signed JWTs.
 * Clerk removed 2026-08-21 (docs/superpowers/specs/2026-08-21-local-auth-design.md).
 *
 * No registration endpoint by design: accounts are managed with
 * `tools/manage-users.mjs` (run by Claude on request).
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { verifyPassword, hashPassword } from '../lib/passwords.js';
import { signAuthToken, requireAuth } from '../middleware/auth.js';
import { toValidationErrorPayload } from '../lib/validation.js';

/** One generic failure message — no user enumeration. */
const GENERIC_FAIL = "That username or password didn't match.";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
}).strict();

/** Verified against when the username doesn't exist, so both branches cost
 *  one scrypt — keeps response timing from leaking which usernames exist. */
const dummyHashPromise = hashPassword('dummy-timing-equalizer');

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Tight per-IP limit: password guessing gets 10 tries per 15 minutes.
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }
    const username = parsed.data.username.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { username } });
    let ok = false;
    if (user) {
      ok = await verifyPassword(parsed.data.password, user.passwordHash);
    } else {
      await verifyPassword(parsed.data.password, await dummyHashPromise);
    }
    if (!ok || !user) {
      return reply.code(401).send({ error: GENERIC_FAIL });
    }

    const { token, expiresAt } = signAuthToken(user);
    reply.header('Cache-Control', 'private, no-store');
    return {
      token,
      expiresAt,
      user: { username: user.username, displayName: user.displayName, tier: user.tier },
    };
  });

  // Session echo for app boot — is this token still good, and who am I?
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return {
      user: {
        username: request.user.username,
        displayName: request.user.displayName,
        tier: request.user.tier,
      },
    };
  });
}
