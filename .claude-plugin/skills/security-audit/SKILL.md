---
name: Security Audit
description: >-
  This skill should be used when the user asks to "security audit", "security scan",
  "check for vulnerabilities", "find secrets", "auth audit", "OWASP check",
  "security review", "pen test prep", "check security", "audit endpoints",
  "find security issues", "check for hardcoded keys", "review auth middleware",
  "check CORS config", "review security headers", "Stripe webhook security",
  "check for data leaks", "audit financial data encryption",
  or mentions preparing for production deployment, SOC 2, GDPR, CCPA, or compliance review.
version: 1.1.0
---

# Security Audit

Comprehensive security audit for a financial SaaS application handling sensitive retirement planning data (portfolio balances, Social Security PIAs, income figures). Produces a prioritized findings report.

## Prerequisites

Before running the audit, verify that source directories exist:
- If `packages/api/src/` is empty or missing, report as **CRITICAL: API not yet implemented**
- If `packages/dashboard/src/` is empty or missing, report as **CRITICAL: Dashboard not yet implemented**
- Use the Grep tool (not bash grep) for all code searches — it has optimized permissions and access
- All file pattern searches should include both `.js` and `.ts`/`.tsx` extensions

## When to Use

- Before any deployment (staging or production)
- After adding or modifying API routes
- After changing auth, middleware, or security configuration
- When preparing for compliance review (SOC 2, GDPR, CCPA)
- Periodic security health check
- After modifying auth middleware, environment config, or dependencies

## Audit Procedure

Run each scan category below. For each finding, record: severity, file:line, description, recommendation, and OWASP category.

### 1. Secrets Detection

Use the Grep tool to scan all source files (excluding node_modules, .git) for hardcoded secrets:

Search patterns (case-insensitive) across `packages/**/*.{js,ts,tsx,json}`:
- `password\s*=`, `secret\s*=`, `api_key\s*=`, `token\s*=`, `private_key`
- `ENCRYPTION_MASTER_KEY`, `CLERK_SECRET`, `STRIPE_SECRET`, `DATABASE_URL`
- `sk_live_`, `sk_test_`, `whsec_`, `pk_live_` (Stripe key prefixes)

Check:
- `.env` files are in `.gitignore` (verify: `git ls-files .env*` returns nothing)
- `.gitignore` covers: `.env`, `.env.local`, `*.pem`, `*.key`, `credentials.json`
- No secrets in `docker-compose.yml` beyond local-dev defaults
- `.env.example` contains only placeholder values (no real keys)

### 2. Authentication Gaps

Read and analyze the middleware chain:

```
packages/api/src/server.{js,ts}     — Server setup, plugin registration order
packages/api/src/middleware/         — Auth, rate limiting, validation middleware
packages/api/src/routes/             — All route handlers
```

Check:
- Every `/api/me/*` route requires JWT authentication middleware
- Every `/api/admin/*` route requires both auth + admin role check (`tier === 'admin'`)
- JWT extraction is implemented (not just TODO/stub)
- Token validation includes: signature verification, expiration check, issuer validation
- `/api/locations/*` routes are intentionally public (verify this is correct)
- No route accidentally exposes user data without auth

### 3. Input Validation

For each route accepting request body or params, search for route files in `packages/api/src/routes/`:

Check:
- Zod schemas are imported AND applied (not just defined in a separate file)
- Request body parsing has size limits (`bodyLimit` in Fastify config)
- Route params (`:id`) are validated (UUID format, not arbitrary strings)
- No raw SQL queries (all through Prisma parameterized queries)
- JSON fields (`preferences`, `scenarioData`, `overrides`) have schema validation
- Numeric fields have range validation (e.g., portfolioBalance >= 0)

### 4. Data Protection

Check financial data handling:

```
packages/api/prisma/schema.prisma   — Which fields store sensitive data
packages/api/src/routes/             — How financial data is read/written
```

Sensitive fields requiring encryption at rest:
- `UserFinancialSettings.portfolioBalance`
- `HouseholdMember.ssPia`
- `HouseholdProfile.targetAnnualIncome`

Check:
- AES-256-GCM (or equivalent) encryption before database write
- Decryption on read, never exposing ciphertext to client
- `ENCRYPTION_MASTER_KEY` loaded from environment, not hardcoded
- Key rotation mechanism exists. If not, report as MEDIUM finding.
- Error responses don't leak sensitive field values or stack traces
- `Cache-Control: private, no-store` on `/api/me/*` responses
- Sensitive fields excluded from logs (check Fastify logger serializers)

### 5. Payment Security (Stripe)

