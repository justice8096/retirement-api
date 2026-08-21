# Local Auth (Clerk Removal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk with local username/password auth: scrypt-hashed credentials in Postgres, self-issued HS256 JWTs, a Claude-run user CLI, and a plain Angular login form.

**Architecture:** Spec: `docs/superpowers/specs/2026-08-21-local-auth-design.md`. API keeps its `requireAuth` contract (request.user/userId/authProviderId decorations, dev bypass, user cache) but the verification core becomes `fast-jwt` against `AUTH_JWT_SECRET`; login lives at `POST /api/auth/login`. Angular keeps its `ready`/`isSignedIn` signal contract so the app shell logic is untouched; only the auth service internals, interceptor, and sign-in form change.

**Tech Stack:** Node `crypto.scrypt`, `fast-jwt`, Fastify 5 + Zod, Prisma, Angular 22 signals.

**Workspaces:** API — worktree `D:\retirement-api\objective-dijkstra-60a597`, branch `claude/objective-dijkstra-60a597` (synced with `consolidation`). Angular — worktree `pet-cost-curves-wt`, new branch `feat/local-auth` off `origin/main`.

## Task L1: Schema + passwords lib (TDD)

**Files:** Modify `prisma/schema.prisma` (User); Create `src/lib/passwords.ts`, `src/__tests__/passwords.test.ts`; migration.

- [ ] Schema: add to `model User`: `username String? @unique` and `passwordHash String? @map("password_hash")`. Run `npx prisma migrate dev --name add-local-auth` (additive, live dev DB safe) + `npx prisma generate`.
- [ ] Failing tests: round-trips a password; rejects wrong password; rejects null/garbage/tampered stored strings; two hashes of the same password differ (random salt).
- [ ] Implement `src/lib/passwords.ts`:

```ts
/**
 * Password hashing for local auth — Node built-in scrypt (no new crypto
 * deps), PHC-style encoding `scrypt$N$r$p$saltB64$hashB64`, timing-safe
 * comparison. Parameters follow OWASP scrypt guidance (N=2^15, r=8, p=1).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * SCRYPT_N * SCRYPT_R,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0) || n > 1 << 20) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length === 0) return false;
  try {
    const actual = (await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 256 * n * r })) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
```

- [ ] Tests pass; commit `feat(auth): scrypt password hashing lib + username/passwordHash columns`.

## Task L2: Token issue/verify + requireAuth rewrite (TDD)

**Files:** Modify `src/middleware/auth.ts` (remove Clerk, add JWT), `package.json` (`npm i fast-jwt`, `npm rm @clerk/fastify`); Test `src/__tests__/auth-middleware.test.ts`.

- [ ] Inventory `auth.ts` exports + consumers (`grep -rn "from '../middleware/auth" src`) before rewriting; preserve every consumed export's signature (`requireAuth`, `requireAdmin`, `invalidateUserCache`, `assertNoDevBypassUserInProd`; `registerClerk` is deleted along with its server.ts call).
- [ ] New core in `auth.ts` (replacing the Clerk section):

```ts
import { createSigner, createVerifier } from 'fast-jwt';
import { randomBytes } from 'node:crypto';

// Secret resolution: required in production (fail fast at startup via
// assertAuthSecretInProd below); in dev, an ephemeral secret is generated
// with a warning so tokens simply die on restart.
const authSecret = process.env.AUTH_JWT_SECRET
  ?? (process.env.NODE_ENV === 'production' ? '' : randomBytes(32).toString('hex'));
const AUTH_TTL_DAYS = Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 30);
const AUTH_TTL_MS = AUTH_TTL_DAYS * 24 * 60 * 60 * 1000;

const signToken = createSigner({ key: authSecret, expiresIn: AUTH_TTL_MS });
const verifyToken = createVerifier({ key: authSecret });

export function assertAuthSecretInProd(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_JWT_SECRET) {
    throw new Error('AUTH_JWT_SECRET must be set in production');
  }
}

export function signAuthToken(user: User): { token: string; expiresAt: string } {
  const token = signToken({ sub: user.id, username: user.username, tier: user.tier });
  return { token, expiresAt: new Date(Date.now() + AUTH_TTL_MS).toISOString() };
}
```

`requireAuth` after the (unchanged) dev-bypass block: read `Authorization: Bearer`, 401 `{ error: 'Please sign in to use this feature.' }` when missing; `verifyToken` in try/catch → 401 `{ error: 'Your session has expired. Please sign in again.' }`; cache lookup by `payload.sub`, else `prisma.user.findUnique({ where: { id: payload.sub } })` (null → 401), decorate request, cache. `request.authProviderId = user.authProviderId`.

