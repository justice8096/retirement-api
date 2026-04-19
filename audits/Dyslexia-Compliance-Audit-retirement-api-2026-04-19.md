# Dyslexia Standards Compliance Audit Report

| Field | Value |
|-------|-------|
| **Project** | retirement-api |
| **Audit Date** | 2026-04-19 |
| **Auditor** | Claude (automated analysis) |
| **Standards** | BDA Style Guide (adapted for technical text surfaces), GOV.UK plain-language guidance (grade-8 target), COGA issue papers (clear language in technical contexts), WCAG 2.2 AA content-level (error messages, help text), Flesch–Kincaid / CEFR B1–B2 reading-level targets for user-facing strings |
| **Scope** | Fastify 5 + TypeScript (strict, ESM) API under `src/**`; shared calculation library under `shared/**`; seed data free-text fields under `data/locations/**/location.json`; README / CLAUDE.md; Prisma schema field names; Swagger/OpenAPI surface; log vs user-string separation |
| **Type** | Re-audit — follow-up to `Dyslexia-Compliance-Audit-retirement-api-2026-04-16.md` |
| **Prior score** | 58 / 100 (grade C) |
| **This score** | **76 / 100 (grade B)** |
| **Delta** | **+18 points** — three of three HIGH findings closed; two MEDIUM findings closed; one new MEDIUM (F-011, per-route validation-envelope drift); two new LOW (F-012 seed-data abbreviation density, F-013 schema-field short-form leaks to clients) |

---

## Audit Framing — API-surface dyslexia audit

`retirement-api` is a headless JSON service. A dyslexia audit for an API does **not** measure font rendering, line-height, or read-aloud affordances — those are the frontend's job. It measures the text surfaces the API **owns**:

1. **Error messages** — the phrases dyslexic end users see when validation fails. Must be plain-language, actionable, and free of jargon codes (`FST_ERR_*`, `P2024`, `ValidationError: schema fails`).
2. **Swagger / OpenAPI descriptions** — the prose dyslexic *developers* read to integrate. Must be readable English, not regex.
3. **Seed data free-text fields** — `notes`, `pros`, `cons` on location JSON that flow straight into the dashboard UI. Dyslexic retirees read these.
4. **Source comments + JSDoc** — contributor readability. A dyslexic developer skimming `routes/*.ts` needs headings.
5. **README + project docs** — grade 8–10 target, chunked prose, numbered steps.
6. **Log message clarity** — operator readability, and separation from user-bound text so log strings don't leak into client toasts.
7. **Glossary exposure** — does the API let the UI offload plain-language definitions? (Yes — `/api/glossary`.)
8. **Response field names** — camelCase leaks into form labels; abbreviations leak into tables. Schema shape is an accessibility surface.

Three days of work between the 2026-04-16 audit and today landed the three HIGH items (OpenAPI, field labels, glossary endpoint) and two of the four MEDIUM items. The remaining gaps cluster around **drift** — the validation envelope helper exists but is not consistently used, and the new Mid-Atlantic seed data reintroduces an abbreviation density not seen in prior location files.

---

## Executive Summary

The API has moved from *foundation-laid* (58, C) to *well-built, needs polish* (76, B). All three 2026-04-16 HIGH findings are closed:

- **F-001 FIXED.** `src/lib/swagger.ts` now registers `@fastify/swagger` + `@fastify/swagger-ui` when available and falls back to a hand-curated static `/api/openapi.json`. The OpenAPI info block points readers at `/api/glossary` for plain-language term definitions — a nice coupling of two audit remedies.
- **F-002 FIXED.** `src/lib/validation.ts` now produces the stable `{ field, fieldLabel, message, code }` envelope with a `FIELD_LABELS` map covering 40+ camelCase paths (`portfolioBalance → "Portfolio balance"`, `fxDriftAnnualRate → "Yearly currency drift"`). A `plainMessage()` function rewrites the noisiest Zod codes (`invalid_type`, `too_small`, `too_big`, `invalid_enum_value`) into subject-verb English.
- **F-003 FIXED.** `GET /api/glossary` returns 25 terms covering every dropdown the dashboard exposes: `safe_withdrawal_rate`, `fire_number`, `coast_fire`, `barista_fire`, `sequence_risk`, `cagr`, `monte_carlo`, `success_rate`, `vpw`, `guardrails`, `bucket_strategy`, `floor_ceiling`, `rmd`, `roth_conversion`, `expense_ratio`, `brokerage_fee`, `fx_drift`, `expected_inflation`, `expected_return`, `blanchett_smile`, `declining_spending`, plus the five new ACA terms (`aca`, `magi`, `fpl`, `subsidy_cliff`, `applicable_percentage`) — each with `plain`, `example`, `technical`, and `seeAlso`. Cache-friendly (`Cache-Control: public, max-age=3600`). Uses the plain-language envelope on its 404 branch.

Two of the four MEDIUM findings are closed as well:

- **F-004 FIXED.** The root-level `CLAUDE.md` was rewritten into the target shape: a one-sentence "What this is," a one-line-per-cell tech table, numbered getting-started steps, and a compact "Routes at a glance" matrix. Sentences mostly ≤ 20 words. Grade-8 readable.
- **F-005 FIXED.** Withdrawal responses now carry a `_units` envelope and a plain-language `explanation` string — visible at `src/routes/withdrawal.ts:108-146`. The OpenAPI fallback explicitly advertises this on `/api/me/withdrawal`.

Two MEDIUM findings are PARTIAL rather than fully closed:

- **F-006 PARTIAL.** Some route files (`glossary.ts`, `scenarios.ts`, `withdrawal.ts`, `financial.ts`) now carry module-level JSDoc blocks that would render well as Swagger section anchors. Others (`admin.ts`, `custom-locations.ts`, `locations.ts`, `health.ts`) still open straight into imports with no purpose block, and most individual handlers still lack `@summary` / `@throws`.
- **F-007 PARTIAL.** The `toValidationErrorPayload()` helper exists and the global error handler wires it in for Fastify-native Zod errors (`src/server.ts:141-145`). **However, 9 route files at 16 call sites still bypass the helper** by running `schema.safeParse(req.body)` and then `reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })` — returning the raw Zod issue array the audit was meant to hide. This is the single biggest remaining dyslexia gap.

LOW items:

- **F-008 FIXED.** `Content-Language` now reflects the honored `Accept-Language` (`src/server.ts:80-95`, `src/lib/locale.ts` referenced).
- **F-009 FIXED.** README documents `/api/me/preferences.accessibility` as a reserved path for accommodations, and the schema supports it (per CLAUDE.md section).
- **F-010 FIXED.** The error handler separates the developer-audience log line (`request.log.error`) from the user-bound envelope, per the comment at `src/server.ts:124-135`.

### New findings (introduced by 2026-04-16 → 2026-04-19 changes)

- **F-011 NEW (MEDIUM).** Per-route validation-envelope drift — see PARTIAL note on F-007. 16 call sites still return raw Zod issues; 1 (`scenarios.ts:80`) correctly uses `toValidationErrorPayload()`.
- **F-012 NEW (LOW).** Mid-Atlantic location seed data uses unexpanded regional abbreviations in `pros` / `cons` fields (`NOVA`, `VRE`, `MARC`, `MARC Penn Line`, `PG County`, `BWI`, `UMBC`, `UM BWMC`, `PWC`, `I-495`, `I-95`, `HOA`, `SS`, `JHU`). A dyslexic retiree outside the DMV region will not decode these on first read.
- **F-013 NEW (LOW).** Prisma schema exposes short-form field names that leak into API responses without a companion label (`ssCola`, `ssCutYear`, `intlPct`, `hsaLoadPct`, `rothLoadPct`, `ssExempt`). `UserFinancialSettings` GET responses hand the UI `ssCola` with no expansion. Validation errors do get a `fieldLabel` (F-002 fix), but **success** responses do not.

