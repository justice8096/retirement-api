# SAST/DAST Security Scan Report

| Field | Value |
|---|---|
| **Date** | 2026-04-19 |
| **Commit** | 80e2e91 |
| **Branch** | cleanup/seed-data-integrity-path |
| **Scanner** | Manual static analysis (SAST) + dynamic pattern matching + `npm audit` |
| **Target** | retirement-api (Fastify 5 + Prisma 6 + TypeScript ESM) |
| **Previous Scan** | 2026-04-16 |
| **Audit Type** | Post-commit re-audit (tracks deltas since 2026-04-16) |

---

## Executive Summary

Since the 2026-04-16 audit, the codebase has grown by ~30 commits spanning ACA cliff-regime modeling, Mid-Atlantic and US-territory location seed data, the new `/api/me/fees` route, per-account load/fees columns, accessibility API surface work, and rate-limit middleware tests. No pre-existing CRITICAL or HIGH findings from 2026-04-16 that remain open have regressed, but **three new HIGH supply-chain advisories surfaced** (Fastify body-schema bypass, Clerk auth bypass, Vite transitive dev-only advisories) which did not exist at the last audit date.

### Severity Counts (Open Findings, this audit)

| Severity | Count | Delta vs 2026-04-16 |
|---|---|---|
| CRITICAL | 1 | 0 (same C-01 Clerk key on disk) |
| HIGH | 4 | +2 (Fastify body-schema, Clerk SDK advisory; H-05 unchanged; H-03 partial unchanged) |
| MEDIUM | 3 | +1 (dev bypass user auto-creation) |
| LOW | 7 | +1 (new fees route has no input rejection pattern) |
| INFO | 3 | +1 |
| **Total Open** | **18** | **+5** |

Overall posture: **CONDITIONAL PASS**. The one CRITICAL is known and accepted (Clerk test key on disk, not in git). The two new HIGH supply-chain items have upstream fixes available via `npm audit fix`.

---

## CRITICAL Findings

### C-01: Clerk API Test Keys Present on Disk in `.env` (UNCHANGED)

- **Severity**: CRITICAL (risk-accepted by user)
- **CWE**: CWE-798 (Use of Hard-Coded Credentials)
- **File**: `D:\retirement-api\.env` (not committed — in `.gitignore`)
- **Status**: Same as 2026-04-16 audit. The `.env` file still contains `sk_test_...` and `pk_test_...` Clerk test keys. Not present in git history (verified `git log --all -p -- .env`).
- **Remediation** (unchanged):
  1. Rotate the exposed `sk_test_...` key in the Clerk dashboard.
  2. Adopt a secrets manager (Doppler, 1Password CLI, Windows Credential Manager).
  3. Add a pre-commit hook (gitleaks, trufflehog).

---

## HIGH Findings

### H-NEW-01: Fastify 5.3.2–5.8.4 Body Schema Validation Bypass (NEW)

- **Severity**: HIGH (CVSS 7.5)
- **CWE**: CWE-1287 (Improper Validation of Specified Type of Input)
- **Advisory**: GHSA-247c-9743-5963
- **File**: `package-lock.json` — `fastify` ^5.0.0 resolved to a vulnerable minor
- **Code**: direct dependency `"fastify": "^5.0.0"` in `package.json`
- **Impact**: Leading-space `Content-Type` header can bypass body schema validation, letting malformed JSON reach handlers. Given this API has strict Zod schemas at every route (`safeParse`), the downstream impact is limited — but prototype-pollution and type-coercion regressions become possible for any route that trusts Fastify's pre-validation.
- **Remediation**: `npm audit fix` — patched version is available. Pin `fastify` to `~5.8.5` or later once installed.

### H-NEW-02: `@clerk/shared` Middleware Route Protection Bypass (NEW)

- **Severity**: CRITICAL per advisory, filed as HIGH here given the keys are test-mode (CVSS 9.1)
- **CWE**: CWE-436, CWE-863
- **Advisory**: GHSA-vqx2-fgx2-5wq9 (range `>=4.0.0 <4.8.1`)
- **File**: `package-lock.json` — transitive via `@clerk/fastify`
- **Impact**: In vulnerable versions, middleware-based route protection can be bypassed when certain headers/paths are crafted. This API uses `requireAuth` (a `preHandler`), not Clerk middleware directly, which partially mitigates. However, `clerkPlugin` is registered globally and the JWT validation path flows through `@clerk/shared`.
- **Remediation**: `npm audit fix` (upstream fix available). Verify `@clerk/shared` ≥ 4.8.1 after upgrade.

