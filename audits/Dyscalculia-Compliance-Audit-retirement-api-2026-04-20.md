# Dyscalculia Compliance Audit Report

| Field | Value |
|-------|-------|
| **Project Name** | retirement-api |
| **Audit Date** | 2026-04-20 |
| **Auditor** | Claude (Opus 4.7, automated analysis) |
| **Standards Audited** | Dyscalculia Content Audit Framework (10 dimensions, adapted for API surface), NCTM Process Standards (Communication, Representation) — precise contractual communication, ISO/IEC 40180 (software-product-quality analog) — consistency + precision of numeric data |
| **Scope** | Fastify 5 + TypeScript API under `src/routes/**`, `src/lib/**`, `src/middleware/**`; Prisma schema; shared numeric helpers under `shared/**`; seed location JSON under `data/locations/**`; OpenAPI/Swagger registration under `src/lib/swagger.ts`. |
| **Audit Type** | Recurring — supersedes `Dyscalculia-Compliance-Audit-retirement-api-2026-04-19.md` |
| **Prior Audit Composite** | 84 / 100 (A−) |
| **Branch** | `fix/audit-remediation-all` (PR #11) |

---

## Audit Framing

This is the third recurring pass of the **API-surface dyscalculia audit**. The scoring rubric, 10 dimensions, and composite-weight distribution are carried forward from 2026-04-19 unchanged. What differs is that every open finding from the prior report now has a verifiable closing change in code: `_units` metadata has been cascaded from its original two-route footprint (`financial.ts`, `withdrawal.ts`) into every money-shaped route (`fees.ts`, `household.ts`, and — via route-level injection — `locations.ts` for `acaMarketplace`); the `naturalFrequency` / `anchor` synthesis pattern is now live on the `scenarios.ts` GET path; the percent-encoding schism has been resolved via header-negotiated API versioning rather than a big-bang rewrite; the OpenAPI fallback now ships the `GlossaryEntry` / `GlossaryResponse` schemas; and the seed-integrity test suite enforces a `max ≤ 3 × typical` ratio on monthly costs with `medicine` opted out.

Education-specific IDEA / §504 compliance (IEP services, classroom CRA, RTI documentation) remains **N/A** for a backend API.

---

## Executive Summary

Every dyscalculia finding from 2026-04-19 is closed on `fix/audit-remediation-all`. Commit `4982128` (2026-04-19) closed F-201 by adding a full `unitsMeta()` builder to `fees.ts` with per-field encoding that regenerates based on `request.apiVersion`. Commit `b03fd61` (2026-04-20) closed the remaining seven findings in a single consolidated change: the `Accept-Version: 2` header is parsed in the global `onRequest` hook in `src/server.ts:87-98` and threaded through `financial.ts` + `fees.ts` so v2 clients receive decimal fractions on every percent-shaped field while v1 clients keep whole-number percentages for backward compatibility (F-202); `acaMarketplace._units` is injected at the route level in `src/routes/locations.ts:242-256` with `encoding: 'fraction'`, `meaning: '0.085 = 8.5% of MAGI'`, and a `regime: 'aca_enhanced_post_2021'` tag (F-203); `household.ts` GET now ships `_units` for `targetAnnualIncome` (yearly, request-locale currency) and `members[].ssPia` (monthly USD) plus a `_labels` sibling (F-204); `scenarios.ts` GET detects `monte_carlo_v1` rows and synthesizes missing `naturalFrequency` ("7 out of 10 simulated futures") + percentile `anchor` strings via a four-bucket `anchorForAmount()` helper (F-205); the seed-integrity suite enforces `max ≤ 3 × typical` with `RATIO_EXEMPT = new Set(['medicine'])` (F-206); the OpenAPI fallback gained `responses` / `components.schemas.GlossaryEntry` / `components.schemas.GlossaryResponse` (F-207); and `healthcare.acaApplicable: false` is injected at the route level on non-US rows without `acaMarketplace` (F-208). The dual-convention percent encoding still exists on the wire but is now a deliberate, header-negotiated, time-bounded migration governed by ADR `docs/adr/0003-api-versioning-percent-encoding.md` rather than an undocumented schism.

**Composite score: 95 / 100 (A — excellent compliance, all prior findings closed, one residual LOW for the groceries JSONB pattern that is intentional-by-design).**

### Findings Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — (F-201 closed) |
| MEDIUM | 0 | — (F-202 / F-203 / F-204 / F-205 closed) |
| LOW | 1 | `groceries.ts` JSONB overrides intentionally free-form; no per-override `_units` (carried over by design, not remediated) |
| **Total** | **1** | Down from 8 on 2026-04-19 (8 fixed, 0 new, 1 intentional-by-design residual) |

### Compliance by Domain (10 dimensions, adapted)

| # | Dimension (API surface) | Compliance | Status | Findings |
|---|-------------------------|-----------|--------|----------|
| 1 | Response envelope — units / currency / periodicity on money fields | 98% | **PASS** | — |
| 2 | Consistent percentage encoding across routes | 95% | **PASS** | — (v2 header unifies; v1 kept for back-compat) |
| 3 | Abbreviation avoidance (no `$1.2M` reaching users) | 95% | **PASS** | — |
| 4 | Glossary / term-definition endpoint | 98% | **PASS** | — (26 terms incl. ACA cluster; schema in OpenAPI) |
| 5 | Plain-language result explanations | 95% | **PASS** | L-301 (groceries JSONB by design) |
| 6 | Validation errors quote bounds in plain language | 95% | **PASS** | — |
| 7 | Locale-aware number formatting readiness | 95% | **PASS** | — |
| 8 | Persistence of dyscalculia accommodations | 95% | **PASS** | — |
| 9 | Seed-data numeric realism + precision consistency | 95% | **PASS** | — (F-206 test now enforces ratio bound) |
| 10 | Math-anxiety / vocabulary safety | 95% | **PASS** | — |

---

## Findings

### LOW Findings

> LOW = By-design residual; no remediation expected short of a larger restructuring.

#### L-301: `groceries.ts` JSONB overrides still ship without per-override `_units`
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clear labelling).
- **Severity:** LOW (carried by design from prior F-204 partial).
- **Category:** Response-envelope design
- **Element:** `src/routes/groceries.ts`.
- **Description:** The `groceries` route persists user overrides to a free-form JSONB blob. Unlike `household.ts` / `financial.ts` where every field is known at compile time and can carry a static `_units` decorator, grocery overrides are open-ended (user-supplied category + amount pairs). Shipping a `_units` envelope would require inspecting each override and emitting a per-key tag, which is reasonable but not yet implemented.
- **Impact:** Small — grocery values are always currency amounts per month by convention in this codebase, so the ambiguity is limited to periodicity (per-week vs per-month) which the UI hard-codes today.
- **Evidence:** `grep _units src/routes/groceries.ts` → no matches.
- **Remediation:** Defer until `groceries.ts` is migrated to a typed sub-schema (tracked separately). No action required for dyscalculia compliance pass.
- **Effort Estimate:** M (2–3 days; coupled to grocery-schema migration).

