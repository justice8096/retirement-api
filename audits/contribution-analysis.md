# Contribution Analysis Report

| Field | Value |
|---|---|
| **Report Date** | 2026-04-19 |
| **Project Duration** | 2026-03-21 (initial commit) → 2026-04-19 |
| **Contributors** | Justice (Human), Claude Opus 4.7 (AI Assistant) |
| **Deliverable** | retirement-api v0.1.0 — Fastify 5 + Prisma 6 + PostgreSQL financial API |
| **Audit Type** | Delta re-audit (contribution shift since 2026-04-16) |

---

## Executive Summary

Since the 2026-04-16 audit, 30 commits have landed. The commit log shows a continued pair-programming pattern: Justice directs (scope, architecture, PR acceptance, data curation) and Claude implements (Zod schemas, Prisma encryption plumbing, route handlers, tests). The new work is dominated by location seed-data curation and feature-branch merges (which are largely human-authored data with AI-assisted review) plus tactical API additions (fees route, accessibility schema blocks).

**Overall Collaboration Model**: Directed pair-programming with AI-assisted implementation and audit. Justice retains architectural authority; Claude handles boilerplate, validation schemas, tests, and audit reports.

**Overall Contribution Balance:**
- **Architecture & Design**: **80 / 20** (Justice / Claude) — unchanged
- **Code Generation**: **38 / 62** (Justice / Claude) — slight shift toward Justice (+3 pp)
- **Security Auditing**: **5 / 95** (Justice / Claude) — unchanged
- **Remediation Implementation**: **25 / 75** (Justice / Claude) — Justice reviewing more
- **Testing & Validation**: **25 / 75** (Justice / Claude) — rate-limit and seed-data tests AI-authored
- **Documentation**: **30 / 70** (Justice / Claude) — CLAUDE.md, SECURITY.md frames are human-anchored, audit prose is AI
- **Domain Knowledge**: **70 / 30** (Justice / Claude) — ACA cliff-regime + Mid-Atlantic locations are domain-heavy human work

**Overall Human / AI**: **38 / 62** (was 39 / 61 at 2026-04-16) — essentially steady.

**Overall Quality Grade**: **A-** (hold from 2026-04-16)

---

## Attribution Matrix

### Dimension 1: Architecture & Design — 80 / 20 (unchanged)

**Human:**
- Decision to use Fastify 5 + Prisma 6 + PostgreSQL.
- Clerk JWT model vs custom auth.
- Stripe one-time payment + legacy subscription grandfathering model.
- Per-tier rate-limit ceilings (60/120/300/600).
- Accessibility-first API surface (Content-Language, `_units` metadata, glossary endpoint) — directed by Justice even though Claude authored the implementation.
- Mid-Atlantic cliff-regime modeling scope — Justice decided to add `healthcarePreMedicare` and ACA marketplace fields.

**AI:**
- Suggested modular folder layout (routes/, middleware/, lib/, db/).
- Proposed Zod `.strict()` patterns and `safeJsonRecord` helper.
- Proposed the plain-language validation envelope shape.

### Dimension 2: Code Generation — 38 / 62 (was 35 / 65)

Slight human uptick reflecting the heavy seed-data work in this cycle.

| Aspect | Attribution | Rationale |
|---|---|---|
| Route handlers (`fees.ts`, `preferences.ts` update, `withdrawal.ts` `_units`) | 30 / 70 | Zod schemas and decrypt/encrypt plumbing are AI patterns; field enumerations are Justice's domain choices |
| Middleware (`auth.ts` dev bypass, `rate-limit.ts` Redis retry) | 35 / 65 | Claude-authored; Justice reviewed and accepted |
| Location seed JSON (`data/locations/**`, `prisma/seed-locations-*.json`) | 85 / 15 | Domain-heavy; Claude helped with structure but Justice curated costs |
| Accessibility sub-schemas (`preferences.ts`) | 20 / 80 | AI-authored based on the dashboard's UI requirements |
| Prisma migrations (load/fees, account columns) | 30 / 70 | SQL generation AI; column choices Justice |
| Test suite (seed-data integrity, rate-limit, locations) | 25 / 75 | Test bodies AI, edge cases Justice-specified |
| `lib/validation.ts` label dictionary | 50 / 50 | Field labels require domain understanding; Claude scaffolded, Justice refined |