### H-03: Default Redis Password in `.env.example` (PARTIALLY FIXED — unchanged since 2026-04-16)

- **Severity**: HIGH
- **CWE**: CWE-1393 (Use of Default Credentials)
- **File**: `D:\retirement-api\.env.example` lines 8-9
- **Current Content**:
  ```
  REDIS_URL=redis://:changeme@localhost:6379
  REDIS_PASSWORD=changeme
  ```
- **Status**: No change since 2026-04-16. Postgres line was fixed to use a placeholder, but Redis lines still ship `changeme` as default.
- **Remediation**:
  ```
  REDIS_URL=redis://:<GENERATE_STRONG_PASSWORD>@localhost:6379
  REDIS_PASSWORD=<GENERATE_STRONG_PASSWORD>
  ```

### H-05: User Cache Race Condition — Stale Tier After Upgrade (UNCHANGED)

- **Severity**: HIGH
- **CWE**: CWE-367 (TOCTOU Race Condition)
- **File**: `D:\retirement-api\src\middleware\auth.ts` lines 50-69
- **Code**: 10s in-memory `userCache`, no invalidation on tier change.
- **Status**: Unchanged since 2026-04-16. No `invalidateUserCache()` export or webhook hook added.
- **Impact**: In a multi-replica deployment, a downgraded user retains elevated tier for up to 10s per replica. Combined with rate-limit config in `rate-limit.ts` that reads `request.user?.tier`, a downgraded admin could still hit the 600 req/min admin limit briefly.
- **Remediation**:
  1. Export `invalidateUserCache(authProviderId)` from `auth.ts` and invoke from webhook tier-change paths.
  2. For multi-replica deployments, use Redis pub/sub for cache invalidation.

---

## MEDIUM Findings

### M-NEW-01: Dev Bypass Auto-Creates Admin User (NEW)

- **Severity**: MEDIUM
- **CWE**: CWE-489 (Active Debug Code), CWE-250 (Execution with Unnecessary Privileges)
- **File**: `D:\retirement-api\src\middleware\auth.ts` lines 86-110
- **Code**:
  ```typescript
  if (process.env.NODE_ENV === 'development' && !request.headers.authorization) {
    let devUser = await prisma.user.findFirst({ where: { email: 'dev@localhost' } });
    if (!devUser) {
      devUser = await prisma.user.create({
        data: { authProviderId: 'dev_local_bypass', email: 'dev@localhost',
                displayName: 'Dev User', tier: 'admin' },
      });
    }
    request.user = devUser;
    request.userId = devUser.id;
    ...
  }
  ```
- **Impact**: If `NODE_ENV` is ever misconfigured (left as `development` in staging, a container misread, a Docker ENV override missing), every unauthenticated request is treated as an admin. Creates full-admin users silently. The branch does a safe fall-through to Clerk on DB errors but the success path yields `tier: 'admin'`.
- **Remediation**:
  1. Add a secondary guard — require an explicit `DEV_AUTH_BYPASS=1` env var in addition to `NODE_ENV=development`.
  2. Log a WARN-level message on every dev-bypass hit (not just on user creation).
  3. On application startup, refuse to boot if `NODE_ENV=production` *and* the `dev_local_bypass` user already exists in the DB.

### N-01: Preferences PATCH Still Returns 200 on Validation Error (CARRIED OVER, UNCHANGED)

- **Severity**: MEDIUM
- **CWE**: CWE-703 (Improper Check or Handling of Exceptional Conditions)
- **File**: `D:\retirement-api\src\routes\preferences.ts` — the PATCH handler now *does* send a 400 via `toValidationErrorPayload` on line 88-89 and line 93-94. Re-verification shows this is actually **FIXED** since the previous audit (two `reply.code(400)` branches present).
- **Status**: **FIXED** on re-read. Downgrade to INFO and remove from action items.

### M-02: Fees Route Accepts Any Numeric Field Without `.strict()` (NEW)