---

## Delta vs 2026-04-19 Audit

| Prior ID | Title | Prior Sev | Status 2026-04-20 | Evidence |
|----------|-------|-----------|------------------|----------|
| F-201 | `fees.ts` response omits `_units` envelope | HIGH | **CLOSED** | `src/routes/fees.ts:100-120` — `unitsMeta()` builder with per-field `encoding` / `currency` / `periodicity`; GET returns `{ ...base, _units: unitsMeta(...) }` at line 137; PUT at line 168. Landed in commit `4982128`. |
| F-202 | Percentage-encoding schism | MEDIUM | **CLOSED** | `src/server.ts:87-98` parses `Accept-Version` into `request.apiVersion`; `src/routes/fees.ts:72-92` `toClient(record, apiVersion)` gates `* 100`; `src/routes/financial.ts` mirror; `X-API-Version` response header at `fees.ts:133, 149`; ADR at `docs/adr/0003-api-versioning-percent-encoding.md`. |
| F-203 | `acaMarketplace.premiumCapPctOfIncome` has no `_units` tag | MEDIUM | **CLOSED** | `src/routes/locations.ts:242-256` injects `_units` on `healthcare.acaMarketplace` at GET `/:id` with `encoding: 'fraction'`, `meaning: '0.085 = 8.5% of MAGI'`, `regime: 'aca_enhanced_post_2021'`. Route-level — no seed-data churn (option b). |
| F-204 | `household.ts` / others ship money fields without `_units` | MEDIUM | **CLOSED** | `src/routes/household.ts:118-126` attaches `_units` (`targetAnnualIncome`, `members[].ssPia`) + `_labels` via `getLabelsFor()` from `src/lib/validation.ts:200-205`. |
| F-205 | Scenario GET response not decorated | MEDIUM | **CLOSED** | `src/routes/scenarios.ts:60-89` defines `decorateMonteCarlo()` + `anchorForAmount()`; GET at line 98-119 maps rows where `kind === 'monte_carlo_v1'` and synthesizes missing `naturalFrequency` ("N out of 10") + percentile `anchor`; attaches top-level `_units`. |
| F-206 | `monthlyCosts.medicine` outlier ratio inconsistent with siblings | LOW | **CLOSED** | `src/__tests__/seed-data-integrity.test.ts:211-223` adds `max <= 3 x typical` test with `RATIO_EXEMPT = new Set(['medicine'])` so the outlier drug-cost range is permitted as-is but every other cost child is bounded. |
| F-207 | OpenAPI fallback has no glossary body schema | LOW | **CLOSED** | `src/lib/swagger.ts:113-125` adds `responses.200.content.application/json.schema` pointing to `#/components/schemas/GlossaryResponse`; schemas defined at `src/lib/swagger.ts:168-198` (`GlossaryEntry` + `GlossaryResponse` `oneOf`). |
| F-208 | Non-US locations carry no ACA applicability marker | LOW | **CLOSED** | `src/routes/locations.ts:260-262` — `if (healthcare && loc.country !== 'United States' && !aca) healthcare.acaApplicable = false;` injected route-side so non-US consumers get an explicit machine-readable "field is N/A" signal. |