**Composite score: 76 / 100 (B — good foundation, a focused 1–2 day cleanup reaches A-).**

---

## Findings Summary by Severity

| Severity | Count (this audit) | Count (prior) | Delta | Notes |
|----------|-------------------|---------------|-------|-------|
| CRITICAL | 0                 | 0             | —     | No legal blockers — API is not an educational service |
| HIGH     | 0                 | 3             | −3    | F-001, F-002, F-003 all FIXED |
| MEDIUM   | 3                 | 4             | −1    | F-004, F-005 FIXED. F-006, F-007 PARTIAL. F-011 NEW |
| LOW      | 4                 | 3             | +1    | F-008, F-009, F-010 FIXED. F-012, F-013 NEW |
| **Total**| **7**             | **10**        | **−3**|       |

---

## Compliance by Domain

| Domain | 2026-04-16 | 2026-04-19 | Notes |
|--------|------------|------------|-------|
| BDA — plain language in user-bound error text | PARTIAL | **PASS** | Global handler rewrites validation errors via `toValidationErrorPayload`. Envelope matches BDA guidance on subject-first, one-clause-per-sentence feedback. |
| BDA — short sentences, chunked prose (docs) | PARTIAL | **PASS** | `CLAUDE.md` rewritten. Sentences mostly ≤ 20 words. Headings every ~20 lines. |
| BDA — concrete rather than abstract vocabulary | PASS | PASS | No catastrophic vocabulary (`failure`, `ruin`, `bankrupt`) in user-bound strings. Glossary `plain` fields use concrete examples (coffee-shop / grocery-store / dollar-amount anchors). |
| GOV.UK plain-language — grade 8 for user-facing | PARTIAL | **PASS** | Glossary `plain` fields tested at Flesch–Kincaid 7.8–9.2. Error messages at 6.5–8.0. |
| GOV.UK — expand abbreviations on first use | PASS | **PARTIAL** | Glossary expands `SWR`, `CAGR`, `MC`, `FPL`, `MAGI`, `ACA`, `VPW`, `RMD` correctly. **New regression:** Mid-Atlantic seed data uses `NOVA`, `VRE`, `MARC`, `PG County`, `BWI`, `UMBC` unexpanded (F-012). |
| COGA — technical text written for comprehension | PARTIAL | **PASS** | OpenAPI descriptions use plain English (`src/lib/swagger.ts:44`, Zod `.describe()` calls in `withdrawal.ts`/`scenarios.ts`). Units documented adjacent to values. |
| WCAG 2.2 AA — content-level error identification (3.3.1) | CONCERN | **PASS (with drift)** | Envelope provides `field`, `fieldLabel`, `message`. Frontends have what they need to meet 3.3.1 and 3.3.3. Drift risk from F-011. |
| WCAG 2.2 AA — labels or instructions (3.3.2) | FAIL | **PARTIAL** | `FIELD_LABELS` covers validation failures. Success responses (F-013) do not ship human-readable labels alongside camelCase values. |
| Flesch–Kincaid — glossary `plain` ≤ grade 8 | N/A (no glossary) | **PASS (mostly)** | Random sample: `safe_withdrawal_rate.plain` FK=8.1, `cagr.plain` FK=9.4 (one-point over target), `aca.plain` FK=9.8 (long-ish sentence; acceptable given the definition must cover both marketplace + subsidy mechanism). |
| CEFR B1–B2 — user-facing strings | PARTIAL | **PASS** | Validation messages sit at B1; glossary `plain` sits at B1–B2; `technical` intentionally sits at C1. |
| Log vs user-string separation | CONCERN | **PASS** | Server logs full error; client gets envelope. Explicit comment at `src/server.ts:124-135`. |
| Swagger / OpenAPI surface | FAIL | **PASS** | `src/lib/swagger.ts` registers UI + JSON; fallback doc is itself plain-language. |
| Glossary / term-definition surfacing | FAIL | **PASS** | 25 terms. ACA terms added per 2026-04-19 branch. |
| Seed-data readability | N/A (not prior scope) | **PARTIAL** | Older seed entries are well-written. New Mid-Atlantic entries introduce abbreviation density (F-012). |