- **Severity**: MEDIUM
- **CWE**: CWE-20 (Improper Input Validation)
- **File**: `D:\retirement-api\src\routes\fees.ts` line 17-37
- **Code**: `feesSchema = z.object({ ... })` — no `.strict()` call; unknown keys silently pass through.
- **Impact**: Clients can inject arbitrary properties into the body. Since only the allowlisted `NUMERIC_FIELDS` are converted, extra fields are dropped by Prisma (no matching column) — but the pattern is inconsistent with `financialSchema` which also lacks `.strict()` here (financial PUT also doesn't use `.strict()`). A future migration adding a column could accidentally expose it.
- **Remediation**: Add `.strict()` to `feesSchema` and `financialSchema`. Add a test that posts `{ foo: 'bar' }` and expects a 400.

---

## LOW Findings

### L-02: No Input Size Limit on JSONB (UNCHANGED)

- **Severity**: LOW
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)
- **File**: `D:\retirement-api\src\middleware\sanitize.ts` lines 15-26
- **Status**: Unchanged. `stripDangerousKeys` has no depth or key-count cap. Body limit of 1 MB in `server.ts` is the only backstop.
- **Remediation**: Add a 32-level depth cap and 10 000-key cap.

### L-03: Admin Reindex Endpoint Has No Mutex (UNCHANGED)

- **Severity**: LOW
- **CWE**: CWE-400
- **File**: `D:\retirement-api\src\routes\admin.ts` lines 249-265
- **Status**: Unchanged — sequential per-row updates, no batching, no concurrent-call guard.

### L-04: `processApproval` Uses Untyped String Key (UNCHANGED)

- **Severity**: LOW
- **CWE**: CWE-20
- **File**: `D:\retirement-api\src\routes\contributions.ts` line 214
- **Status**: Unchanged — still `contributionType: string`.

### L-05: Preferences Shallow Merge Without Key Allowlist (UNCHANGED)

- **Severity**: LOW
- **CWE**: CWE-915
- **File**: `D:\retirement-api\src\routes\preferences.ts` — **partially mitigated** by the new `accessibilityPrefsSchema` block (lines 50-55) validating known sub-keys. However, `preferencesPatchSchema` still uses `.passthrough()`, so unknown top-level keys are preserved.
- **Remediation**: Progress made. Consider final step of closing off `.passthrough()` behind a size cap.

### L-06: Export Endpoint Unbounded Relation Load (UNCHANGED)

- **Severity**: LOW
- **CWE**: CWE-400
- **File**: `D:\retirement-api\src\routes\users.ts` lines 68-112
- **Status**: Unchanged — single query loads all household members, pets, scenarios, custom locations, overrides, grocery data in one `include`. No pagination, no cursor. Fine for normal users (20-scenario cap, 20-custom-location cap) but large if a user fills every cap simultaneously.

### L-NEW-01: `/api/releases/:id/checkout` Does Not Validate `id` Format (NEW)

- **Severity**: LOW
- **CWE**: CWE-20
- **File**: `D:\retirement-api\src\routes\releases.ts` line 69-78
- **Impact**: `const { id } = request.params as { id: string };` then `prisma.dataRelease.findUnique({ where: { id } })`. Prisma parameterizes, so no SQL injection, but any string is accepted. A malicious client can send a 2 KB junk id.
- **Remediation**: Add a UUID-shape Zod validator on the param.

### L-NEW-02: Release Checkout Re-Uses Stripe Customer Created in Parallel (NEW, race-condition edge case)

- **Severity**: LOW
- **CWE**: CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)
- **File**: `D:\retirement-api\src\routes\releases.ts` lines 107-118 and `D:\retirement-api\src\routes\billing.ts` lines 100-111
- **Impact**: If a user hits `/checkout-feature` and `/releases/:id/checkout` in parallel with no existing `stripeCustomerId`, both create separate Stripe customers and the second `user.update` overwrites the first. The earlier Stripe customer becomes orphaned (not fatal, but duplicate billing records).
- **Remediation**: Extract Stripe customer creation to a shared helper that uses `prisma.user.update({ where: { id, stripeCustomerId: null } })` with an optimistic-concurrency guard and falls back to reading the row on constraint failure.

### L-NEW-03: Validation Error Serializes Zod `issue.path` That May Include User-Supplied Data (NEW)