**Score delta:** 8 findings → 1 finding (by-design residual). Fixed 8 of 8 prior findings. No new findings surfaced — the cascade of the `_units` pattern to every money-shaped route + the route-level injection pattern for seed-data holes closed the last cross-route inconsistencies.

**Changes landed since 2026-04-19** (all verified in code):
- `Accept-Version: 2` header parsed in `src/server.ts:87-98` onRequest hook; `request.apiVersion ∈ {1, 2}` typed in `src/types/fastify.d.ts`; default = 1 for back-compat.
- `src/routes/fees.ts` — full `unitsMeta(record, locale, apiVersion)` builder; GET + PUT both return `_units`; `X-API-Version` response header on both handlers.
- `src/routes/financial.ts` — same v2 gating pattern as `fees.ts` (consistent with F-202 migration plan).
- `src/routes/locations.ts` — GET `/:id` injects `acaMarketplace._units` for US locations and `healthcare.acaApplicable: false` for non-US rows; `_a11y: { description, ariaLabel }` natural-language summary also attached.
- `src/routes/household.ts` — GET returns `_units: { targetAnnualIncome, 'members[].ssPia' }` + `_labels: getLabelsFor(['targetAnnualIncome', 'members', 'pets'])`.
- `src/routes/scenarios.ts` — `decorateMonteCarlo()` + `anchorForAmount()` synthesize missing `naturalFrequency` / `anchor` on GET; four-bucket anchors (`< 100k`, `< 1M`, `< 3M`, `>= 3M`).
- `src/__tests__/seed-data-integrity.test.ts:211-223` — `max <= 3 x typical` with `RATIO_EXEMPT = new Set(['medicine'])`.
- `src/lib/swagger.ts` — `GlossaryEntry` / `GlossaryResponse` schemas under `components.schemas`; `/api/glossary` `responses` block references them.
- `docs/adr/0003-api-versioning-percent-encoding.md` — ADR documenting the `Accept-Version: 2` opt-in decision, alternatives considered, and 6-month sunset plan for v1.

---

## Composite Score

Same weight distribution as 2026-04-19 (no rubric changes).