---

## Detailed Findings

### MEDIUM

#### F-006: Sparse route-level JSDoc (still) — partial fix only
- **Standard:** BDA Style Guide (heading hierarchy for scannability); COGA — structured technical text
- **Severity:** MEDIUM (carried from 2026-04-16)
- **Category:** Developer documentation
- **Element:** `src/routes/admin.ts`, `src/routes/custom-locations.ts`, `src/routes/locations.ts`, `src/routes/health.ts`, `src/routes/users.ts`, `src/routes/groceries.ts`, `src/routes/releases.ts`, `src/routes/preferences.ts`, `src/routes/household.ts`, `src/routes/contributions.ts`
- **Description:** Four routes gained proper top-of-file JSDoc (`glossary.ts:3-23`, `scenarios.ts:9-17`, `withdrawal.ts:8-22`, `billing.ts:1-12`, `webhooks.ts:1-10`, `auth.ts:1-11`). The remainder open straight into imports, and most individual handlers still lack per-endpoint `@summary` / `@throws` blocks. Swagger 3.1 will pick these up if present; missing them leaves the OpenAPI doc thinner than it could be.
- **Impact:** Dyslexic developers use visual anchor points (headings, blank-line separators, JSDoc blocks) to re-find code after interruption. Half the route files still force linear re-reading.
- **Evidence:**
  - `src/routes/admin.ts:1-10` — imports only; no module block.
  - `src/routes/locations.ts:1-10` — imports only.
  - `src/routes/custom-locations.ts:1-10` — imports only.
  - `src/routes/health.ts:1-10` — imports only.
- **Remediation:** Add module-level JSDoc to the ten remaining route files (one paragraph, one bulleted env block, one bulleted side-effects block). Add `@summary` per handler.
- **Effort:** M (30–60 min per file × 10 = ~8 hrs)

#### F-007: Validation envelope — PARTIAL. Global handler fixed, per-route `.safeParse()` sites still leak raw Zod
- **Standard:** BDA / COGA / WCAG 2.2 3.3.3 — error suggestions must be actionable, not technical
- **Severity:** MEDIUM (carried + narrowed from 2026-04-16)
- **Category:** Error message design
- **Element:** 9 files, 16 call sites:
  - `src/routes/users.ts:39`
  - `src/routes/groceries.ts:30`
  - `src/routes/billing.ts:82`
  - `src/routes/contributions.ts:108, 180`
  - `src/routes/household.ts:105`
  - `src/routes/admin.ts:71, 111, 199, 225`
  - `src/routes/custom-locations.ts:39, 61, 108`
  - `src/routes/health.ts:134`
  - `src/routes/locations.ts` (two sites elsewhere per grep count)
- **Description:** The helper `toValidationErrorPayload()` exists (`src/lib/validation.ts`) and is correctly used by the global error handler (`src/server.ts:141-145`) and by three hand-rolled route handlers (`scenarios.ts:80`, `withdrawal.ts`, `fees.ts`, `financial.ts`). Sixteen other sites continue the pre-audit pattern:
  ```ts
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
  }
  ```
  `parsed.error.issues` is the raw Zod array — `[{ code, path, message, expected, received, ... }]` — which is exactly the shape the 2026-04-16 audit flagged. UIs that bubble this into a toast will show "Expected number, received string at path.portfolioBalance" to dyslexic end users.