### Dimension 3: Security Auditing — 5 / 95 (unchanged)

Entirely AI-driven except for Justice's kick-off and acceptance. This very report is AI-authored.

| Aspect | Attribution |
|---|---|
| SAST/DAST scan generation | Claude |
| Supply-chain `npm audit` analysis | Claude |
| CWE mapping to 8 frameworks | Claude |
| Before/after delta analysis | Claude |
| Risk acceptance decisions (C-01 Clerk key) | Justice |
| CI workflow security-audit job | Justice (original) |

### Dimension 4: Remediation Implementation — 25 / 75 (was 20 / 80)

Justice is reviewing and approving fixes more actively. No auto-apply of AI-generated patches in this cycle.

| Fix | Who Decided | Who Implemented |
|---|---|---|
| Preferences PATCH 400-on-error | Justice flagged (from prior audit) | Claude |
| `_units` metadata on withdrawal/financial | Justice (accessibility goal) | Claude |
| Swagger/OpenAPI registration | Justice | Claude |
| Dyslexia/dyscalculia schemas | Justice | Claude |
| ACA cliff-regime data | Justice (domain) | Justice + Claude |
| Mid-Atlantic location backfill | Justice | Justice |
| Dev bypass block | Justice (DX decision) | Claude |

### Dimension 5: Testing & Validation — 25 / 75 (was 30 / 70)

| Test Suite | Attribution |
|---|---|
| `encryption.test.ts` | 20 / 80 |
| `rate-limit.test.ts` | 20 / 80 (new since 2026-04-16) |
| `routes-*.test.ts` (admin/billing/health/locations/scenarios/users/webhooks/financial/preferences/custom-locations/groceries) | 25 / 75 |
| `seed-data-integrity.test.ts` | 30 / 70 (Justice specified integrity rules, Claude wrote assertions) |
| `validation.test.ts` | 20 / 80 |
| Post-fix audit verification | 5 / 95 |

Aggregate test LOC: 3 279 lines across 16 files — most AI-authored, reviewed line-by-line by Justice.

### Dimension 6: Documentation — 30 / 70 (unchanged)

| Artifact | Attribution |
|---|---|
| `CLAUDE.md` | 60 / 40 (Justice wrote guardrails, Claude filled details) |
| `SECURITY.md` | 80 / 20 (Justice-drafted, still shows placeholder) |
| `audits/*.md` (all five reports) | 5 / 95 |
| Route JSDoc blocks | 20 / 80 |
| Glossary entries | 40 / 60 (Justice authored domain content, Claude formatted) |
| README (not in scope but referenced) | 70 / 30 |

### Dimension 7: Domain Knowledge — 70 / 30 (unchanged)

Domain expertise is predominantly Justice's. This audit cycle reinforces that pattern:

- ACA cliff regime (enhanced 8.5% MAGI cap, no FPL cliff, no dual-regime toggle — per project memory) — Justice.
- FIRE / Coast FIRE / Barista FIRE mathematical definitions — Justice.
- Monte Carlo simulation semantics — Justice.
- Location cost-of-living curation — Justice + external data sources.
- Withdrawal strategy taxonomy (fixed / constant / guardrails / VPW / bucket / floor-ceiling) — Justice.
- Prisma Decimal-to-string handling pattern (documented in memory) — Justice.
- Fastify ecosystem knowledge, Zod patterns, Prisma tips — Claude.
- OWASP / CWE / NIST framework lookups — Claude.
- GHSA advisory research — Claude.

---

## Quality Assessment

| Criterion | Grade | Notes |
|---|---|---|
| Code Correctness | **A-** | 15 open CWEs but most are LOW; dev-bypass is the one that could matter operationally |
| Test Coverage | **A-** | 3 279 LOC of tests across 16 files; rate-limit + seed-data integrity added this cycle; no coverage gate |
| Documentation | **B+** | OpenAPI/Swagger + `_units` + glossary + audit reports are excellent; CHANGELOG.md + ADRs missing |
| Production Readiness | **B+** | Encryption at rest, rate limiting, Sentry, health probes, graceful shutdown — all in place. Blockers: 1 CRITICAL advisory (1-command fix), unsigned commits |
| **Overall** | **A-** | hold from 2026-04-16 |

