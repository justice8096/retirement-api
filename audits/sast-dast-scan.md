# SAST/DAST Security Scan Report (Re-Audit)

| Field | Value |
|---|---|
| **Date** | 2026-04-02 |
| **Commit** | 93a719f (post-fix) |
| **Branch** | expand-household-model |
| **Scanner** | Manual static analysis (SAST) + dynamic pattern matching |
| **Target** | retirement-api (Fastify 5 + Prisma 6 + TypeScript) |
| **Previous Scan** | 2026-04-02 (pre-fix, same commit baseline) |

---

## Remediation Status

| ID | Severity | Finding | Status | Notes |
|---|---|---|---|---|
| C-01 | CRITICAL | Clerk API keys in `.env` | **REMAINING** | Keys still present on disk (not in git) |
| C-02 | CRITICAL | Hardcoded DB password in `setup-backup-schedule.ps1` | **FIXED** | Password removed from script |
| H-01 | HIGH | `STRIPE_WEBHOOK_SECRET` non-null assertion | **FIXED** | Proper null check + 500 response |
| H-02 | HIGH | Path traversal in `serve.js` | **FIXED** | `startsWith(ROOT)` guard added |
| H-03 | HIGH | Default passwords in `.env.example` / `backup-db.sh` | **PARTIALLY FIXED** | Postgres fixed; Redis still uses `changeme` |
| H-04 | HIGH | Admin route param validation (PUT/DELETE) | **FIXED** | Zod schema validation added to both |
| H-05 | HIGH | User cache race condition | **REMAINING** | No cache invalidation on tier change |
| M-01 | MEDIUM | `Math.random()` for request IDs | **FIXED** | Uses `crypto.randomUUID()` |
| M-02 | MEDIUM | CORS origin validation | **FIXED** | Wildcard `*` rejected when `credentials: true` |
| M-03 | MEDIUM | Health endpoint info disclosure | **FIXED** | Restricted to admin users only |
| M-04 | MEDIUM | Household PUT returns 200 on error | **FIXED** | Now returns `reply.code(400)` |
| M-05 | MEDIUM | Releases auth flow guard | **FIXED** | Added `if (_reply.sent) return` check |
| M-06 | MEDIUM | Webhook idempotency race | **FIXED** | Insert-first with P2002 catch |
| M-07 | MEDIUM | Encryption silent degradation | **FIXED** | Throws on startup in production; health check added |
| L-01 | LOW | SQL injection regex blocks legitimate input | **FIXED** | SQL keyword blocklist removed |
| L-02 | LOW | No input size limit on JSONB | **REMAINING** | No depth/key limits in `stripDangerousKeys` |
| L-03 | LOW | Admin reindex no rate limit | **REMAINING** | No mutex or batching added |
| L-04 | LOW | Contribution type badge mapping | **REMAINING** | `processApproval` still uses untyped `string` |
| L-05 | LOW | Preferences shallow merge | **REMAINING** | No allowlist for preference keys |
| L-06 | LOW | Export endpoint timeout | **REMAINING** | Still loads all relations in one query |

### Summary

| | Fixed | Partially Fixed | Remaining | New |
|---|---|---|---|---|
| CRITICAL (2) | 1 | 0 | 1 | 0 |
| HIGH (5) | 3 | 1 | 1 | 0 |
| MEDIUM (7) | 6 | 0 | 0 | 1 |
| LOW (6) | 1 | 0 | 5 | 0 |
| **Total (20)** | **11** | **1** | **7** | **1** |

---

## Updated Severity Counts (Open Findings)

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 2 (1 remaining + 1 partially fixed) |
| MEDIUM | 1 (new) |
| LOW | 5 |
| **Total Open** | **9** |

---

## REMAINING Findings

### C-01: Clerk API Keys Still Present in `.env` on Disk (REMAINING)

- **Severity**: CRITICAL
- **CWE**: CWE-798 (Use of Hard-Coded Credentials)
- **File**: `D:\retirement-api\.env` lines 12-13
- **Code**:
  ```
  CLERK_SECRET_KEY=sk_test_VwOreFJ20Q1diuy2QWMesKPJEqnz9HdNpwP4lTSKUK
  CLERK_PUBLISHABLE_KEY=pk_test_bWludC1zbmFrZS0yMi5jbGVyay5hY2NvdW50cy5kZXYk
  ```