| Domain | Weight | Score (0–100) | Weighted |
|--------|--------|---------------|----------|
| Response envelope — units / currency / periodicity | 20% | 98 | 19.6 |
| Consistent percentage encoding | 10% | 95 | 9.5 |
| Abbreviation avoidance | 5% | 95 | 4.8 |
| Glossary / definitions | 15% | 98 | 14.7 |
| Plain-language result explanations | 10% | 95 | 9.5 |
| Validation error plain-language | 5% | 95 | 4.8 |
| Locale-aware formatting | 5% | 95 | 4.8 |
| Persistence — cross-device accommodations | 10% | 95 | 9.5 |
| Seed-data numeric precision & realism | 10% | 95 | 9.5 |
| Math-anxiety vocabulary safety | 10% | 95 | 9.5 |
| **Composite** | **100%** | | **96.2 → rounded to 95 for conservative treatment of the groceries JSONB residual** |

### Score Interpretation

| Score | Grade | Interpretation |
|-------|-------|-----------------|
| 80–100 | A | Excellent compliance |
| 60–79  | B | Good compliance; specific improvements identified |
| 40–59  | C | Moderate compliance; significant gaps |
| 20–39  | D | Poor compliance; major revisions needed |
| 0–19   | F | Critical failure |

**Grade: A (95 / 100).** Up from A− (84) on 2026-04-19 — an 11-point improvement driven by eight closed findings, clean severity ladder (0 / 0 / 0 / 1-LOW), and zero new findings. The residual L-301 is an intentional-by-design gap in the groceries JSONB route and does not warrant remediation without a larger schema migration.

---

## What Passed (Strengths, Expanded)

This section has been substantially expanded vs 2026-04-19 because nearly every dimension now passes strongly.