`.env.example` defines: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`.

Check:
- **Webhook signature verification**: All `/api/webhooks/stripe` handlers verify `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`. Missing verification = CRITICAL.
- **Idempotency**: Webhook handlers check for duplicate event IDs to prevent double-processing of subscription events
- **Price ID validation**: Subscription creation only accepts known price IDs (`STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`), not arbitrary user-supplied values
- **Subscription state integrity**: Tier changes flow from Stripe webhooks only (not user API calls); no way to self-promote to premium without payment
- **PCI considerations**: No credit card numbers stored or logged server-side; all card handling via Stripe.js client-side
- **Test vs live key separation**: `STRIPE_SECRET_KEY` must use `sk_test_` in development, `sk_live_` in production (verify no cross-contamination)

### 6. Multi-Tenancy / Data Isolation

This is the single most common vulnerability in SaaS applications (IDOR / broken object-level authorization).

For EVERY Prisma query in `packages/api/src/routes/`:

Search for all `prisma.*.findMany`, `prisma.*.findUnique`, `prisma.*.findFirst`, `prisma.*.update`, `prisma.*.delete` calls and verify:
- Each includes a `where: { userId }` or `where: { householdId }` constraint tied to the authenticated user
- No query allows User A to access User B's data by guessing/enumerating IDs
- Admin routes have separate authorization (admin check before query, NOT just removing the userId filter)
- Bulk operations (if any) are scoped to the requesting user's data

Specific patterns to flag:
- `prisma.*.findUnique({ where: { id } })` without userId — allows IDOR
- `prisma.*.findMany()` with no where clause — leaks all records
- Route param `:id` used directly in query without ownership check

### 7. GDPR/CCPA Data Handling

Check data subject rights implementation:

```
packages/api/src/routes/me.{js,ts}  — Account/profile endpoints
packages/api/prisma/schema.prisma   — Cascade delete rules
```

Check:
- **Right to deletion**: Account deletion endpoint exists; cascades delete all related records (household, financial settings, scenarios, consent records)
- **Right to export**: Data export endpoint returns user's complete data in structured format (JSON)
- **Data retention**: Deleted account data fully purged within stated retention period (30 days per DPIA)
- **Consent tracking**: Consent records stored with timestamps, purpose, version; withdrawal toggles work
- **Privacy policy endpoint**: Privacy policy accessible without authentication
- **Cookie consent**: Dashboard implements cookie consent banner for EU users (if analytics cookies used)

### 8. Infrastructure Security

Check server configuration:

```
packages/api/src/server.{js,ts}     — Helmet, CORS, rate limiting, cookies
docker-compose.yml                  — Database credentials, ports
packages/dashboard/vite.config.{js,ts} — Dev proxy, CORS headers
```

Check:
- Helmet.js CSP configured (not just defaults)
- CORS origin is a whitelist (not `*` in production)
- Rate limiting: 100 req/min auth, 10 req/min unauth (verify thresholds are reasonable)
- Per-tier rate limits if Basic/Premium tiers exist (check for tier-aware limiting)
- Cookie settings: `httpOnly: true`, `secure: true` (in production), `sameSite: 'strict'` or `'lax'`
- HSTS header enabled
- Docker Compose: database password is not used in production (local-dev only)
- No debug/verbose mode enabled by default

### 9. Dependency Vulnerabilities

Run from project root:

```bash
npm audit --json 2>/dev/null | head -100
```

Check:
- No critical or high severity vulnerabilities
- All major dependencies on latest stable (Fastify 5, Prisma 6, React 18, Vite 6)
- No deprecated packages still in use
- `package-lock.json` is committed (reproducible builds)

### 10. OWASP Top 10 Checks

| Category | What to Check |
|----------|---------------|
| A01 Broken Access Control | User A can't access User B's data (check Prisma `where: { userId }` on all queries) — see Section 6 |
| A02 Cryptographic Failures | Financial field encryption, HTTPS enforcement, password/token storage |
| A03 Injection | No raw SQL, no `dangerouslySetInnerHTML` with user data, no dynamic code execution with untrusted input |
| A04 Insecure Design | Rate limiting, account lockout, GDPR deletion cascades |
| A05 Security Misconfiguration | Default credentials, debug mode, verbose errors, unnecessary features enabled |
| A06 Vulnerable Components | npm audit results, outdated dependencies |
| A07 Auth Failures | JWT validation, session management, brute force protection |
| A08 Data Integrity | CSRF tokens on state-changing endpoints, Stripe webhook signature verification |
| A09 Logging Failures | Security events logged (failed auth, admin actions, data access) |
| A10 SSRF | No user-controlled URLs fetched server-side |

### 11. Frontend Security

```
packages/dashboard/src/              — React components
packages/dashboard/vite.config.{js,ts} — Build config
```

Check:
- No `dangerouslySetInnerHTML` with user-supplied data in React components
- No dynamic code execution patterns with untrusted input
- localStorage usage doesn't store auth tokens (use httpOnly cookies)
- Vite proxy doesn't expose internal services
- Source maps disabled in production build
- Check for `sql.js` usage — client-side database could expose data

## Report Format

Organize findings by severity:

```
## CRITICAL (Must fix before ANY deployment)
- [C1] file:line — Description. Recommendation. (OWASP: A0X)

## HIGH (Must fix before production)
- [H1] file:line — Description. Recommendation. (OWASP: A0X)

## MEDIUM (Fix before scaling/public launch)
- [M1] file:line — Description. Recommendation. (OWASP: A0X)

## LOW (Best practice improvements)
- [L1] file:line — Description. Recommendation. (OWASP: A0X)

## PASSED (Verified secure)
- [P1] Description — verified in file:line
```

## Key Project Files

| File | Purpose |
|------|---------|
| `packages/api/src/server.{js,ts}` | Server config, middleware chain |
| `packages/api/src/routes/*.{js,ts}` | All route handlers |
| `packages/api/src/middleware/*.{js,ts}` | Auth, rate limiting, validation |
| `packages/api/prisma/schema.prisma` | Database schema, sensitive fields |
| `packages/dashboard/vite.config.{js,ts}` | Frontend build config |
| `docker-compose.yml` | Local infrastructure |
| `.env.example` | Expected environment variables |
| `.gitignore` | Files excluded from git |
| `package.json` (root + each package) | Dependencies |