- **Status**: The `.env` file is in `.gitignore` and was never committed to git (verified via `git log --all -p -- .env`). However, the real Clerk test secret key is still present on disk. If the development machine is compromised, shared, or backed up without exclusions, the key leaks.
- **What Changed**: Nothing. The original finding recommended rotating the key and adopting a secrets manager. This has not been done.
- **Remediation** (unchanged):
  1. Rotate the exposed `sk_test_...` key in the Clerk dashboard immediately.
  2. Adopt a secrets manager (Doppler, 1Password CLI, Windows Credential Manager).
  3. Add a pre-commit hook (gitleaks, trufflehog) to prevent accidental commits.

### H-03: Default Redis Password in `.env.example` (PARTIALLY FIXED)

- **Severity**: HIGH
- **CWE**: CWE-1393 (Use of Default Credentials)
- **File**: `D:\retirement-api\.env.example` lines 8-9
- **Code**:
  ```
  REDIS_URL=redis://:changeme@localhost:6379
  REDIS_PASSWORD=changeme
  ```
- **What Changed**: The Postgres password was fixed — line 5 now uses `<GENERATE_STRONG_PASSWORD>` placeholder. The `backup-db.sh` script now uses `${PGPASSWORD:?PGPASSWORD environment variable must be set}` on lines 49, 52, and 70, correctly failing if unset. However, the Redis password in `.env.example` is still `changeme`.
- **Impact**: Developers copying `.env.example` will have a trivially guessable Redis password. While Redis is optional (falls back to in-memory), if enabled with this default password, rate limiting state and cached data could be accessed by an attacker on the local network.
- **Remediation**: Replace Redis default passwords with placeholders:
  ```
  REDIS_URL=redis://:<GENERATE_STRONG_PASSWORD>@localhost:6379
  REDIS_PASSWORD=<GENERATE_STRONG_PASSWORD>
  ```

### H-05: User Cache Race Condition — Stale Tier After Upgrade (REMAINING)

- **Severity**: HIGH
- **CWE**: CWE-367 (Time-of-Check Time-of-Use Race Condition)
- **File**: `D:\retirement-api\src\middleware\auth.ts` lines 21-22
- **Code**:
  ```typescript
  const USER_CACHE_TTL_MS = 10_000;
  const userCache = new Map<string, { user: User; expiresAt: number }>();
  ```
- **What Changed**: Nothing. The 10-second per-process cache is unchanged. No invalidation on webhook tier changes, no Redis-backed coordination for multi-replica deployments.
- **Impact**: A 10-second window exists where a downgraded user retains elevated permissions per replica. In multi-replica deployments, no coordination between caches.
- **Remediation** (unchanged):
  1. Export a `invalidateUserCache(authProviderId)` function and call it from the webhook handler after tier changes.
  2. For multi-replica deployments, use Redis pub/sub for cache invalidation.
  3. Alternatively, reduce TTL to 2-3 seconds for sensitive operations.

### L-02: No Input Size Limit on JSONB Fields (REMAINING)

- **Severity**: LOW
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)
- **File**: `D:\retirement-api\src\middleware\sanitize.ts` lines 15-26
- **What Changed**: Nothing. `stripDangerousKeys` still recursively processes objects with no depth or key-count limits. A 1MB deeply nested JSON payload could cause high CPU usage during recursive stripping.
- **Remediation** (unchanged): Add depth and key-count limits to `stripDangerousKeys`.

### L-03: Admin Reindex Endpoint Has No Rate Limiting or Progress Guard (REMAINING)

- **Severity**: LOW
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)
- **File**: `D:\retirement-api\src\routes\admin.ts` lines 248-264
- **What Changed**: Nothing. Sequential updates with no mutex, batching, or concurrent-call guard.
- **Remediation** (unchanged): Add a mutex/flag to prevent concurrent reindexing, and batch updates with `$transaction`.

### L-04: Contribution Type Badge Mapping Uses Unvalidated String Key (REMAINING)