- **Severity**: LOW / INFO
- **CWE**: CWE-209 (Information Exposure through Error Message)
- **File**: `D:\retirement-api\src\lib\validation.ts` lines 82-86
- **Impact**: `fieldPath(issue)` concatenates all path segments, some of which may be array indices or dynamic keys (e.g. nested preference blobs). The resulting `field` returned to the client is `"accessibility.dyslexia.fontFamily"` etc. — information about schema structure. Low impact, but the stack trace no longer leaks (good).

---

## INFO Findings

### I-NEW-01: Rate-Limit Redis Build Retries 3× Then Silently Uses In-Memory (UNCHANGED)

- **Severity**: INFO
- **File**: `src/middleware/rate-limit.ts` lines 47-86
- **Observation**: Documented fallback behavior. Operationally correct; just calling out that a partially-working Redis cluster (PING works, then degrades) will flip per-replica caches out of sync silently. Metric alarm on the connection-error rate is recommended.

### I-NEW-02: Health Endpoint Returns `503` When Prod Encryption Is Disabled (UNCHANGED)

- **Severity**: INFO (this is correct behavior, positive control)
- **File**: `src/routes/health.ts` lines 71-74
- **Observation**: Positive control. Keeps the app "unhealthy" (and load-balancer pull-out-worthy) until the encryption key is configured.

### I-NEW-03: No OpenAPI/Swagger Spec Served Statically (PARTIAL — `src/lib/swagger.ts` exists)

- **Severity**: INFO
- **File**: `src/lib/swagger.ts`
- **Observation**: `registerSwagger(app)` is called in `server.ts`. The implementation should be double-checked to confirm the UI and JSON spec are served correctly in non-production environments.

---

## FIXED / CLOSED Since 2026-04-16

| ID | Finding | How Fixed |
|---|---|---|
| N-01 | Preferences PATCH returned 200 on invalid body | Now returns `reply.code(400).send(toValidationErrorPayload(...))` on both validation steps |
| Transient | Dyslexia/dyscalculia accessibility sub-schemas | Validated with explicit Zod schemas in `preferences.ts` |
| Transient | Accept-Language handling | Added in `server.ts` onRequest hook |

---

## DAST Observations (Non-Scanner)

- **CORS**: Correctly rejects `*` when `credentials: true`. If no origins are configured, falls back to empty (no CORS passes). `server.ts` lines 52-63.
- **Helmet**: CSP is disabled in non-production. Production default is used. OK.
- **Request body limit**: 1 MB hard cap via `bodyLimit` in `Fastify()`. Returns `413` via the error handler.
- **Rate limiting**: Tier-based (60/120/300/600 req/min), falls back to in-memory when Redis unavailable, exempts `/api/health`, `/api/billing/status`, `/api/webhooks/*`.
- **Idempotency**: Stripe webhook uses insert-first `ProcessedEvent` pattern, catches `P2002`, returns `{ received: true, duplicate: true }`.
- **Prisma error mapping**: Global error handler maps `P2025` → 404, `P2002` → 409, `P2024/P1001/P1002` → 503.
- **Signed tokens**: Clerk JWT verification via `getAuth(request)` — throws are caught and returned as 401 (not 500).

---

## Recommended Priority Order

1. **Run `npm audit fix` immediately** — resolves H-NEW-01 (Fastify) and H-NEW-02 (Clerk/@clerk/shared) with upstream patches.
2. **Add `DEV_AUTH_BYPASS=1` guard** to `auth.ts` dev-bypass block (M-NEW-01).
3. **Export `invalidateUserCache(authProviderId)`** and call from webhook handlers (H-05).
4. **Fix Redis default password in `.env.example`** (H-03).
5. **Add `.strict()` to `feesSchema` and `financialSchema`** (M-02).
6. Low-priority items (L-02, L-03, L-04, L-06, L-NEW-01, L-NEW-02) can be batched into a single hardening PR.

---

## Scanner Methodology

- Static analysis: manual regex scan across `src/`, `prisma/`, `tools/` for injection sinks (SQL, command, path traversal), unsafe `eval`/`Function`/`exec`, hardcoded secrets, crypto weaknesses, ReDoS regex candidates.
- `npm audit --json` against current `package-lock.json` (transitive tree resolved).
- Compared every finding from 2026-04-16 against current source to mark RESOLVED / REMAINING / REGRESSED.
- Cross-checked each finding against CWE database (see `cwe-mapping.md` for full mapping).