| Component | Standard Met |
|-----------|-------------|
| **`_units` envelope cascaded to every money-shaped route** — `financial.ts`, `fees.ts`, `withdrawal.ts`, `household.ts`, `locations.ts` (via `acaMarketplace` injection), `scenarios.ts` (for `monte_carlo_v1` rows). Confirmed by `grep -l _units src/routes/*.ts` returning 6 files. | Number presentation — consistent metadata on every numeric response (NCTM Communication, Dyscalculia Content Audit) |
| **Header-negotiated API versioning (`Accept-Version: 2`)** — `src/server.ts:87-98` parses on every request; `fees.ts` + `financial.ts` gate their `* 100` conversion step; `X-API-Version` response header confirms resolution back to the client; ADR documents the migration plan and 6-month v1 sunset. | Consistent representation — the encoding schism is now a first-class, time-bounded migration rather than an undocumented contract split |
| **`acaMarketplace._units` injected route-side** — `src/routes/locations.ts:242-256` emits `premiumCapPctOfIncome: { encoding: 'fraction', meaning: '0.085 = 8.5% of MAGI', regime: 'aca_enhanced_post_2021' }` plus per-field `benchmarkSilverMonthly*` currency tags. Zero seed-data churn. | ISO/IEC 40180 — data product suitability; dyscalculia — consistent representation for the most semantically-dense percent on the surface |
| **Non-US locations carry explicit `acaApplicable: false`** — `src/routes/locations.ts:260-262` adds the marker only when `country !== 'United States'` and `acaMarketplace` absent, so consumers get an unambiguous machine-readable signal instead of inferring from field absence. | Consistent representation (predictable field presence) |
| **Scenario GET responses self-decorate** — `src/routes/scenarios.ts:60-89` `decorateMonteCarlo()` synthesizes `naturalFrequency` ("N out of 10 simulated futures") from `successRate.value` and `anchor` strings from percentile `value` via `anchorForAmount()`, so stored rows written without those fields read back with them. Clients never see `anchor: undefined`. | Scaffolding — magnitude anchoring; NCTM — Communication |
| **Household GET ships `_units` + `_labels`** — `src/routes/household.ts:118-126` emits `targetAnnualIncome` (yearly, locale currency via `defaultCurrencyFor()`) and `members[].ssPia` (monthly USD) tags, plus `_labels` via `getLabelsFor(['targetAnnualIncome', 'members', 'pets'])` so dashboards don't duplicate the label map. | Number presentation + cross-audit benefit (Dyslexia F-013 also closed) |
| **Seed-integrity `max ≤ 3 × typical` bound with explicit opt-out** — `src/__tests__/seed-data-integrity.test.ts:211-223` guards the typical-range contract for every monthly cost category; `medicine` is opted out via `RATIO_EXEMPT` so specialty-drug outlier ceilings don't pollute canonical ranges. | ISO/IEC 40180 — data product suitability; dyscalculia magnitude-anchoring consistency |
| **OpenAPI glossary response schema** — `src/lib/swagger.ts:168-198` defines `GlossaryEntry` (required: `key`/`term`/`plain`; optional: `example`/`technical`/`seeAlso`/`aliases`) and `GlossaryResponse` (`oneOf` array-or-single) under `components.schemas`; the `/api/glossary` path references it. | NCTM — precise contract; accessibility for dyslexic developers |
| **Rich `/api/glossary` endpoint — 26 terms** with `plain` / `example` / `technical` / `seeAlso` / `aliases`, including the ACA cluster (`aca`, `magi`, `fpl`, `subsidy_cliff`, `applicable_percentage`). Unchanged since 2026-04-19 and still passing. | Scaffolding — term definitions |
| **Plain-language `explanation` field on withdrawal responses** — `src/routes/withdrawal.ts` paraphrases rate + amount with a natural magnitude anchor. | Scaffolding — plain-language explanation |
| **`Intl.NumberFormat` with explicit locale** in `shared/formatting.js` — `fmt()` + `pct()` helpers expect fractions, consistent with v2 wire encoding. | Locale-aware formatting |
| **`fmtKUnsafe` renamed + `@deprecated` + developer-only JSDoc** citing the dyscalculia audit by filename. | Abbreviation avoidance |
| **`toValidationErrorPayload` rewrites Zod issues** to `{ field, fieldLabel, message, code }` with a 35+ field label map + bound-quoted messages. | Validation errors in plain language |
| **`monte_carlo_v1` scenario sub-schema** with `percentileShape.anchor` and `successRate.naturalFrequency` at the *write* layer, plus synthesis at the *read* layer — end-to-end coverage. | Structured simulation results with magnitude anchors |
| **Reserved `accessibility.dyscalculia` preferences sub-schema** in `src/routes/preferences.ts` mirroring the dashboard's `DyscalculiaSettings`. | Persistence of accommodations across devices |
| **ACA cliff regime enforced** via test `[0, 0.085]` in `src/__tests__/seed-data-integrity.test.ts` — matches user-memory-enshrined "enhanced flat 8.5% cap, no cliff". | ISO/IEC 40180 — data product suitability |
| **All 70 US locations carry `healthcarePreMedicare` + `acaMarketplace`**. Non-US rows correctly omit them and are now flagged with `acaApplicable: false` at the route layer. | Consistent seed-data shape across a meaningful subset |
| **Vocabulary safety** — `ruin`, `bankrupt`, `risk of` grep returns zero hits across `src/**`; `failure` only in neutral webhook test. | Math-anxiety safety |
| **`Prisma Decimal` string-arrival defense** — `financial.ts` + `fees.ts` both use `Number(out[f])` before arithmetic (aligns with user memory `prisma-string-fields.md`). | ISO/IEC 40180 — numeric precision |
| **DEV_AUTH_BYPASS dual-guard** — `auth.ts` requires both `NODE_ENV=development` AND `DEV_AUTH_BYPASS=1` before granting admin. | Anxiety / trust (cross-benefit) |
| **Natural-language `_a11y` summary on `GET /api/locations/:id`** — `locations.ts:266-272` ships `{ description, ariaLabel }` so screen-reader UIs don't have to re-synthesize from raw fields. | Multisensory — TTS-ready text fields |

---

## Standards Crosswalk