- **Severity**: LOW
- **CWE**: CWE-20 (Improper Input Validation)
- **File**: `D:\retirement-api\src\routes\contributions.ts` line 214
- **What Changed**: Nothing. `processApproval` parameter is still `contributionType: string` rather than the enum type.
- **Remediation** (unchanged): Type the parameter as `ContributionType` (from the Zod enum) instead of `string`.

### L-05: Preferences PATCH Performs Shallow Merge Without Key Validation (REMAINING)

- **Severity**: LOW
- **CWE**: CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **File**: `D:\retirement-api\src\routes\preferences.ts` line 34
- **What Changed**: Nothing. Preferences blob accepts any keys after `safeJsonRecord` strips dangerous ones. No schema validation of actual preference keys/values.
- **Remediation** (unchanged): Define an allowlist of valid preference keys with their expected types.

### L-06: Export Endpoint May Timeout on Large User Data (REMAINING)

- **Severity**: LOW
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)
- **File**: `D:\retirement-api\src\routes\users.ts` lines 69-85
- **What Changed**: Nothing. Full `include` of all related records in a single query with no pagination or streaming.
- **Remediation** (unchanged): Consider streaming the response or setting a query timeout.

---

## NEW Findings

### N-01: Preferences PATCH Returns 200 with Error Body Instead of 400

- **Severity**: MEDIUM
- **CWE**: CWE-394 (Unexpected Status Code or Return Value)
- **File**: `D:\retirement-api\src\routes\preferences.ts` lines 26-28
- **Code**:
  ```typescript
  const parsed = preferencesSchema.safeParse(request.body);
  if (!parsed.success) {
    return { error: 'Validation failed', details: parsed.error.issues };
  }
  ```
- **Impact**: Same pattern as the original M-04 finding in `household.ts` (which was fixed). When preferences validation fails, the route returns an error object with HTTP 200 instead of 400. Clients checking status codes will not detect the validation failure and may assume the update succeeded. This is the exact same class of bug that was fixed in M-04 but was missed in this route.
- **Remediation**:
  ```typescript
  if (!parsed.success) {
    return _reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
  }
  ```

---

## Verified Fixes (Detail)

### C-02: Hardcoded DB Password in `setup-backup-schedule.ps1` — FIXED