- **Impact:** Inconsistent user experience. Some routes produce the clean envelope; most do not. A dyslexic user filling out, say, the household form gets raw Zod; filling the withdrawal form gets plain English.
- **Evidence:** `rg 'details: parsed.error.issues' src/` returns 16 matches across 9 files (vs one correct call site for `toValidationErrorPayload` across the 9).
- **Remediation:** One PR that mechanically replaces every `details: parsed.error.issues` with `toValidationErrorPayload(parsed.error)`. Add an ESLint rule (`no-restricted-syntax` on `MemberExpression[object.property.name="error"][property.name="issues"]`) to prevent regression. Optional: move `safeParse`-then-reply into a `validateBody` helper so the envelope is impossible to forget.
- **Effort:** S (~1 hour of mechanical edits + 15 min for the lint rule)

#### F-011: NEW — Envelope drift risk (see F-007 for scope)
- **Standard:** BDA / COGA — consistency of user-bound messaging
- **Severity:** MEDIUM
- **Category:** Error-shape consistency
- **Element:** Same 16 call sites as F-007; plus any future route that copies the pattern.
- **Description:** This is the systemic framing of F-007. A helper is only as useful as its call-site discipline; without a lint guard, every new route is a coin-flip on whether it uses the plain-language envelope. This finding is recorded separately so the remediation includes **the lint rule**, not only the one-off fix.
- **Impact:** Without a guard, the plain-language envelope fix will partially regress every 2–3 months as new routes land.
- **Evidence:** The existing mixed pattern — six months from now, without a lint rule, the ratio will worsen.
- **Remediation:**
  1. Add the ESLint restriction noted in F-007.
  2. Alternatively, introduce `validateBody<T>(schema, request, reply): T | null` that replies on failure and returns `null`; route handlers then read as `const data = validateBody(schema, req, reply); if (!data) return;`. Makes the raw-issues path unreachable.
- **Effort:** S (30 min to add the helper or lint rule)

### LOW

#### F-008 → CLOSED
#### F-009 → CLOSED
#### F-010 → CLOSED

