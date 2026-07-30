# Changelog

All notable changes to `retirement-api`. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are ISO-8601.

## [Unreleased]

### Security
- **Dependency audit — 0 vulnerabilities** — `npm audit fix` cleared all 15
  advisories (5 high, 9 moderate, 1 low), including the high-severity
  `@fastify/static`, `fast-uri`, `find-my-way`, `brace-expansion`, and
  `postcss` findings that were failing the `security-audit` CI gate
  (`npm audit --audit-level=high`). Lockfile-only: transitive updates within
  existing semver ranges, no direct-dependency version bumps. Typecheck, full
  test suite (36,912), and shared tests (231) all pass.
- **H-05 CLOSED** — `invalidateUserCache()` exported from `src/middleware/auth.ts`
  and invoked from both Stripe webhook tier-change paths. Multi-replica
  deployments still need Redis pub/sub; documented as a follow-up.
- **M-NEW-01 startup guard** — the process now refuses to boot in
  `NODE_ENV=production` when a `dev_local_bypass` / `dev@localhost` user exists
  in the DB.
- **M-02 CLOSED** — `feesSchema` and `financialSchema` now carry `.strict()`;
  unknown keys are rejected at the 400 level.
- **L-02 CLOSED** — `safeJsonRecord` (sanitize.ts) now caps recursion depth at
  32 and total keys at 10 000; throws `SanitizeLimitError` otherwise.
- **L-03 CLOSED** — single-process mutex on `POST /api/admin/locations/reindex`
  to prevent overlapping reindex runs (409 on concurrent call).
- **L-04 CLOSED** — `processApproval()` now takes a typed `ContributionType`
  union; compile-time rejection of unknown contribution categories.
- **L-05 CLOSED** — per-route 16 KB cap on `PATCH /api/me/preferences` body
  before sanitize/schema passes.
- **L-06 CLOSED** — `GET /api/me/export` enforces hard `take` caps on relation
  loads (200 scenarios, 100 custom-locations, 500 location-overrides).
- **L-NEW-01 CLOSED** — Zod UUID/ID validator on `POST /api/releases/:id/checkout`
  path param.
- **L-NEW-02 CLOSED** — shared `ensureStripeCustomer()` helper in
  `src/lib/stripe-customer.ts` with optimistic-concurrency guard; prevents
  orphaned Stripe customers from parallel first-time checkouts.
- **H-03 CLOSED** — Redis `.env.example` placeholder replaced with
  `<GENERATE_STRONG_PASSWORD>`.

### Dyscalculia (audit 2026-04-19)
- **F-202 infra** — opt-in `Accept-Version: 2` request header. When set, all
  percentage-shaped fields in `/api/me/financial` and `/api/me/fees` are
  emitted as decimal fractions (matching DB + the shared `pct()` helper).
  Default remains v1 (whole-number percents). See [ADR 0003](docs/adr/0003-api-versioning-percent-encoding.md).
- **F-203 CLOSED** — `acaMarketplace._units` block injected by the
  `/api/locations/:id` route. Declares `premiumCapPctOfIncome` as a decimal
  fraction with regime tag.
- **F-204 CLOSED (partial)** — `/api/me/household` response now carries
  `_units` + `_labels` siblings.
- **F-205 CLOSED** — `GET /api/me/scenarios` now decorates `monte_carlo_v1`
  rows with synthesized `anchor` + `naturalFrequency` when missing; attaches
  a top-level `_units` block.
- **F-206 CLOSED** — seed-integrity test now requires `max ≤ 3 × typical` per
  cost child; `medicine` is explicitly opted out.
- **F-207 CLOSED** — OpenAPI fallback doc now declares a full response schema
  for `/api/glossary` (`GlossaryEntry` + `GlossaryResponse`).
- **F-208 CLOSED** — non-US locations receive `healthcare.acaApplicable: false`
  at the route layer without a seed migration.

### Dyslexia (audit 2026-04-19)
- **F-006 CLOSED (mostly)** — module-level JSDoc on admin / custom-locations /
  locations / health / users / groceries / household / releases / preferences
  / contributions route files.
- **F-007 CLOSED** — 16 `details: parsed.error.issues` call sites across
  9 route files replaced with `toValidationErrorPayload()`. Every 400 now
  follows the `{ field, fieldLabel, message, code }` envelope.
- **F-011 CLOSED** — `validateBody()` helper exported from `src/lib/validation.ts`
  so new routes cannot accidentally reintroduce the raw-Zod-issue leak.
- **F-012 CLOSED** — `tools/expand-abbreviations.mjs` expanded 82 regional
  abbreviations across the 7 Mid-Atlantic location JSONs on first use.
- **F-013 CLOSED** — `FIELD_LABELS` extended with ssCola, ssCutYear, ssExempt,
  retirementPath, per-account load/fees, etc. `getLabelsFor()` helper + new
  `_labels` sibling on `GET /api/me/financial` and `/api/me/household`.

### Governance
- Populated `SECURITY.md` with disclosure SLA + incident-response runbook.
- Added `docs/METHODOLOGY.md` describing seed-data provenance and projection
  assumptions.
- Added `docs/adr/0001-runtime-stack.md`, `0002-aca-regime.md`,
  `0003-api-versioning-percent-encoding.md`.
- New `tools/expand-abbreviations.mjs` for dyslexia seed-data maintenance.

### Developer tools
- New `src/lib/stripe-customer.ts` — shared Stripe customer helper.
- `getLabelsFor()` exported from `src/lib/validation.ts`.
- `validateBody()` exported from `src/lib/validation.ts`.

### Data
- **Fixed NoVA ACA benchmarks** — `us-annandale-va`, `us-lorton-va`,
  `us-gainesville-va`, and `us-manassas-va` were anchored to a statewide-scaled
  silver benchmark ($1,900/mo, 2-adult) that understated the Northern Virginia
  rating area and contradicted the sibling `us-virginia` (Fairfax base, $2,300)
  record. Corrected to the NOVA metro benchmark ($2,300/mo; single $1,150;
  pre-Medicare min/typical/max 1886/2300/2714) and reconciled the notes.
- **Added three affordable Philadelphia-suburb locations** — `us-upper-darby-pa`
  (Delaware Co, rent ~$1,500), `us-chester-pa` (Delaware Co, rent ~$1,300), and
  `us-norristown-pa` (Montgomery Co, rent ~$1,600). All use the Philadelphia
  ACA rating-area benchmark ($2,300) and the PA retirement-tax regime minus the
  Philadelphia city wage tax and 2% local sales tax.
- **Recalibrated 6 statewide-anchored ACA records to local rating areas** —
  a follow-up sweep found six records still using statewide-scaled benchmarks
  (the same pattern as the NoVA fix). The four Hampton Roads records
  (`us-chesapeake-va`, `us-norfolk-va`, `us-portsmouth-va`,
  `us-virginia-beach-va`) moved from $1,930 to the Hampton Roads rating-area
  benchmark ($2,300, aligned to the validated NOVA/Fairfax anchor);
  `us-lynchburg-va` moved to $2,100 (correcting an ordering error — it had been
  priced *above* Hampton Roads despite being one of VA's cheapest rating areas);
  and `us-florida` was re-anchored from a bare statewide average ($2,400,
  `rateArea: "statewide"`) to its populous metro-county records ($2,350). All
  now carry local-rating-area provenance and "derived estimate, not a ZIP quote"
  disclaimers. Every US record is now `estimationLevel: "county"` with no
  statewide anchors remaining.

---

## [0.1.0] — 2026-04-19

Initial audited release. See `audits/AUDIT_SUMMARY.txt` for the baseline
security / compliance posture.