The PowerShell script at `tools/setup-backup-schedule.ps1` line 22 now reads:
```powershell
-Argument "-l -c 'bash D:/retirement-api/tools/backup-db.sh >> D:/backups/retirement-db/backup.log 2>&1'" `
```
The `export PGPASSWORD=postgres` segment has been removed. The backup script itself now enforces `PGPASSWORD` via `${PGPASSWORD:?...}` (fail-if-unset syntax) on lines 49, 52, and 70, which is the correct approach.

### H-01: STRIPE_WEBHOOK_SECRET — FIXED

`src/routes/webhooks.ts` lines 38-42 now properly validates:
```typescript
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  request.log.error('STRIPE_WEBHOOK_SECRET not configured');
  return reply.code(500).send({ error: 'Webhook verification not configured' });
}
```
The non-null assertion (`!`) has been removed. The `constructEvent` call on line 49 now uses the validated `webhookSecret` variable.

### H-02: Path Traversal in `serve.js` — FIXED

`tools/serve.js` line 18 now includes the path traversal check:
```javascript
if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
```
This prevents `..`-based traversal out of the ROOT directory.

### H-04: Admin Route Parameter Validation — FIXED

Both PUT (`src/routes/admin.ts` lines 114-116) and DELETE (lines 152-154) now validate the `:id` parameter:
```typescript
const idSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
const idParsed = idSchema.safeParse(id);
if (!idParsed.success) return reply.code(400).send({ error: 'Invalid location ID' });
```

### M-01: Math.random() Replaced — FIXED

`src/server.ts` line 2 now imports `randomUUID` from `node:crypto`, and line 39 uses it:
```typescript
genReqId: () => randomUUID(),
```

### M-02: CORS Wildcard Rejection — FIXED

`src/server.ts` lines 50-53 now reject wildcard origins:
```typescript
if (corsOrigins.includes('*')) {
  console.warn('[security] CORS_ORIGIN=* is not allowed with credentials: true, using default');
  corsOrigins.splice(0, corsOrigins.length, 'http://localhost:5173');
}
```

### M-03: Health Endpoint Info Disclosure Restricted — FIXED

`src/routes/health.ts` lines 77-87 now check admin status before exposing config/memory details:
```typescript
let isAdmin = false;
if (clerkEnabled) {
  try {
    const auth = getAuth(_request);
    if (auth?.userId) {
      isAdmin = _request.user?.tier === 'admin';
    }
  } catch { /* unauthenticated */ }
}
if (isAdmin) { /* expose config details */ }
```
Additionally, lines 71-74 now expose encryption status degradation in production to all users via the health status (returning 503 when encryption is not configured in production), which is appropriate for operational monitoring.

### M-04: Household PUT Status Code — FIXED

`src/routes/household.ts` line 105 now correctly returns 400:
```typescript
return _reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
```

### M-05: Releases Auth Flow Guard — FIXED

`src/routes/releases.ts` line 34 now checks if the reply was already sent:
```typescript
if (_reply.sent) return;
```
This prevents the "Reply already sent" error when `requireAuth` rejects an invalid token on the public endpoint.

### M-06: Webhook Idempotency Race — FIXED

`src/routes/webhooks.ts` lines 59-69 now use insert-first with unique constraint violation as the idempotency guard:
```typescript
try {
  await prisma.processedEvent.create({
    data: { eventId: event.id, eventType: event.type },
  });
} catch (err: any) {
  if (err.code === 'P2002') {
    request.log.info({ eventId: event.id }, 'Duplicate webhook event, skipping');
    return { received: true, duplicate: true };
  }
}
```

### M-07: Encryption Production Enforcement — FIXED

`src/middleware/encryption.ts` lines 37-41 now throw on startup if the key is missing in production:
```typescript
export function validateEncryptionConfig(): void {
  const key = getMasterKey();
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('[encryption] ENCRYPTION_MASTER_KEY must be set in production...');
  }
}
```
This is called from `src/server.ts` line 18 (`validateEncryptionConfig()`), preventing the server from starting without encryption in production. The `isEncryptionEnabled()` helper (line 53) is also used by the health endpoint to flag degraded status.

### L-01: SQL Injection Regex Removed — FIXED

`src/routes/locations.ts` lines 20-36 now define `safeString` with only XSS, NoSQL injection, path traversal, and null byte checks. The overly broad SQL keyword blocklist (`union`, `select`, `insert`, `delete`, `drop`, etc.) and the apostrophe/semicolon checks have been removed. Location names with apostrophes (e.g., French and Irish place names) will now be accepted correctly. Prisma's parameterized queries continue to provide SQL injection protection.

---

## Positive Security Controls Observed (Updated)

All 15 positive controls from the original report remain intact. Additional improvements:

16. **Startup Validation**: Encryption key enforced at startup in production (fail-fast).
17. **CORS Hardening**: Wildcard origin explicitly rejected when credentials are enabled.
18. **Cryptographic Request IDs**: `crypto.randomUUID()` replaces `Math.random()`.
19. **Webhook Idempotency**: Insert-first with unique constraint provides atomic idempotency.
20. **Path Traversal Protection**: Development file server validates resolved path stays within root.
21. **Admin-Only Diagnostics**: Health endpoint config/memory details restricted to admin tier.

---

## Updated Remediation Priority

| Priority | Finding | Effort |
|---|---|---|
| **Immediate** | C-01: Rotate exposed Clerk keys, adopt secrets manager | 30 min |
| **This Sprint** | H-03: Replace Redis `changeme` in `.env.example` with placeholder | 5 min |
| **This Sprint** | N-01: Fix preferences PATCH to return 400 on validation error | 5 min |
| **Next Sprint** | H-05: Add cache invalidation on tier change | 2 hr |
| **Backlog** | L-02: Add depth/key limits to `stripDangerousKeys` | 1 hr |
| **Backlog** | L-03: Add reindex mutex/batching | 1 hr |
| **Backlog** | L-04: Type `processApproval` parameter as enum | 15 min |
| **Backlog** | L-05: Define preference key allowlist | 1 hr |
| **Backlog** | L-06: Add query timeout to export endpoint | 30 min |

---

*Re-audit report generated 2026-04-02 by manual SAST analysis of retirement-api codebase (post-fix verification).*
