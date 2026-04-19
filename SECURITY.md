# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

1. **Do NOT** open a public GitHub issue.
2. Email: **justice8096+security@gmail.com**
3. Include: description, reproduction steps, potential impact, and any PoC.
4. You will receive an acknowledgement within **2 business days**.

### Disclosure SLA

| Severity | First ack | Triage | Fix target |
|---|---|---|---|
| Critical (RCE, auth bypass, data exfil) | < 24 h | < 3 days | **< 7 days** |
| High | < 2 days | < 5 days | < 14 days |
| Medium | < 3 days | < 10 days | < 30 days |
| Low / Info | < 5 days | Best-effort | Next maintenance window |

Public disclosure follows the fix landing on `main`, plus a 7-day grace period
for deployed consumers. Coordinated disclosure with shorter windows is
negotiated case-by-case.

---

## Security Measures (current)

### Authentication & Authorization
- Clerk JWT verification on every authenticated endpoint (`src/middleware/auth.ts`).
- Role-based access control (`requireAdmin`, `requireTier`, `requireFeature`).
- In-memory user cache (10-second TTL) invalidated immediately on tier changes
  via `invalidateUserCache()` (hooked from Stripe webhooks — SAST H-05).
- **Dev auth bypass double-guard** — requires both `NODE_ENV=development` and
  `DEV_AUTH_BYPASS=1`. Startup refuses to boot in production if a dev-bypass
  user still exists in the DB (SAST M-NEW-01).

### Data Protection
- AES-256-GCM encryption at rest for financial fields
  (`portfolioBalance`, `targetAnnualIncome`, `ssPia`, per-account balances).
- PostgreSQL with parameterised queries via Prisma (no raw SQL in app code).
- Input sanitization on every route (`safeJsonRecord`) with prototype-pollution
  blocklist and 32-level depth / 10 000-key caps (SAST L-02).
- Global request body limit: 1 MB. Per-route caps where relevant
  (e.g. `/me/preferences` PATCH → 16 KB; SAST L-05).
- Cache-Control: `private, no-store` on every user-specific response.

### Input Validation
- All routes use Zod schemas with `.strict()` to reject unknown keys
  (SAST M-02 hardens `feesSchema` + `financialSchema`).
- `toValidationErrorPayload()` normalises every 400 to the
  `{ field, fieldLabel, message, code }` envelope (Dyslexia F-007).
- `validateBody()` helper prevents raw-Zod-issue leaks (Dyslexia F-011).
- URL path params are Zod-validated before DB queries
  (e.g. `/api/releases/:id/checkout` → SAST L-NEW-01).

### Rate Limiting
- Tier-based limits (60/120/300/600 req/min for free/basic/premium/admin).
- Redis-backed distributed store; falls back to in-memory when Redis unavailable.
- Exempt: `/api/health`, `/api/billing/status`, `/api/webhooks/*`.

### Network Security
- CORS origin allow-list via `CORS_ORIGIN`. Wildcard rejected when
  `credentials: true`.
- Helmet default security headers. CSP enabled in production.
- TLS via Tailscale or operator-provided certs.

### Stripe / Payments
- `constructEvent` with webhook signature verification on every event.
- Processed-event idempotency: insert-first with unique constraint;
  returns `{ duplicate: true }` on `P2002`.
- Shared `ensureStripeCustomer()` helper uses optimistic-concurrency
  (`updateMany where stripeCustomerId = null`) so parallel checkouts cannot
  create orphaned Stripe customers (SAST L-NEW-02).

### Infrastructure
- Non-root Docker containers.
- Multi-stage builds (minimal production image).
- Health + readiness probes (`/api/health`, `/api/health/ready`).
- No secrets in source code; `.env` is `.gitignored`.

### Dependency Management
- `npm audit` runs in CI on every PR.
- `package-lock.json` committed and used via `npm ci` in CI.
- CycloneDX SBOM emitted as a CI artefact (see `.github/workflows/`).

---

## Incident Response Runbook

### 1. Acknowledge (within SLA above)
Reply from `justice8096+security@gmail.com` confirming receipt, assigning a
working internal ID, and requesting clarifications only if blocking triage.

### 2. Triage
- **Reproduce** on a local dev DB with `NODE_ENV=development`. Never against
  production.
- **Classify** CVSS v3.1 + OWASP category + affected data classes.
- **Contain** — if a live key is leaked, rotate immediately:
  - Clerk keys: Clerk dashboard → API Keys → rotate. Update secrets store.
  - Stripe keys: Stripe dashboard → Developers → API keys → roll.
  - Encryption master key: coordinated rotation requires re-encrypting every
    row in `UserFinancialSettings` + `HouseholdProfile` + derived tables.
    Do NOT roll unilaterally — run `tools/rotate-encryption-key.mjs` with
    downtime planned.
- **Snapshot** the affected environment — DB dump, log snapshot, timeline.

### 3. Fix
- Branch: `security/<internal-id>`.
- PR gated on: passing CI, `npm audit --audit-level=high`, at least one reviewer.
- Commit message prefix `fix(security):` for searchability.
- Do NOT reference the CVE publicly until the coordinated disclosure date.

### 4. Deploy
- Critical: out-of-band; skip the release-cadence window. Roll-back plan mandatory.
- High / Medium: next scheduled deploy, accelerated if impact warrants.
- Post-deploy, verify via the health endpoint and relevant route probes.

### 5. Communicate
- Internal: tag the incident in `CHANGELOG.md` under a `### Security` subsection.
- External (if users are affected): email + status-page entry with plain-language
  summary, impact, mitigation status, and a "what you should do" section.
- If PHI/PII was exposed: assess notification obligations under relevant law
  (GDPR Art. 33 — 72 h; state breach-notification laws; etc.).

### 6. Post-mortem (within 10 business days)
- Root cause, contributing factors, timeline, detection gap.
- 3–5 concrete action items with owners and deadlines.
- Non-punitive; focus on systemic fixes, not individual blame.

### Contacts
- Security lead: justice8096+security@gmail.com
- On-call rotation: document in `docs/ONCALL.md` (TBD).
- Legal / privacy counsel: not yet retained — solo-dev project; coordinate ad-hoc.