- [ ] Tests (mock prisma; real tokens signed with the module's dev ephemeral secret via `signAuthToken`): valid token decorates request; garbage token 401; missing header 401; expired token 401 (sign with `expiresIn: -1000` via a locally created signer is not possible against module secret — instead assert the catch path with a token from a *different* secret); unknown sub 401.
- [ ] `npm rm @clerk/fastify && npm i fast-jwt`; delete `fetchClerkUser`, `registerClerk`, `clerkEnabled`, the `clerkPlugin`/`getAuth` imports. Commit `feat(auth): self-issued JWT verification replaces Clerk in requireAuth`.

## Task L3: Login route (TDD)

**Files:** Create `src/routes/auth.ts`, `src/__tests__/routes-auth.test.ts`; Modify `src/server.ts` (register `/api/auth`, drop Clerk + handshake hook, call `assertAuthSecretInProd`), `src/middleware/public-paths.ts` + `rate-limit.ts` (drop Clerk references; add `/api/auth` to public paths list; keep the file if the rate limiter consumes it, else delete).

- [ ] Route:

```ts
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
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(toValidationErrorPayload(parsed.error));
    const username = parsed.data.username.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { username } });
    const ok = user
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : (await verifyPassword(parsed.data.password, await dummyHashPromise), false);
    if (!ok || !user) return reply.code(401).send({ error: GENERIC_FAIL });

    const { token, expiresAt } = signAuthToken(user);
    return {
      token, expiresAt,
      user: { username: user.username, displayName: user.displayName, tier: user.tier },
    };
  });

  app.get('/me', { preHandler: requireAuth }, async (request) => ({
    user: {
      username: request.user.username,
      displayName: request.user.displayName,
      tier: request.user.tier,
    },
  }));
}
```

- [ ] Login rate limiting: reuse however per-route limits are configured in `middleware/rate-limit.ts` (inspect first); target ~10 attempts / 15 min / IP on `/api/auth/login`.
- [ ] Tests: success returns token + user (then `/me` with that token works through real `requireAuth` — no auth mock in this file); wrong password and unknown username both → 401 with the exact same body; malformed body 400; username case/whitespace-insensitive.
- [ ] server.ts: remove `registerClerk` + the Accept-normalization onRequest hook + its comment block; add `assertAuthSecretInProd()` beside the existing startup asserts; register `authRoutes` prefix `/api/auth`. Fix `routes-health`/`public-paths`/`routes-users` tests that reference Clerk. Full `npm test` + `npm run typecheck` green. Commit `feat(auth): POST /api/auth/login + /api/auth/me; Clerk fully removed from server`.

## Task L4: User CLI + seed accounts

**Files:** Create `tools/manage-users.mjs`; Modify `.env`/`.env.example` (`AUTH_JWT_SECRET`, drop `CLERK_*`), `CLAUDE.md` (auth rows).

- [ ] CLI (plain Node, uses `@prisma/client` + a copy of the scrypt logic via dynamic import of the compiled lib is not available — inline the same `hashPassword`):
  commands `add <username> --email <email> [--name <display>]`, `set-password <username>`, `list`; password read from `--password` or `PASSWORD` env; `add` attaches to an existing row by email (sets `username`, `passwordHash`, `authProviderId: local:<username>` only if the row has no username yet) else creates a new user.
- [ ] Generate `AUTH_JWT_SECRET` (`openssl rand -hex 32`) into `.env`; add placeholder to `.env.example`; remove Clerk keys from both.
- [ ] Seed: `justice` (attach by email justice8096@gmail.com if present) and `jackie`, with the bootstrap passwords from the session; verify `list` shows both; live-test login via curl. Commit `feat(auth): manage-users CLI; seed local accounts` (CLI only — no secrets in the commit).

## Task L5: Angular login (branch `feat/local-auth`)

**Files:** Rewrite `src/app/services/auth.service.ts`, `src/app/components/auth/sign-in.component.ts`; Rename `src/app/interceptors/clerk-auth.interceptor.ts` → `auth.interceptor.ts`; Modify `src/app/app.config.ts`, `src/index.html`, both environment files.

- [ ] `auth.service.ts` (full rewrite): signals `ready` (true after `init()` restores the token), `isSignedIn`, `user`; `init()` reads `localStorage['retirement.auth.token']` + stored user JSON, drops it when `exp` (decoded from the JWT payload, base64url) is past; `login(username, password)` POSTs `${environment.apiBaseUrl}/auth/login`, stores token + user, sets signals; `signOut()` clears storage + signals; `getToken()` returns the stored token or null.
- [ ] Interceptor: attach `Authorization: Bearer` when a token exists; on 401 from the API (outside `/auth/login`), call `signOut()` so the shell falls back to the login screen.
- [ ] `sign-in.component.ts`: house-style card — "Sign in" heading, labeled username + password inputs (`autocomplete="username"` / `"current-password"`), submit button with pending state, one generic error line rendered from the service; no Clerk mount.
- [ ] `app.config.ts`: keep `provideAppInitializer(() => inject(AuthService).init())` (now synchronous restore); register the renamed interceptor. `index.html`: remove both Clerk CDN `<script>` tags. Environments: delete `clerkPublishableKey`.
- [ ] The uncommitted dev-review stub in `auth.service.ts` disappears with the rewrite.
- [ ] Tests: `auth.service.spec.ts` — restore-from-storage, expired-token drop, login stores + signals flip, signOut clears. Full `npx vitest run` + `npm run build` green. Commit `feat(auth): local username/password login replaces Clerk`.

## Task L6: End-to-end + wrap-up

- [ ] Restart dev API (env changed), reload preview, log in as `justice` in the real UI, confirm dashboard loads authenticated data (no dev bypass involved: token present → bypass skipped).
- [ ] Full verification: API `npm test`/`typecheck`, Angular suite + build, fresh evidence.
- [ ] Update memory; report. Merging/pushing on user instruction.