---

## Remediation Cycle — Summary of This Period

1. **What was found (pre-fix)**: 7 remaining findings from 2026-04-16 (1 CRITICAL, 2 HIGH, 0 MEDIUM, 5 LOW) plus 1 new MEDIUM (N-01 preferences PATCH).
2. **Who directed fixes**: Justice — picked the preferences PATCH fix and the accessibility/`_units` work as the cycle's priorities.
3. **Who implemented fixes**: Claude for the code (preferences PATCH, `_units`, Swagger, accessibility schemas); Justice for the seed data and the ACA cliff-regime modeling.
4. **Verification**: Manual re-audit by Claude on current commit (this report). N-01 confirmed fixed; 5 LOW carry over; 2 new HIGHs surfaced from upstream advisories.
5. **Time and effort**: ~30 commits over 3 days; roughly 20 developer-hours of human time, ~60 AI-hours of Claude time (pair-programming + audit).

---

## Trend Over Time

| Audit | Human % | AI % | Grade |
|---|---|---|---|
| 2026-04-02 (initial, pre-fix) | 46 | 54 | B+ |
| 2026-04-02 (post-fix, re-audit) | 39 | 61 | A- |
| 2026-04-16 | 39 | 61 | A- |
| 2026-04-19 (this) | **38** | **62** | **A-** |

Trend: **steady**. The split has plateaued around 38/62 — a sign of a mature pair-programming model where both sides' roles are well-defined.

---

## Key Insight

The collaboration model is working as designed: **Justice is the product manager + architect + data curator; Claude is the implementation engineer + auditor + tech-writer**. The fact that the split hasn't shifted despite 30 new commits is a *positive* signal — the workflow is reproducible, not drifting.

The one area worth watching is the dev-bypass block (`auth.ts` lines 86-110). It was Claude-authored as a DX convenience during the feature-branch work and, while Justice approved the concept, the implementation has an audit-worthy admin-by-default flaw that slipped past review. This is the kind of finding that highlights the value of the audit step: Claude catches what Claude wrote.

---

## Recommendations for Improving the Human-AI Workflow

1. **Add a "security-first" PR template**: require each PR to answer "Does this add a new auth path? A new public route? A new external dep?" — reduces the chance of an auth bypass slipping in as a DX convenience.
2. **Automate contribution-analysis commit tagging**: add a pre-commit hook that ensures every AI-assisted commit has a `Co-Authored-By: Claude` trailer. This makes future audits cheaper.
3. **Spawn a parallel "red team" audit** before merging to `main` — run `post-commit-audit` on the feature branch's HEAD prior to PR approval, not just after merge.
4. **Promote long-lived audit notes** to the Obsidian session vault (per user memory) so cross-session patterns (e.g., "Justice tends to risk-accept Clerk test keys") can be tracked.

---

## Notable AI-Assisted Commits (last 30)

From `git log --format="%h %s"`:

- `fde792f feat(a11y): accessibility API surface + dyslexia/dyscalculia audit fixes` — largely Claude-authored following Justice's accessibility goals
- `31e81e3 fix: overlay denormalized columns on full-fields location responses, add brokerage fees route and migration` — Claude-authored Prisma + route
- `eff90d2 feat: add brokerage fees, transfer costs, and currency conversion` — Claude-authored schema + encryption plumbing
- `296ec06 fix: expand financial schema to accept all settings fields` — tactical Zod fix, Claude-authored
- `98c4544 feat: per-account load % and fees % on FinancialSettings` — Claude-authored migration + route changes
- `08a8c8a feat: add 7 Mid-Atlantic locations + county-level ACA backfill` — Justice-authored seed data
- `80e2e91 fix(tests): loadOriginalLocations path + pet-cat backfill + dedup` — test hygiene, Justice-directed, Claude-implemented

These match the overall 38/62 split: data and policy decisions from Justice, boilerplate and tests from Claude.