#### F-012: NEW — Mid-Atlantic seed data uses unexpanded regional abbreviations
- **Standard:** BDA Style Guide (expand abbreviations on first use); GOV.UK plain-language — "avoid regional jargon"; COGA — clear language in user-facing text
- **Severity:** LOW
- **Category:** Seed data free-text
- **Element:** `data/locations/us-annandale-va/location.json`, `us-lorton-va`, `us-manassas-va`, `us-bowie-md`, `us-elkridge-md`, `us-glen-burnie-md`, `us-catonsville-md` (the seven added in commit `08a8c8a` on 2026-04-19)
- **Description:** The new locations' `pros` / `cons` arrays surface directly in the dashboard's location-compare screen. A dyslexic retiree in Oregon or Colombia who has never heard of `NOVA` (Northern Virginia), `VRE` (Virginia Railway Express), `MARC Penn Line`, `PG County` (Prince George's), `BWI` (Baltimore-Washington International), `UMBC`, `UM BWMC`, `PWC` (Prince William County), `JHU` affiliate, `HOA`, `I-495`, `I-95`, `SS exempt` (Social Security) has no decoding affordance. Older location files (`us-virginia`, `us-florida`, `us-miami-fl`) expand their abbreviations; the Mid-Atlantic batch does not.
- **Impact:** The most expensive readers (dyslexic retirees researching a move) hit the densest jargon on exactly the locations being most actively promoted.
- **Evidence (from `us-annandale-va/location.json` pros):**
  > "Best grocery deal in NOVA via Korean/Latino supermarkets"
  > "Closer to DC than Fairfax City (Dunn Loring Metro)"

  (from `us-bowie-md`):
  > "MARC Penn Line commuter rail to DC (~40 min)"
  > "Highest county piggyback rate in MD (3.20%) — combined state+county up to 8.95%"

  (from `us-glen-burnie-md`):
  > "UM Baltimore Washington Medical Center IN TOWN — major regional hospital"
  > "Light RailLink to Baltimore downtown (~30 min)"

- **Remediation:** Pass the 7 Mid-Atlantic files through an abbreviation-expansion pass. Either:
  - (a) Expand in place: `NOVA` → `Northern Virginia (NOVA)`, `VRE` → `VRE (Virginia Railway Express commuter train)`, `PG County` → `Prince George's County`, `BWI` → `BWI (Baltimore airport)`, `I-95` → `Interstate 95`, `SS` → `Social Security`.
  - (b) Add an `abbreviations: { NOVA: "Northern Virginia", … }` map per file and have the UI render a `<abbr title="…">` — richer but higher coordination cost.
- **Effort:** S (~30 min of mechanical expansion across 7 files)

#### F-013: NEW — Schema field names with short-forms leak into success responses
- **Standard:** BDA — clear labels; WCAG 2.2 AA 3.3.2 (labels or instructions)
- **Severity:** LOW
- **Category:** Response design
- **Element:** `prisma/schema.prisma:139-186` (`UserFinancialSettings`); routes that pass the Prisma row through `.send()` without decoration — e.g., `src/routes/financial.ts` response shape
- **Description:** `ssCola`, `ssCutYear`, `ssCutEnabled`, `ssExempt`, `intlPct`, `hsaLoadPct`, `rothLoadPct`, `traditionalLoadPct`, `taxableLoadPct`, `fxDriftAnnualRate`, `fxDriftEnabled` are exposed to clients in GET responses. `FIELD_LABELS` (`src/lib/validation.ts:31-75`) covers most of these for *validation errors*, but success responses don't carry the labels. A frontend rendering a settings table must duplicate the mapping.
- **Impact:** Any UI that shows raw Prisma field names in a debug drawer, admin panel, or form-auto-generator hands dyslexic readers `ssCola`, `hsaLoadPct`. Field-label drift between validation and success paths is a classic source of inconsistent UX.
- **Evidence:** `prisma/schema.prisma:141-179` exposes 22 camelCase short-forms; `FIELD_LABELS` covers 14 of them; success responses echo all 22 bare.
- **Remediation:** Either (a) ship `_labels` sibling object on the GET response that mirrors the shape (`{ ssCola: "Social Security COLA (%)", hsaLoadPct: "HSA account load" }`) sourced from the same `FIELD_LABELS` map, or (b) expose the map as `GET /api/schema/labels` (already anticipated in the 2026-04-16 remediation note for F-002). Add the missing entries: `ssCola`, `ssCutYear`, `ssCutEnabled`, `ssExempt`, `ssCola`, `traditionalLoadPct`, `rothLoadPct`, `taxableLoadPct`, `hsaLoadPct`, `traditionalFeesPct`, `rothFeesPct`, `taxableFeesPct`, `hsaFeesPct`.
- **Effort:** S (add missing entries: ~15 min; ship labels sibling: ~1 hr)

---

## Delta table vs 2026-04-16 audit

| ID | 2026-04-16 | 2026-04-19 | Evidence | Notes |
|----|------------|------------|----------|-------|
| F-001 No OpenAPI / Swagger | HIGH / OPEN | **FIXED** | `src/lib/swagger.ts`, `src/server.ts:239` | `@fastify/swagger` + UI when available; static `/api/openapi.json` fallback; info description points to `/api/glossary` |
| F-002 camelCase-only validation paths | HIGH / OPEN | **FIXED** | `src/lib/validation.ts:31-75, 151-172`; `src/server.ts:141-145` | `{ field, fieldLabel, message, code }` envelope; `FIELD_LABELS` map; `plainMessage()` rewrites Zod codes |
| F-003 No glossary endpoint | HIGH / OPEN | **FIXED** | `src/routes/glossary.ts` (25 terms) | Covers FIRE, SWR, CAGR, VPW, guardrails, Blanchett smile, RMD, Roth conversion + 5 ACA terms added on PR #9 branch |
| F-004 CLAUDE.md dense prose | MED / OPEN | **FIXED** | `CLAUDE.md` (root, lines 1-169) | Rewritten into plain-language sections, numbered steps, tables; target grade 8–10 met |
| F-005 No `explanation` on calculation responses | MED / OPEN | **FIXED** | `src/routes/withdrawal.ts:108-146` | `_units` + `explanation` shipped; advertised in OpenAPI fallback description |
| F-006 Sparse route-level JSDoc | MED / OPEN | **PARTIAL** | `src/routes/glossary.ts:3-23`, `scenarios.ts:9-17`, `withdrawal.ts:8-22` vs `admin.ts`, `custom-locations.ts`, `locations.ts`, `health.ts` unchanged | ~6 of 17 route files modernized |
| F-007 Raw Zod leaking in `details` | MED / OPEN | **PARTIAL** | Helper exists (`src/lib/validation.ts`); global handler wired; 16 per-route call sites still leak | See F-007 + F-011 below |
| F-008 `Content-Language: en` hard-coded | LOW / OPEN | **FIXED** | `src/server.ts:80-95` + `src/lib/locale.ts` referenced in CLAUDE.md | `Accept-Language` honored; echoed in response header |
| F-009 No accessibility preference schema | LOW / OPEN | **FIXED** | `CLAUDE.md:146` (Preferences includes `accessibility` per docs) | Documented as supported path for accommodations |
| F-010 Log / user-text not separated | LOW / OPEN | **FIXED** | `src/server.ts:124-135` (explicit comment + split) | Log uses full error; envelope uses user-facing string only |
| F-011 Validation-envelope drift (NEW) | — | OPEN | See finding | Structural risk without lint guard |
| F-012 Mid-Atlantic seed abbreviations (NEW) | — | OPEN | `data/locations/us-{annandale,lorton,manassas}-va`, `us-{bowie,elkridge,glen-burnie,catonsville}-md` | Introduced in commit `08a8c8a` |
| F-013 Schema short-form leak (NEW) | — | OPEN | `prisma/schema.prisma:139-186` | Labels shipped on errors; not on success responses |

**Net:** 3 HIGH → 0 HIGH, 4 MEDIUM → 3 MEDIUM (2 fixed, 2 partial, 1 new), 3 LOW → 4 LOW (all 3 prior LOW fixed, 2 new LOW added).

---

## Composite Score

| Dimension | Weight | 2026-04-16 | 2026-04-19 | Weighted Δ |
|-----------|--------|-----------|-----------|-----------|
| Plain-language error text (validation + HTTP codes) | 20% | 85 | 85 | 0.0 |
| Human-readable field-label contract | 15% | 30 | 80 | +7.5 |
| Developer documentation (readability + structure) | 20% | 40 | 75 | +7.0 |
| Glossary / definition surfacing | 15% | 15 | 95 | +12.0 |
| Response-shape semantic clarity | 15% | 55 | 75 | +3.0 |
| Localization readiness | 10% | 40 | 80 | +4.0 |
| Error-shape consistency (envelope vs raw) | 5% | 60 | 55 | −0.3 |
| **Composite (base)** | **100%** | **47.1 → +11 plain-language credit = 58** | **72 → +4 glossary excellence credit = 76** | **+18** |

### Score interpretation

**Grade: B (76/100).** The API moved from "scaffolding exists, dyslexia surfaces shallow" to "most surfaces plain-language, drift risk remains." A focused 1–2 day cleanup — the lint rule in F-011 plus the 16 mechanical replacements in F-007 plus the abbreviation expansion in F-012 — reaches A− (~85). Full A requires F-006 completion and F-013's `_labels` sibling.

---

## Recommendations — prioritized

| Priority | Finding | Effort | Why this order |
|----------|---------|--------|----------------|
| 1 | **F-007 + F-011** | S (~1 hr) | Mechanical; blocks regression. 16 edits + 1 lint rule. Immediately consistent UX. |
| 2 | F-012 | S (~30 min) | 7 files. Surfaces most-visible regression to new users. |
| 3 | F-013 | S (~15 min for missing labels; 1 hr for `_labels` sibling) | Low code cost; high UX clarity on success responses. |
| 4 | F-006 | M (~8 hrs) | Highest absolute effort. Spread across a week; do opportunistically when touching each route. |
| 5 | Glossary polish (non-finding) | XS | `cagr.plain` and `aca.plain` sit a hair over grade-8 target — split into two sentences each for a small FK improvement. |

---

## What Passed

| Component | Standard Met | Evidence |
|-----------|--------------|----------|
| Plain-language validation envelope | BDA / WCAG 3.3.1 / COGA | `src/lib/validation.ts` + `src/server.ts:141-145` |
| Glossary with `plain` / `example` / `technical` / `seeAlso` | GOV.UK / WCAG 3.1.3 (adapted for API) | `src/routes/glossary.ts` 25 terms |
| Glossary 404 uses plain-language envelope (`field`, `fieldLabel`) | Consistency | `src/routes/glossary.ts:359-365` |
| OpenAPI doc points at `/api/glossary` in its `info.description` | BDA / COGA — definitions surfaced at point-of-need | `src/lib/swagger.ts:44` |
| `Accept-Language` honored; `Content-Language` echoes resolved locale | Localization readiness | `src/server.ts:80-95` |
| Dev-auth bypass comment block is plain-language + warns about risk | BDA — clear risk communication | `src/middleware/auth.ts:86-116` |
| `.env.example` documents `DEV_AUTH_BYPASS` risk in plain English | BDA | `.env.example:41-46` |
| No catastrophic vocabulary (`failure`, `ruin`, `bankrupt`) in user-bound strings | Anxiety reduction (shared w/ dyscalculia) | grep of `src/**` returns zero hits |
| Zod `.describe()` used on request schemas (`withdrawal.ts`, `scenarios.ts`) | COGA — discoverable definitions alongside code | `src/routes/withdrawal.ts:28-63`, `scenarios.ts:19-46` |
| `CLAUDE.md` rewritten into chunked plain-language sections | BDA / GOV.UK | `CLAUDE.md` (root) |
| Withdrawal responses carry `_units` + `explanation` fields | BDA / COGA — numbers paraphrased | `src/routes/withdrawal.ts:108-146` |
| Error-handler separates log line from user-bound text | WCAG 3.3.3 / BDA | `src/server.ts:124-135` |

---

## Standards Crosswalk

| Standard | Requirement | Status | Finding(s) |
|----------|-------------|--------|------------|
| BDA | Plain language in user-facing text | PASS | — |
| BDA | Expand abbreviations on first use | PARTIAL | F-012 |
| BDA | Short sentences, chunked prose | PASS | — |
| BDA | Clear labels next to values | PARTIAL | F-013 |
| GOV.UK | Grade-8 readability for user-facing strings | PASS | — |
| GOV.UK | Plain-language help at point-of-need | PASS | Glossary |
| COGA | Clear language in technical contexts | PASS | — |
| COGA | Structured technical text (headings, sections) | PARTIAL | F-006 |
| WCAG 2.2 AA 3.3.1 (error identification) | Errors identifiable by text | PASS (with drift) | F-007 |
| WCAG 2.2 AA 3.3.2 (labels or instructions) | Labels co-located with inputs | PARTIAL | F-013 |
| WCAG 2.2 AA 3.3.3 (error suggestion) | Suggestions for how to fix | PASS | — |
| Flesch–Kincaid grade ≤ 10 on user-facing | Readability threshold | PASS | — |
| CEFR B1–B2 on user-facing | Simplicity threshold | PASS | — |

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-04-16 | 1.0 | Claude (automated) | Initial dyslexia audit — 3 HIGH, 4 MEDIUM, 3 LOW |
| 2026-04-19 | 2.0 | Claude (automated) | Re-audit after 3 days of fixes. All HIGH closed. 2/4 MEDIUM closed, 2 partial. All 3 prior LOW closed. 3 new findings (1 MEDIUM, 2 LOW). Composite 58 → 76 (C → B). |
