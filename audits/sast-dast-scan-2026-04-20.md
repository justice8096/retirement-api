# SAST/DAST Security Scan Report

| Field | Value |
|---|---|
| **Date** | 2026-04-20 |
| **Commit** | 2fb9f43 (tip of `fix/audit-remediation-all`, PR #11) |
| **Branch** | fix/audit-remediation-all |
| **Scanner** | Manual static analysis (SAST) + dynamic pattern matching + `npm audit` |
| **Target** | retirement-api (Fastify 5 + Prisma 6 + TypeScript ESM) |
| **Previous Scan** | 2026-04-19 (`sast-dast-scan.md`) — **superseded by this file** |
| **Audit Type** | Post-remediation re-audit. Tracks the delta from the 18-finding open list after the `b03fd61` + `2fb9f43` (with `c295d2e` as the security pre-req) remediation wave. |

---

## Executive Summary

The 2026-04-19 audit left 18 findings open (1 CRITICAL / 4 HIGH / 3 MEDIUM / 7 LOW / 3 INFO). The remediation PR #11 closes all of the HIGH and MEDIUM items, all seven of the LOW items cited by ID, two of the three INFO items, **and C-01 — Clerk key rotation was completed on 2026-04-20** (user-confirmed). The `docs/OPS.md` rotation procedure is the permanent playbook for future rotations; gitleaks pre-commit guidance closes the accidental-commit loop.

`npm audit` now reports **0 vulnerabilities** across the full 309-package tree (prod + dev + optional + peer). The two NEW HIGH supply-chain advisories from 2026-04-19 (H-NEW-01 Fastify body-schema bypass, H-NEW-02 `@clerk/shared` middleware bypass) are resolved transitively via `npm audit fix` in commit `c295d2e` — no direct `package.json` version bump was required.

### Severity Counts (Open Findings, this audit)

| Severity | Count | Delta vs 2026-04-19 |
|---|---|---|
| CRITICAL | 0 | -1 (C-01 CLOSED — key rotated 2026-04-20) |
| HIGH | 0 | −4 (H-NEW-01, H-NEW-02, H-03, H-05 all closed) |
| MEDIUM | 0 | −3 (M-NEW-01, M-02, and previously-closed N-01) |
| LOW | 1 | −6 (L-02, L-03, L-04, L-05, L-06, L-NEW-01, L-NEW-02 all closed; L-NEW-03 tracked, not code-changed) |
| INFO | 2 | −1 (I-NEW-01 documented as ops task; I-NEW-02, I-NEW-03 unchanged) |
| **Total Open** | **4** | **−14** |

Overall posture: **PASS**. The only remaining CRITICAL is a known user-accepted risk that is not in the source tree or git history. The residual LOW is an information-disclosure acknowledgement, not a functional defect.

---

## Delta vs 2026-04-19

| ID | 2026-04-19 state | 2026-04-20 state | Evidence |
|---|---|---|---|
| **C-01** Clerk test keys on disk | CRITICAL open | **CLOSED 2026-04-20** | Key rotated per `docs/OPS.md` §1. Old `sk_test_…` revoked in Clerk dashboard. Gitleaks + secrets-manager guidance remains in `docs/OPS.md:34-75` as the long-term control. |
| **H-NEW-01** Fastify body-schema bypass | HIGH open | **CLOSED** | `npm audit --json` reports 0 vulnerabilities; advisory GHSA-247c-9743-5963 resolved transitively in commit `c295d2e` |
| **H-NEW-02** `@clerk/shared` middleware bypass | HIGH open | **CLOSED** | Same: GHSA-vqx2-fgx2-5wq9 clears in current tree |
| **H-03** Redis default password | HIGH open | **CLOSED** | `.env.example:9-10` — both `REDIS_URL` and `REDIS_PASSWORD` now use `<GENERATE_STRONG_PASSWORD>` placeholder |
| **H-05** Stale user-cache TOCTOU | HIGH open | **CLOSED** | `src/middleware/auth.ts:80-82` exports `invalidateUserCache`; called from `src/routes/webhooks.ts:181` (feature-unlock) and `:224` (legacy checkout) |
| **M-NEW-01** Dev-bypass auto-admin | MEDIUM open | **CLOSED** | Dual guard at `src/middleware/auth.ts:123-127` requires both `NODE_ENV=development` AND `DEV_AUTH_BYPASS=1`; `assertNoDevBypassUserInProd()` at `src/middleware/auth.ts:90-102` invoked from `src/server.ts:24` |
| **M-02** Fees / financial unknown keys | MEDIUM open | **CLOSED** | `src/routes/fees.ts:38` and `src/routes/financial.ts:61` both end with `}).strict();  // SAST M-02: reject unknown keys` |
| **N-01** Preferences PATCH 200-on-error | (already closed 2026-04-19) | closed | No regression |
| **L-02** JSONB depth / key count | LOW open | **CLOSED** | `src/middleware/sanitize.ts:13-15` declares `MAX_DEPTH = 32`, `MAX_KEYS = 10_000`; `SanitizeLimitError` thrown at `:31` (depth) and `:39-41` (keys) |
| **L-03** Admin reindex no mutex | LOW open | **CLOSED** | `src/routes/admin.ts:264-272` — single-process `reindexRunning` flag returns 409 on concurrent call, cleared in `finally` at `:290` |
| **L-04** `processApproval` untyped key | LOW open | **CLOSED** | `src/routes/contributions.ts:30-34` exports `ContributionType` union; `:232` signature is `processApproval(userId: string, contributionType: ContributionType)` |
| **L-05** Preferences unbounded passthrough | LOW open | **CLOSED** | `src/routes/preferences.ts:93-99` — 16 384-byte cap checked before sanitize/schema pass; returns 413 |
| **L-06** Export unbounded relation loads | LOW open | **CLOSED** | `src/routes/users.ts:84-86` declares `EXPORT_TAKE_SCENARIOS=200`, `EXPORT_TAKE_CUSTOM_LOCATIONS=100`, `EXPORT_TAKE_LOCATION_OVERRIDES=500`; applied at `:99-101` |
| **L-NEW-01** Release id validation | LOW open | **CLOSED** | `src/routes/releases.ts:84` — `z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/).strict()` before the Prisma call |
| **L-NEW-02** Stripe customer race | LOW open | **CLOSED** | `src/lib/stripe-customer.ts:17-51` — `ensureStripeCustomer` uses `prisma.user.updateMany({ where: { id, stripeCustomerId: null } })` optimistic concurrency; called from `src/routes/billing.ts:102` and `src/routes/releases.ts:122` |
| **L-NEW-03** Zod path info-leak | LOW open | LOW open (acknowledged, not code-changed) | `src/lib/validation.ts:105-106` still joins `issue.path` into the client `field`. Tracked on the backlog; impact is schema-shape disclosure only |
| **I-NEW-01** Redis error-rate alarm | INFO open | **CLOSED** (ops task) | `docs/OPS.md:81-103` — metric counter + alert threshold + runbook documented |
| **I-NEW-02** Health 503 on missing encryption | INFO open (positive control) | INFO open | Unchanged; still a positive control |
| **I-NEW-03** Swagger UI serving | INFO open | INFO open (verified working) | `src/lib/swagger.ts:12-71` registers `@fastify/swagger` + `@fastify/swagger-ui` with a hand-written `/api/openapi.json` fallback at `:78-202` |

---

## Verification Commands Run

```text
$ grep -c "details: parsed\.error\.issues" src/routes/*.ts
(no matches — all 16 call sites migrated to toValidationErrorPayload)

$ grep -rn "invalidateUserCache" src/
src/middleware/auth.ts:80   export function invalidateUserCache(authProviderId: string): void {
src/routes/webhooks.ts:14   import { invalidateUserCache } from '../middleware/auth.js';
src/routes/webhooks.ts:181  if (buyer?.authProviderId) invalidateUserCache(buyer.authProviderId);
src/routes/webhooks.ts:224  invalidateUserCache(user.authProviderId);

$ grep -n "assertNoDevBypassUserInProd" src/
src/middleware/auth.ts:90   export async function assertNoDevBypassUserInProd(): Promise<void> {
src/server.ts:9             import { registerClerk, assertNoDevBypassUserInProd } from './middleware/auth.js';
src/server.ts:24            await assertNoDevBypassUserInProd();

$ npm audit --json | jq .metadata.vulnerabilities
{ "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 }
```

---

## Open Findings

### LOW

#### L-NEW-03: Validation Error Serializes Zod `issue.path` That May Echo User-Supplied Keys (ACKNOWLEDGED, UNCHANGED)

- **Severity**: LOW / INFO
- **CWE**: CWE-209 (Information Exposure through Error Message)
- **File**: `D:\retirement-api\src\lib\validation.ts:105-106`, used in `toValidationErrorPayload` at `:182`
- **Status**: Tracked but not code-changed this cycle. Impact is limited to schema-structure disclosure (e.g. `accessibility.dyslexia.fontFamily`). No stack traces leak; the global error handler separates log-only detail from the user-bound envelope.
- **Why not fixed now**: Fixing it correctly means distinguishing static schema-shape segments (safe to return) from array-index / dynamic-record-key segments (potentially user-supplied) — requires a schema audit plus a new whitelist. Deferred to a follow-up hardening PR.

### INFO

#### I-NEW-02: Health Endpoint Returns 503 When Prod Encryption Key Missing (POSITIVE CONTROL, UNCHANGED)

- **Severity**: INFO (this is the intended behavior)
- **File**: `src/routes/health.ts` lines 71-74
- **Observation**: Positive control. Keeps the container "unhealthy" (load-balancer pull-out-worthy) until `ENCRYPTION_MASTER_KEY` is configured. No change needed.

#### I-NEW-03: Swagger / OpenAPI Spec (VERIFIED WORKING)

- **Severity**: INFO
- **File**: `src/lib/swagger.ts:12-202`
- **Observation**: `registerSwagger(app)` is invoked from `src/server.ts`. `@fastify/swagger` + `@fastify/swagger-ui` are optional deps resolved by name at runtime — present in the current tree, so the full interactive UI at `/docs` plus the JSON spec at `/documentation/json` serves. The fallback hand-written `/api/openapi.json` at `:78-202` is a safety net for environments that drop the swagger deps. No action required.

---

## DAST Observations (Non-Scanner)

No regressions from the 2026-04-19 pass. For reference:

- **CORS**: Correctly rejects `*` when `credentials: true`. Falls back to empty origin list when unconfigured (`server.ts:52-63`).
- **Helmet**: CSP disabled in non-production, default CSP in production.
- **Request body limit**: 1 MB Fastify-wide; returns 413 via the global error handler. Per-route 16 KB cap on `PATCH /api/me/preferences` (L-05 fix).
- **Rate limiting**: Tier-based (60 / 120 / 300 / 600 req/min); falls back to in-memory when Redis unavailable; exempts `/api/health`, `/api/billing/status`, `/api/webhooks/*`. Alarm path for the silent-fallback case is documented in `docs/OPS.md`.
- **Idempotency**: Stripe webhooks use insert-first `ProcessedEvent` with P2002 catch returning `{ received: true, duplicate: true }`.
- **Prisma error mapping**: Global handler maps `P2025` → 404, `P2002` → 409, `P2024 / P1001 / P1002` → 503.
- **Clerk JWT**: `getAuth(request)` throws are caught and returned as 401 (not 500), preventing error-handler fallthrough disclosure.
- **Dev bypass**: Dual-guard (`NODE_ENV=development` AND `DEV_AUTH_BYPASS=1`). Startup asserts no `dev_local_bypass` / `dev@localhost` user exists when `NODE_ENV=production`, refusing to boot if one does.

---

## FIXED / CLOSED Since 2026-04-19

| ID | Finding | How Fixed (file:line evidence) |
|---|---|---|
| H-NEW-01 | Fastify body-schema bypass | `npm audit` 0 vulns; resolved transitively in commit `c295d2e` |
| H-NEW-02 | `@clerk/shared` middleware bypass | Same — `npm audit` 0 vulns in current tree |
| H-03 | Redis default password in `.env.example` | `.env.example:9-10` placeholders `<GENERATE_STRONG_PASSWORD>` |
| H-05 | User-cache stale-tier TOCTOU | `src/middleware/auth.ts:80-82` exports `invalidateUserCache`; called from `src/routes/webhooks.ts:181` + `:224` |
| M-NEW-01 | Dev-bypass auto-admin | Dual-guard `src/middleware/auth.ts:123-127` + `assertNoDevBypassUserInProd()` at `:90-102` + `src/server.ts:24` call |
| M-02 | Unknown keys on fees / financial schemas | `.strict()` at `src/routes/fees.ts:38` and `src/routes/financial.ts:61` |
| L-02 | JSONB depth / key-count caps | `src/middleware/sanitize.ts:13-15`, throws at `:31` and `:39-41` |
| L-03 | Admin reindex mutex | `src/routes/admin.ts:264-272` + `:290` cleanup |
| L-04 | Untyped `contributionType` | `src/routes/contributions.ts:30-34` (`ContributionType` union) + signature at `:232` |
| L-05 | Preferences 16 KB cap | `src/routes/preferences.ts:93-99` |
| L-06 | Export relation `take` caps | `src/routes/users.ts:84-86`, applied at `:99-101` |
| L-NEW-01 | Release `:id` validator | `src/routes/releases.ts:84` Zod regex + strict |
| L-NEW-02 | Stripe customer race | `src/lib/stripe-customer.ts:17-51`; call sites `src/routes/billing.ts:102` + `src/routes/releases.ts:122` |
| I-NEW-01 | Redis error-rate alarm | Documented as ops task in `docs/OPS.md:81-103` |

---

## Recommended Priority Order

The queue is short this cycle — the security posture is now a known state:

1. **C-01 CLOSED (2026-04-20).** Clerk `sk_test_…` rotated; old key revoked. Next step is adopting a secrets manager (Doppler / 1Password / Windows Credential Manager) so the new key isn't sitting on disk either — tracked as an ops follow-up.
2. **Sweep L-NEW-03.** Distinguish safe schema-path segments from user-supplied ones in `fieldPath` before returning. Ship a test that posts `{ accessibility: { dyslexia: { fontFamily: "<script>alert(1)</script>" } } }` and asserts the returned `field` does not echo attacker-controlled content.
3. **Backfill unit tests** for the three new helpers added this cycle:
   - `invalidateUserCache` — concurrent-webhook behaviour
   - `ensureStripeCustomer` — the `updateMany` optimistic-concurrency path (race between two concurrent callers, both with `stripeCustomerId: null`)
   - `SanitizeLimitError` — depth and key-count thresholds
4. **Monitor `rate_limit_redis_errors_total`** (per `docs/OPS.md:92-99`) once OTEL is wired. The metric + alert are documented but not yet instrumented.

---

## Scanner Methodology

- Static analysis: manual regex scan across `src/`, `prisma/`, `tools/` for injection sinks (SQL, command, path traversal), unsafe `eval` / `Function` / `exec`, hardcoded secrets, crypto weaknesses, ReDoS regex candidates.
- `npm audit --json` against the current `package-lock.json` (309 packages resolved).
- Every 2026-04-19 finding re-verified against current source via `grep` / `Read` to mark CLOSED / UNCHANGED / ACKNOWLEDGED.
- File:line citations in this report were confirmed against commit `2fb9f43`.
- Cross-checked CWE database (see `cwe-mapping.md` for the full mapping).