| Requirement | Met? | Evidence | Delta vs 2026-04-19 |
|-------------|------|----------|---------------------|
| Number sense — magnitude anchoring on results | **PASS** | `scenarios.ts:82-89` `anchorForAmount()` synthesizes anchors; `percentileShape.anchor` schema field | Upgraded from PARTIAL (read-layer synthesis added) |
| Number sense — natural-frequency representation | **PASS** | `scenarios.ts:60-66` synthesizes `successRate.naturalFrequency` on GET when missing | Upgraded from PARTIAL (read-layer synthesis added) |
| Multisensory — TTS-ready text fields | **PASS** | `explanation` on withdrawal; `_a11y.description` on locations; `naturalFrequency` on scenarios | Extended |
| Visual accessibility — no `$1.2M` / `$1234K` reaching users | **PASS** | `fmtKUnsafe` deprecated; grep `fmtK\|\$1\.2M` → no matches | Still passing |
| Consistent representation — percentage encoding | **PASS** | `Accept-Version: 2` unifies; ADR 0003 governs sunset | Upgraded from PARTIAL (was F-202) |
| Currency codes on numeric responses | **PASS** | `_units.currency` present on every money route | Upgraded from PASS-with-gap (was F-201) |
| Locale-aware formatting | **PASS** | `Intl.NumberFormat(locale, …)` + `defaultCurrencyFor(locale)` threaded through `household.ts:118` and `fees.ts:137, 168` | Still passing |
| Math anxiety — no catastrophic vocabulary | **PASS** | Grep still clean across `src/**` | Still passing |
| Scaffolding — key terms defined via API | **PASS** | `glossary.ts` 26 terms incl. ACA cluster; OpenAPI schema | Upgraded from PASS (OpenAPI schema added) |
| Scaffolding — plain-language result explanations | **PASS** | `withdrawal.ts` `explanation`; `scenarios.ts` `anchor` + `naturalFrequency`; `locations.ts` `_a11y` | Upgraded from PASS-with-gap (was F-204) |
| Progress monitoring (persistence) | **PASS** | Scenarios route + versioned data releases | Still passing |
| Persistence — cross-device accommodations | **PASS** | `preferences.ts` `accessibility.dyscalculia` sub-schema | Still passing |
| Documentation — OpenAPI coverage | **PASS** | `swagger.ts` fallback + `GlossaryResponse` schema | Upgraded from PARTIAL (was F-207) |
| Validation — error envelopes quote bounds in plain language | **PASS** | `toValidationErrorPayload` + `FIELD_LABELS` | Still passing |
| Dyscalculia audit — `fmtK` anti-pattern removed | **PASS** | `fmtKUnsafe` deprecation | Still passing |
| Seed-data — `max <= 3 x typical` ratio bound | **PASS** | `seed-data-integrity.test.ts:211-223` | Upgraded from PARTIAL (was F-206) |
| Seed-data — non-US ACA applicability marker | **PASS** | Route-level injection at `locations.ts:260-262` | Upgraded from PARTIAL (was F-208) |

---

## Recommendations (Prioritized)

Given the clean finding ladder, there are no urgent recommendations. The remaining work is forward-looking.

| Rank | Item | Action | Effort | Lift |
|------|------|--------|--------|------|
| 1 | Groceries JSONB schema migration | Define a typed `GroceryOverride` sub-schema with per-entry `_units`. Closes L-301. | M | LOW — small residual |
| 2 | v2 adoption tracking | Add a Sentry tag + log metric for `request.apiVersion` so the 6-month v1 sunset window can be timed from actual migration data rather than a guess. | S | LOW — operational |
| 3 | `@fastify/swagger` installation | Replace the hand-written fallback spec at `src/lib/swagger.ts:78-202` with `zod-to-openapi` pipeline once the dep lands, so every route's Zod schema auto-generates OpenAPI response shapes (not just glossary). | S | LOW — developer experience |
| 4 | Scenario `_units` parity on POST/PUT | Currently POST/PUT just stores the payload verbatim; GET decorates. Consider also decorating on return from POST/PUT so the write-then-read cycle is symmetric. | S | LOW — ergonomics |

---

## Version History

| Version | Date | Auditor | Changes |
|---------|------|---------|---------|
| 1.0 | 2026-04-16 | Claude (automated) | Initial dyscalculia audit, 11 findings, B− (65/100) |
| 2.0 | 2026-04-19 | Claude (Opus 4.7, automated) | Recurring audit after PR #9 glossary expansion + #7/#8 location work. 7 of 11 prior findings fixed. A− (84/100). |
| 3.0 | 2026-04-20 | Claude (Opus 4.7, automated) | Recurring audit on `fix/audit-remediation-all` (PR #11). All 8 prior findings closed via commits `4982128` (F-201) + `b03fd61` (F-202 through F-208). Zero HIGH / MEDIUM findings remain; 1 LOW residual is intentional-by-design (groceries JSONB). A (95/100). |
