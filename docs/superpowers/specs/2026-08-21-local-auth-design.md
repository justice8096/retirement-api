# Local username/password auth (Clerk removal) — design

Date: 2026-08-21. Status: approved by the user in-session ("proceed"), with
three decisions taken interactively: (1) no self-registration — users are
added via a CLI that Claude runs on request; initial accounts `justice` and
`jackie` (bootstrap passwords supplied in-session — rotate after first
login); (2) self-issued JWT bearer tokens; (3) Clerk replaced outright (prod
only ever shipped a `pk_test_` key, so nothing live migrates).

## Why

Clerk's dev-instance handshake 307s broke non-browser clients (see the
2026-04-29 uptime-kuma incident and the PR #85 Accept-header workaround),
production was never moved off `pk_test_`, and a two-person self-hosted app
doesn't need a hosted IdP. Removing Clerk deletes the whole workaround class.

## Data model

`User` gains `username String? @unique` and `passwordHash String?`
(nullable — existing rows keep working). `authProviderId` is retained;
locally-created users get `local:<username>`. All domain data (household,
financial, scenarios, Stripe billing, tiers) hangs off `User.id` — untouched.
The CLI attaches by email when a matching row exists, so existing data is
preserved rather than duplicated.

## API

- **`POST /api/auth/login`** `{username, password}` → `{token, expiresAt,
  user: {displayName, username, tier}}`. Any failure → 401 with one generic
  plain-language message ("That username or password didn't match.") — no
  user enumeration. Strict per-IP rate limit.
- **`GET /api/auth/me`** (JWT) → current user echo for app boot.
- **Passwords**: Node built-in `scrypt` (N=2^15, r=8, p=1), PHC-style
  encoded string, `timingSafeEqual` compare. No new crypto deps.
- **Tokens**: `fast-jwt` HS256; secret `AUTH_JWT_SECRET` (env, required in
  production — startup assert like the encryption key); TTL
  `AUTH_TOKEN_TTL_DAYS` default 30. Claims: `sub` (user id), `username`,
  `tier`. Revocation = rotate the secret (accepted trade-off).
- **`requireAuth`**: verify Bearer JWT → load user by `sub` via the existing
  in-memory cache (rekeyed by user id). `DEV_AUTH_BYPASS` +
  `assertNoDevBypassUserInProd` retained. Deleted: `clerkPlugin`,
  `getAuth`, `fetchClerkUser`, `registerClerk`, the public-paths
  Accept-normalization hook, `@clerk/fastify` dependency.
- **CLI** `tools/manage-users.mjs`: `add <username> --email <e>`,
  `set-password <username>`, `list`. Password via `--password` or `PASSWORD`
  env. Claude runs it on request — that IS the user-management surface.

## Angular

- `auth.service`: `login()`, `signOut()`, token in
  `localStorage['retirement.auth.token']`, `isSignedIn` derived from token
  presence + `exp` decode; `ready` immediately true (no SDK handshake).
- `clerk-auth.interceptor` → `auth.interceptor`: attach `Authorization:
  Bearer` when a token is held; on 401 response, sign out (drop token).
- `sign-in.component`: plain accessible username/password form in house
  style (labels, one generic error line, no jargon).
- Deleted: Clerk CDN scripts in `index.html`, `clerkPublishableKey` from
  both environments, the APP_INITIALIZER Clerk boot (replaced by token
  restore).

## Testing

API: passwords lib unit tests (round-trip, wrong password, tamper,
timing-safe path), auth route tests (success shape, generic 401, missing
fields 400, `/me`), requireAuth tests (valid/expired/garbage token, dev
bypass). Angular: auth.service spec (token store/expiry/signout), suite +
production build green. End-to-end: live login as `justice` through the
preview against the dev API.

## Out of scope

Password reset flows (CLI covers it), refresh tokens, token revocation
lists, MFA, account lockout (rate limit only), multi-tenant registration.
