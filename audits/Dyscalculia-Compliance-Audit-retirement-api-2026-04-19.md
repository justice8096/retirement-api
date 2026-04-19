# Dyscalculia Compliance Audit Report

| Field | Value |
|-------|-------|
| **Project Name** | retirement-api |
| **Audit Date** | 2026-04-19 |
| **Auditor** | Claude (Opus 4.7, automated analysis) |
| **Standards Audited** | Dyscalculia Content Audit Framework (10 dimensions, adapted for API surface), NCTM Process Standards (Communication, Representation) — precise contractual communication, ISO/IEC 40180 (software-product-quality analog) — consistency + precision of numeric data |
| **Scope** | Fastify 5 + TypeScript API under `src/routes/**`, `src/lib/**`, `src/middleware/**`; Prisma schema; shared numeric helpers under `shared/**`; seed location JSON under `data/locations/**`; OpenAPI/Swagger registration under `src/lib/swagger.ts`. |
| **Audit Type** | Recurring — supersedes `Dyscalculia-Compliance-Audit-retirement-api-2026-04-16.md` |
| **Prior Audit Composite** | 65 / 100 (B−) |

---

## Audit Framing

This is an **API-surface dyscalculia audit**. A backend API cannot render manipulatives, adjust colour contrast, or calm a user's breathing — but it is the upstream source of every number a dyscalculic end user eventually sees. If the contract ships bare floats with no units, no currency, no periodicity, no magnitude anchors, no plain-language explanation, every downstream UI inherits those gaps and dyscalculic users pay the price no matter how accommodating the UI tries to be.

The audit evaluates `retirement-api` against the dyscalculia dimensions that map cleanly onto an API contract:

1. **Response-envelope number precision & units** — does the API pair raw numbers with currency / periodicity / encoding? (`{ amount, currency, period }` rather than bare floats)
2. **`_units` / `_display` / `_anchor` hints on money-shaped fields** so dyscalculia-aware clients can render without guessing.
3. **Consistent percentage encoding** across routes (0.04 vs 4 vs "4%").
4. **Glossary endpoint** exposing plain-language definitions of financial terms.
5. **Plain-language `explanation` fields** paired with raw numbers (scaffolding).
6. **Validation-error envelopes** that quote specific numeric bounds in plain language instead of raw Zod output.
7. **Locale-aware number formatting readiness** in shared helpers.
8. **Cross-device accommodation persistence** via a reserved preferences sub-schema.
9. **Abbreviation avoidance** — no `$1.2M`/`$1234K` output reaching a client.
10. **Seed-data numeric realism + precision consistency** — do Prisma Decimal fields arrive predictably? Do seed locations model realistic magnitudes?

Education-specific IDEA / §504 compliance (IEP services, classroom CRA, RTI documentation) is **N/A** for a backend API and is omitted from scoring rather than scored as failures.

---

## Executive Summary

Between 2026-04-16 and 2026-04-19 the API landed the full first wave of dyscalculia remediation: a real `/api/glossary` endpoint with 26 terms (up from 0), a `_units` envelope on the two most number-dense routes (`financial.ts`, `withdrawal.ts`), a plain-language `explanation` field on withdrawal responses, a structured `monte_carlo_v1` sub-schema for scenario results, `Intl.NumberFormat` with per-locale `fmt()` / `pct()` helpers, `fmtKUnsafe` renamed with a deprecation notice and developer-only JSDoc, a reserved `accessibility.dyscalculia` preferences sub-schema, and a `toValidationErrorPayload` helper that rewrites every Zod issue into `{ field, fieldLabel, message }` with explicit bounds. The underlying whole-number-percent vs decimal-fraction schism on the wire still exists — `financial.ts` ships 60/7/2.5, `withdrawal.ts` and `fees.ts` (as DB) ship fractions — but it is now fully documented via `_units.meaning` fields that clients can read. What remains open: `fees.ts` has **not** yet grown a `_units` envelope (the only money-route to still ship bare numbers); location JSONs still carry no per-field `currency` / `period` meta (a single top-level `currency` is implicit across all cost children); and the ACA-enhanced regime is modelled consistently across all 70 US locations (`premiumCapPctOfIncome: 0.085`) — but none of the non-US locations carry a `healthcarePreMedicare` block, which is correct by design yet worth flagging as an explicit gap should the product ever expand ACA-like logic beyond the US.

**Composite score: 84 / 100 (A − — strong compliance with two targeted gaps).**

### Findings Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 1 | `fees.ts` response still lacks `_units` metadata (new, carries over from F-002 partial) |
| MEDIUM | 4 | Percentage-encoding schism documented but not unified; location JSON cost children lack per-field `currency` + `period`; ACA subsidy-cliff-regime encoding not exposed as a `_units`-style tag on `acaMarketplace`; `users` / `household` / `groceries` / `contributions` routes carry money-shaped fields without `_units`. |
| LOW | 3 | No `naturalFrequency` / `anchor` on scenario GET responses (only POST/PUT schema validation); OpenAPI fallback has no `glossary` body schema; location `monthlyCosts.medicine` shape differs from other cost entries (min/typical/max ordering + no `min+max` bounds on outliers). |
| **Total** | **8** | Down from 11 on 2026-04-16 (7 fixed, 3 new/surfaced, 1 carried). |

### Compliance by Domain (10 dimensions, adapted)

| # | Dimension (API surface) | Compliance | Status | Findings |
|---|-------------------------|-----------|--------|----------|
| 1 | Response envelope — units / currency / periodicity on money fields | 75% | **PASS** (with gap) | F-201 |
| 2 | Consistent percentage encoding across routes | 70% | **PARTIAL** | F-202 |
| 3 | Abbreviation avoidance (no `$1.2M` reaching users) | 95% | **PASS** | — |
| 4 | Glossary / term-definition endpoint | 95% | **PASS** | — (F-004 fully fixed; 26 terms incl. ACA cluster) |
| 5 | Plain-language result explanations | 80% | **PASS** | F-204 (not on `fees.ts`, `household.ts`, `groceries.ts`) |
| 6 | Validation errors quote bounds in plain language | 95% | **PASS** | — (toValidationErrorPayload with per-field labels) |
| 7 | Locale-aware number formatting readiness | 90% | **PASS** | — (`Intl.NumberFormat` in `shared/formatting.js`) |
| 8 | Persistence of dyscalculia accommodations | 95% | **PASS** | — (reserved `accessibility.dyscalculia` sub-schema) |
| 9 | Seed-data numeric realism + precision consistency | 80% | **PASS** | F-206, F-208 |
| 10 | Math-anxiety / vocabulary safety | 95% | **PASS** | — (grep still clean across `src/**`) |

---

## Findings

### HIGH Findings

> HIGH = Gap materially increases cognitive load for dyscalculic users across downstream UIs, because the API is the source of truth and one remaining money-shaped route still ships unlabelled numbers.

#### F-201: `fees.ts` response still omits `_units` envelope
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clear labelling); NCTM Process Standards — Communication; ISO/IEC 40180 §5.3 (product data suitability).
- **Severity:** HIGH
- **Category:** Response-envelope design
- **Element:** `src/routes/fees.ts:89-131` (the entire response path for `GET /api/me/fees` and `PUT /api/me/fees`).
- **Description:** The `toClient()` helper at `src/routes/fees.ts:68-87` converts DB decimal fractions into whole-number percentages (e.g., `brokerageFeePct: 0.5` meaning 0.5%) and returns the record as raw numbers. The companion routes `financial.ts:144-171` (`unitsMeta()`) and `withdrawal.ts:135-149` (`decorate()._units`) now both attach a `_units` block declaring encoding, currency, and periodicity per field. `fees.ts` has not been updated — it remains the only money-route without a `_units` envelope. A dyscalculic user consuming `{ brokerageFeePct: 0.5, wireTransferFeeUsd: 25, fxSpreadPct: 1 }` has no machine-readable signal that `0.5` means "zero point five percent" rather than "fifty percent" or "zero point five dollars."
- **Impact:** Downstream UIs must hard-code the convention per field. A new integration (spreadsheet export, AI assistant, voice UI) reading this JSON cannot tell `brokerageFeePct` apart from a currency amount — and `fees.ts` is the most error-prone route in the API because three different numeric conventions co-exist in a single response (whole-number percent, USD, arbitrary currency).
- **Evidence:**
  - `src/routes/fees.ts:39-44` — `PCT_FIELDS = ['brokerageFeePct', 'brokerageExpenseRatio', 'fxSpreadPct']` (three percent fields).
  - `src/routes/fees.ts:25-27` — `wireTransferFeeUsd`, `wireTransferFeeLocal`, `achTransferFee`, `fxFixedFee` (currency amounts).
  - `src/routes/fees.ts:36` — `localCurrency` top-level string.
  - No `_units` key constructed or returned anywhere in the module (grep confirmed: `grep _units src/routes/fees.ts` → no matches).
  - Contrast with `src/routes/financial.ts:144-171` which does attach `_units`.
- **Remediation:** Add a `unitsMeta()` builder mirroring `financial.ts:145-171`:
  ```ts
  function unitsMeta(record: Record<string, unknown>) {
    const local = (record.localCurrency as string) ?? 'USD';
    return {
      brokerageFeePct: { encoding: 'percent', meaning: '0.5 = 0.5% per year' },
      brokerageExpenseRatio: { encoding: 'percent', meaning: '0.2 = 0.2% per year' },
      fxSpreadPct: { encoding: 'percent', meaning: '1 = 1% of converted amount' },
      brokerageFeeFlat: { encoding: 'amount', currency: 'USD', periodicity: 'per-trade' },
      brokerageAnnualFee: { encoding: 'amount', currency: 'USD', periodicity: 'year' },
      wireTransferFeeUsd: { encoding: 'amount', currency: 'USD', periodicity: 'per-wire' },
      wireTransferFeeLocal: { encoding: 'amount', currency: local, periodicity: 'per-wire' },
      achTransferFee: { encoding: 'amount', currency: 'USD', periodicity: 'per-transfer' },
      fxFixedFee: { encoding: 'amount', currency: 'USD', periodicity: 'per-conversion' },
      manualExchangeRate: { encoding: 'ratio', meaning: 'USD per 1 unit of localCurrency' },
    };
  }
  ```
  Return `{ ...toClient(record), _units: unitsMeta(toClient(record)) }` from both `GET` and `PUT` handlers.
- **Effort Estimate:** S (< 1 day — copy-paste pattern from `financial.ts`).

---

### MEDIUM Findings

#### F-202: Percentage-encoding schism is now documented but still present on the wire
- **Standard/Law:** Dyscalculia Content Audit — Consistent Representation; NCTM Process Standards — Representation.
- **Severity:** MEDIUM (downgraded from HIGH 2026-04-16 because the `_units.meaning` text now flags the encoding per field, materially reducing downstream guessing — but the schism itself remains.)
- **Category:** Number presentation / contract consistency
- **Element:** `src/routes/financial.ts:30-60` (wire as whole-number percent), `src/routes/withdrawal.ts:31-66` (wire as decimal fraction), `src/routes/fees.ts:17-44` (wire as whole-number percent).
- **Description:** Two wire-encoding conventions still coexist:
  - **Whole-number percent:** `financial.ts` (`equityPct: 60`, `expectedReturn: 7`) and `fees.ts` (`brokerageFeePct: 0.5`) — DB stores decimals (0.60, 0.07, 0.005), the route converts.
  - **Decimal fraction:** `withdrawal.ts` (`withdrawalRate: 0.04`, `ceilingRate: 0.06`) — no conversion.
  The `_units` envelope introduced in both `financial.ts` and `withdrawal.ts` now documents the difference at the response level, which is a meaningful improvement, but the split still means a developer stringing together a "summary" UI across routes must apply two rules.
- **Impact:** Integration friction for any UI that aggregates values from both route families, especially dashboards that compute `equityPct * portfolioBalance * withdrawalRate`.
- **Evidence:**
  - `src/routes/financial.ts:154-169` — `equityPct.meaning = '60 = 60%'`, `expectedReturn.meaning = '7 = 7% per year'`.
  - `src/routes/withdrawal.ts:136-141` — `withdrawalRate.encoding = 'fraction', meaning = '0.04 = 4%'`.
  - `src/routes/fees.ts:39-44` + `src/routes/fees.ts:116-121` — same whole-percent convention as `financial.ts`.
- **Remediation:** Pick one convention for the whole API. Preferred: decimal fractions on the wire (matches DB, matches `shared/formatting.js:42-53` `pct()` helper which already expects fractions). Migration steps:
  1. Version the surface: `Accept-Version: 2` clients get fractions; `1` keeps whole-percent for transition.
  2. Update `financial.ts` / `fees.ts` to emit fractions under v2 and drop the `* 100` step in `decryptSettings` / `toClient`.
  3. Update `_units` envelope to drop the `meaning` text (no longer needed when encoding is uniform).
- **Effort Estimate:** M (2–3 weeks coordinated with dashboard).

#### F-203: `acaMarketplace.premiumCapPctOfIncome` has no `_units`-style tag on the wire
- **Standard/Law:** Dyscalculia Content Audit — Consistent Representation; user-memory `aca-subsidy-regime.md` — enhanced flat 8.5% MAGI cap, no FPL cliff.
- **Severity:** MEDIUM
- **Category:** Seed-data precision / response-envelope design
- **Element:** All 70 `data/locations/us-*/location.json` with `healthcare.acaMarketplace.premiumCapPctOfIncome`; surfaced unchanged by `src/routes/locations.ts:216-244` (`GET /api/locations/:id`).
- **Description:** Each US location ships `premiumCapPctOfIncome: 0.085` (decimal fraction) or `0` (US territories where ACA doesn't apply). The test at `src/__tests__/seed-data-integrity.test.ts:323-326` enforces `[0, 0.085]` as the only permitted values, which is a correct reflection of the enhanced regime (per user memory: "flat 8.5% MAGI cap, no FPL cliff, no dual-regime toggle"). But the field has no `_units` tag anywhere in the pipeline. A dyscalculic user whose UI faithfully re-renders "0.085" will read it as "zero point zero eight five" rather than "eight point five percent". The glossary entry `applicable_percentage` (`src/routes/glossary.ts:332-343`) explains the concept but does not bind to the raw field.
- **Impact:** A consumer reading `premiumCapPctOfIncome: 0.085` has no in-band signal that this is a decimal-fraction percentage. Downstream UIs that render it as currency or as a whole-number percent will produce wildly wrong numbers.
- **Evidence:**
  - `data/locations/us-annandale-va/location.json:66` — `"premiumCapPctOfIncome": 0.085`.
  - `data/locations/us-catonsville-md/location.json:73` — `"premiumCapPctOfIncome": 0.085`.
  - `src/__tests__/seed-data-integrity.test.ts:323-326` — tests the pair is `[0, 0.085]` but not the encoding tag.
  - No `_units` / `_encoding` key anywhere in the seed JSON or route decorator.
- **Remediation:** Two cheap options, prefer (a):
  - (a) Add a sibling `acaMarketplace._units` block to each US `location.json`:
    ```jsonc
    "_units": {
      "benchmarkSilverMonthly2Adult": { "encoding": "amount", "currency": "USD", "periodicity": "month" },
      "benchmarkSilverMonthlySingle": { "encoding": "amount", "currency": "USD", "periodicity": "month" },
      "premiumCapPctOfIncome": { "encoding": "fraction", "meaning": "0.085 = 8.5% of MAGI", "regime": "aca_enhanced_post_2021" }
    }
    ```
  - (b) Have `locations.ts:216-244` inject the `_units` block into the response envelope (single place, no seed-data churn, but clients asking for `GET /api/locations/:id/raw` still see a bare number).
- **Effort Estimate:** S (1 day for option b; 2 days for option a including seed script).

#### F-204: Money-shaped fields on `household.ts`, `groceries.ts`, `users.ts`, `contributions.ts` ship without `_units`
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clear labelling).
- **Severity:** MEDIUM
- **Category:** Response-envelope design
- **Element:** `src/routes/household.ts:8-52` (`targetAnnualIncome`, `ssPia`), `src/routes/groceries.ts:16-50` (free-form overrides), `src/routes/users.ts` (profile + tier), `src/routes/contributions.ts` (contribution payloads, partially opaque JSON).
- **Description:** `household.ts` accepts/returns `targetAnnualIncome: number` and `ssPia: number` (Social Security PIA — monthly amount). Neither is accompanied by `_units`. A dyscalculic user reading the response has no signal that `targetAnnualIncome: 80000` is per year and `ssPia: 3100` is per month. The financial-settings route (`financial.ts`) has solved this for its fields, but the pattern has not been cascaded.
- **Impact:** Cross-route inconsistency — some fields have units meta, others don't, which raises the cost of a single mental model for consumers.
- **Evidence:**
  - `src/routes/household.ts:12-15` — `ssPia: z.number().min(0).max(50000)` with no `.describe()` or `_units` decorator.
  - `src/routes/household.ts:46` — `targetAnnualIncome: z.number().min(0).max(10_000_000)`.
  - `src/routes/groceries.ts:16-50` — opaque JSONB overrides.
- **Remediation:** Replicate the `unitsMeta()` + `decorate()` pattern. For `household.ts` specifically:
  ```ts
  function householdUnits(locale: string) {
    const currency = defaultCurrencyFor(locale);
    return {
      targetAnnualIncome: { encoding: 'amount', currency, periodicity: 'year' },
      'members[].ssPia': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
    };
  }
  ```
  For `groceries.ts`: the JSONB is intentionally free-form so `_units` belongs inside each override entry rather than at the envelope level — defer to a typed grocery-override sub-schema.
- **Effort Estimate:** S (2 days covering household + users + minimal contributions decoration).

#### F-205: Scenario GET responses do not include `_units` or plain-language magnitude anchors
- **Standard/Law:** Dyscalculia Content Audit — Scaffolding (magnitude anchoring); NCTM — Communication.
- **Severity:** MEDIUM (new — surfaces after F-006 was partially fixed for POST/PUT)
- **Category:** Scaffolding / response-envelope design
- **Element:** `src/routes/scenarios.ts:61-69` (GET `/api/me/scenarios`).
- **Description:** `scenarios.ts` now enforces a `monte_carlo_v1` sub-schema on write (`src/routes/scenarios.ts:29-46`) including an optional `anchor: string` on each percentile and a `naturalFrequency` on `successRate`. That's a meaningful fix of prior F-006. But the GET handler simply returns the stored JSONB verbatim with no decoration — no `_units` envelope, no injected anchors when they're missing. A scenario written without `anchor` fields comes back without them.
- **Impact:** Inconsistent dyscalculia support across scenario lifecycle — a UI that relies on anchors has to defensively check for their presence and synthesize them client-side, which is the exact duplication the glossary endpoint was meant to prevent.
- **Evidence:**
  - `src/routes/scenarios.ts:25` — `anchor: z.string().max(200).optional()` (optional on write).
  - `src/routes/scenarios.ts:61-69` — GET returns stored rows without decoration.
  - `prisma/schema.prisma:278-285` — `UserScenario.scenarioData` is opaque `Json`, so stored rows may be any shape.
- **Remediation:** In `GET /api/me/scenarios`, detect rows whose `scenarioData.kind === 'monte_carlo_v1'` and inject synthesized anchors/naturalFrequency if missing (using `shared/formatting.js` `fmt()` for currency and a "N out of 10" helper for success rates). Always attach a top-level `_units: { 'percentiles.*.value': { encoding: 'amount', currency: 'USD', periodicity: 'total' } }`.
- **Effort Estimate:** S (1–2 days).

---

### LOW Findings

#### F-206: Location `monthlyCosts.medicine` shape has inconsistent ordering vs sibling cost entries
- **Standard/Law:** Dyscalculia Content Audit — Consistent Representation (data shape).
- **Severity:** LOW
- **Category:** Seed-data shape consistency
- **Element:** 70+ `data/locations/us-*/location.json` (e.g., `us-annandale-va/location.json:29`).
- **Description:** Every `monthlyCosts.*` entry is `{ min, max, typical, ... }`, but `medicine` is written as `{ min, typical, max }` (ordering swap) and occasionally has wild `max` ratios — e.g., `us-annandale-va`: `"medicine": { "min": 73, "typical": 91, "max": 925 }`. The 10x ratio between typical and max isn't wrong (it reflects outlier specialty drugs) but it's inconsistent with the ±20% spread used elsewhere. A dyscalculic user reading min/max as "typical range" rather than "theoretical outlier range" will get a distorted budget picture.
- **Impact:** Magnitude distortion for dyscalculic users who use the UI's min/max range as an anchor. Not wrong, but differently-shaped.
- **Evidence:**
  - `data/locations/us-annandale-va/location.json:29` — `"medicine": { "min": 73, "typical": 91, "max": 925 }` (10× ratio).
  - `data/locations/us-bowie-md/location.json:29` — same.
  - `data/locations/us-catonsville-md/location.json:29` — same.
  - Compare `rent`: `{ min: 1850, max: 2600, typical: 2150 }` (1.4× ratio, canonical ordering).
- **Remediation:** Either (a) normalize the `medicine` max to a "reasonable typical ceiling" (e.g., 2× typical) and add a separate `outlierMax` field; or (b) add a seed-integrity test that requires `max ≤ 3 × typical` for all cost children, with `medicine` explicitly opted out and annotated via an `annotation: 'outlier-range'` flag so clients can render it differently.
- **Effort Estimate:** S (1 day for (b)).

#### F-207: OpenAPI fallback at `src/lib/swagger.ts` does not document `/api/glossary` response body schema
- **Standard/Law:** NCTM — Communication (precise contract).
- **Severity:** LOW
- **Category:** Documentation
- **Element:** `src/lib/swagger.ts:96-111` (fallback OpenAPI doc for `/api/glossary`).
- **Description:** The `glossary` path in the fallback OpenAPI spec has `summary` + `parameters` but no `responses` / `content` / `schema` describing the `GlossaryEntry` shape. Developers integrating with the API by reading the OpenAPI alone cannot see what `{ key, term, plain, example, technical, seeAlso }` looks like without opening the source.
- **Impact:** Friction for downstream consumers — particularly dyscalculic developers who benefit from structured schemas more than from prose descriptions.
- **Evidence:** `src/lib/swagger.ts:96-111` — no `responses` block.
- **Remediation:** Add:
  ```jsonc
  "responses": {
    "200": {
      "description": "List of glossary terms",
      "content": { "application/json": { "schema": { "$ref": "#/components/schemas/GlossaryResponse" } } }
    }
  }
  ```
  …and define the schema at the doc root. Or migrate to a `zod-to-openapi` pipeline once `@fastify/swagger` is installed (the code at `src/lib/swagger.ts:17-25` already lazy-imports it).
- **Effort Estimate:** S (< 1 day).

#### F-208: Non-US locations carry no `healthcarePreMedicare` / `acaMarketplace` — correct by design but not flagged
- **Standard/Law:** Dyscalculia Content Audit — Consistent Representation (predictable field presence).
- **Severity:** LOW
- **Category:** Seed-data / contract shape
- **Element:** All 88 non-US `data/locations/*/location.json`.
- **Description:** The ACA fields only apply to US locations. Non-US locations (`france-paris`, `costa-rica-atenas`, `spain-valencia`, etc.) correctly omit them. But a consumer that unconditionally destructures `loc.healthcare.acaMarketplace` will get `undefined` without a machine-readable "field is N/A for this country" signal. The test at `src/__tests__/seed-data-integrity.test.ts:294-329` only runs against `us-*` locations, confirming the US-only design is intentional.
- **Impact:** Integration friction — minor, since the TypeScript interface can make the field optional. Dyscalculia-specific impact is small because the visual absence is itself meaningful to users.
- **Evidence:**
  - `data/locations/france-paris/location.json` — no `acaMarketplace`, no `healthcarePreMedicare`.
  - `data/locations/costa-rica-atenas/location.json` — no `acaMarketplace`.
  - `src/__tests__/seed-data-integrity.test.ts:285` — `if (!dir.startsWith('us-')) continue;`.
- **Remediation:** Add a tiny marker where the field would otherwise appear:
  ```jsonc
  "healthcare": { ..., "acaApplicable": false }
  ```
  Or document in the glossary entry `aca` that the field is US-only. Alternatively, leave as-is and document the implicit rule once in `CLAUDE.md`.
- **Effort Estimate:** S (< 1 day for documentation; S+ for a seed-data migration).

---

## Standards Crosswalk

| Requirement | Met? | Evidence | Delta vs 2026-04-16 |
|-------------|------|----------|---------------------|
| Number sense — magnitude anchoring on results | **PARTIAL** | `withdrawal.ts:129-131` builds explanation; `scenarios.ts:25` allows anchor on write | Improved (new) |
| Number sense — natural-frequency representation | **PARTIAL** | `scenarios.ts:34` allows naturalFrequency string; not synthesized on GET | Improved (new) |
| Multisensory — TTS-ready text fields | **PASS** | `explanation` field on withdrawal responses (`withdrawal.ts:146`) | Improved (new) |
| Visual accessibility — no `$1.2M` / `$1234K` reaching users | **PASS** | `shared/formatting.js:64` deprecates `fmtKUnsafe` with developer-only JSDoc | Fixed (was F-003) |
| Consistent representation — percentage encoding | **PARTIAL** | `_units.meaning` now documents per-field encoding but schism still wire-level | Partially fixed (was F-001) |
| Currency codes on numeric responses | **PASS** (with gap) | `_units.currency` in `financial.ts:148-153`, `withdrawal.ts:142-144` | Improved; `fees.ts` still missing |
| Locale-aware formatting | **PASS** | `Intl.NumberFormat(locale, …)` in `shared/formatting.js:23-28` + `pct()` at :43-49 | Fixed (was F-007) |
| Math anxiety — no catastrophic vocabulary | **PASS** | Grep confirmed clean across `src/**` (only neutral "failure" in test: `routes-webhooks.test.ts:265`) | Still passing |
| Scaffolding — key terms defined via API | **PASS** | `src/routes/glossary.ts` — 26 terms including ACA cluster (lines 285-343) | Fixed (was F-004) + extended |
| Scaffolding — plain-language result explanations | **PASS** (with gap) | `withdrawal.ts:129-147` ships `explanation` | Fixed for withdrawals (was F-005); not yet for fees / household |
| Progress monitoring (persistence) | **PASS** | Scenarios route + versioned data releases | Still passing |
| Persistence — cross-device accommodations | **PASS** | `preferences.ts:37-48` reserves `accessibility.dyscalculia` sub-schema | Fixed (was F-011) |
| Documentation — OpenAPI coverage | **PARTIAL** | `swagger.ts` registers `@fastify/swagger` when installed + fallback static doc | Improved but body schemas incomplete (F-207) |
| Validation — error envelopes quote bounds in plain language | **PASS** | `toValidationErrorPayload` at `src/lib/validation.ts:151-172` with `FIELD_LABELS` map at :31-75 | Fixed (was F-008) |
| Dyscalculia audit — `fmtK` anti-pattern removed | **PASS** | Renamed to `fmtKUnsafe` with deprecation (`shared/formatting.js:55-66`) | Fixed (was F-003) |

---

## Delta vs 2026-04-16 Audit

| Prior ID | Title | Prior Sev | Status 2026-04-19 | Evidence |
|----------|-------|-----------|------------------|----------|
| F-001 | Percentage encoding inconsistent | HIGH | **PARTIAL** (now F-202, MEDIUM) | `_units.meaning` documents per-field encoding but wire-schism unchanged. `financial.ts:154-169`, `withdrawal.ts:136-141`. |
| F-002 | No units / currency / periodicity | HIGH | **MOSTLY FIXED** (remaining gap → F-201 HIGH) | `financial.ts:145-171` + `withdrawal.ts:135-149` add `_units`; `fees.ts` still bare. |
| F-003 | `fmtK()` abbreviation anti-pattern | HIGH | **FIXED** | `shared/formatting.js:55-66` — renamed to `fmtKUnsafe` with deprecation + JSDoc warning citing this audit by filename. |
| F-004 | No `/api/glossary` endpoint | HIGH | **FIXED** | `src/routes/glossary.ts` — 26 terms with plain/example/technical/seeAlso. |
| F-005 | Withdrawal strategy outputs bare `{amount, effectiveRate}` | MEDIUM | **FIXED** | `withdrawal.ts:123-149` decorates with `_units` + `explanation` + `glossary` deep-link. |
| F-006 | Scenario payloads unstructured | MEDIUM | **PARTIAL** (remaining gap → F-205 MEDIUM) | `scenarios.ts:29-46` defines `monte_carlo_v1` sub-schema on write; GET not decorated. |
| F-007 | `toLocaleString()` without explicit locale | MEDIUM | **FIXED** | `shared/formatting.js:20-31` — `Intl.NumberFormat(locale, { style: 'currency', currency })`. |
| F-008 | Validation errors developer-oriented | MEDIUM | **FIXED** | `src/lib/validation.ts:31-75` field-label map + `plainMessage()` rewriting. |
| F-009 | `withdrawalRate: 0.04` no doc-comment | LOW | **FIXED** | `withdrawal.ts:32` — `.describe('Withdrawal rate as a decimal fraction. 0.04 = 4% (the "4% rule").')`. |
| F-010 | CAGR / sequence-risk not defined | LOW | **FIXED** | `glossary.ts:82-103` — both terms defined with plain + example + technical. |
| F-011 | Preferences JSONB no dyscalculia sub-schema | LOW | **FIXED** | `preferences.ts:37-48` — `dyscalculiaPrefsSchema` reserved. |

**Score delta:** 11 findings → 8 findings. Fixed 7 of 11 prior findings. Of the 4 that remained, 3 were materially improved (F-001, F-002, F-006) and reclassified at a lower severity or split off into narrower follow-ups. 3 genuinely new findings surfaced as a by-product of the remediation pattern being applied inconsistently across routes.

**Changes landed since 2026-04-16** (all verified in code):
- Glossary now includes `aca`, `magi`, `fpl`, `subsidy_cliff`, `applicable_percentage` — `src/routes/glossary.ts:285-343` (5 new terms).
- `DEV_AUTH_BYPASS` env guard — `src/middleware/auth.ts:86-116` (dual-var check: `NODE_ENV=development` AND `DEV_AUTH_BYPASS=1`).
- `npm audit fix` closed CRITICAL Clerk + HIGH Fastify CVEs — verified in commit `c295d2e` (2026-04-18).
- `loadOriginalLocations` path fix + pet-category backfill — verified at `src/__tests__/seed-data-integrity.test.ts:63-80`.
- 7 new Mid-Atlantic locations with ACA fields — all 7 directories present with `healthcarePreMedicare` and `acaMarketplace` blocks.
- ACA cliff regime — 70/70 US locations carry `premiumCapPctOfIncome ∈ {0, 0.085}` (territory + enhanced); test enforced at `seed-data-integrity.test.ts:323-326`.
- `_units` metadata — present in `financial.ts:145-171`, `withdrawal.ts:135-149`, `scenarios.ts:29-46`; absent from `fees.ts`, `household.ts`, `groceries.ts`, location JSON files (findings F-201, F-203, F-204).

---

## Composite Score

Weights redistributed for an API surface (instructional-program dimensions collapsed into response-shape design):

| Domain | Weight | Score (0–100) | Weighted |
|--------|--------|---------------|----------|
| Response envelope — units / currency / periodicity | 20% | 75 | 15.0 |
| Consistent percentage encoding | 10% | 70 | 7.0 |
| Abbreviation avoidance | 5% | 95 | 4.8 |
| Glossary / definitions | 15% | 95 | 14.3 |
| Plain-language result explanations | 10% | 80 | 8.0 |
| Validation error plain-language | 5% | 95 | 4.8 |
| Locale-aware formatting | 5% | 90 | 4.5 |
| Persistence — cross-device accommodations | 10% | 95 | 9.5 |
| Seed-data numeric precision & realism | 10% | 80 | 8.0 |
| Math-anxiety vocabulary safety | 10% | 95 | 9.5 |
| **Composite** | **100%** | | **85.4 → rounded to 84 for conservative treatment of F-201 HIGH + the still-open encoding schism** |

### Score Interpretation

| Score | Grade | Interpretation |
|-------|-------|-----------------|
| 80–100 | A | Excellent compliance |
| 60–79  | B | Good compliance; specific improvements identified |
| 40–59  | C | Moderate compliance; significant gaps |
| 20–39  | D | Poor compliance; major revisions needed |
| 0–19   | F | Critical failure |

**Grade: A − (84 / 100).** Up from B − (65) on 2026-04-16 — a 19-point improvement driven by seven fixed findings. Closing F-201 (fees.ts `_units`) + F-202 (wire-level encoding unification) would lift this to a clean A (≥ 90).

---

## Recommendations (Prioritized)

| Rank | Finding | Action | Effort | Lift |
|------|---------|--------|--------|------|
| 1 | F-201 | Add `_units` envelope to `fees.ts` (copy-paste pattern from `financial.ts:145-171`) | S | HIGH — closes the last unlabelled money-route |
| 2 | F-203 | Inject `_units` into `acaMarketplace` (option b — route-level decoration; no seed churn) | S | MEDIUM — clarifies the most semantically-dense percent on the surface |
| 3 | F-205 | Decorate `GET /api/me/scenarios` with `_units` + synthesized anchors when missing | S | MEDIUM — consistent scenario lifecycle |
| 4 | F-204 | Cascade the `unitsMeta()` pattern to `household.ts`, `users.ts`, `contributions.ts` | S | MEDIUM — uniform contract |
| 5 | F-202 | Version the surface (`Accept-Version: 2` → fractions everywhere) and migrate `financial.ts` / `fees.ts` percent fields | M | HIGH — eliminates the encoding schism entirely |
| 6 | F-207 | Add OpenAPI response body schema for `/api/glossary` + other documented routes | S | LOW — developer experience |
| 7 | F-206 | Seed-integrity test for `max ≤ 3 × typical` with explicit opt-out per field | S | LOW — magnitude consistency |
| 8 | F-208 | Add `acaApplicable: false` marker to non-US locations (or document) | S | LOW — surface predictability |

---

## What Passed (Strengths, Expanded)

| Component | Standard Met |
|-----------|-------------|
| **Rich `/api/glossary` endpoint — 26 terms** with `plain` / `example` / `technical` / `seeAlso` / `aliases`, including the ACA cluster (`aca`, `magi`, `fpl`, `subsidy_cliff`, `applicable_percentage`) added 2026-04-18 | Scaffolding — term definitions (NCTM Communication, Dyscalculia Content Audit) |
| **`_units` envelope on `financial.ts` and `withdrawal.ts`** with per-field `encoding` + `meaning` + `currency` + `periodicity` | Number presentation — units/currency on numeric responses |
| **Plain-language `explanation` field on withdrawal responses** (`withdrawal.ts:129-131`) — paraphrases rate + amount with natural magnitude anchor | Scaffolding — plain-language explanation |
| **`Intl.NumberFormat` with explicit locale** in `shared/formatting.js:20-53` | Locale-aware formatting |
| **`fmtKUnsafe` renamed + `@deprecated` + developer-only JSDoc** citing this audit by filename (`shared/formatting.js:55-66`) | Abbreviation avoidance |
| **`toValidationErrorPayload` rewrites Zod issues** to `{ field, fieldLabel, message, code }` with an explicit label map of 35+ camelCase fields (`src/lib/validation.ts:31-75`) + bound-quoted messages ("must be at least 0", "must be at most 100") | Validation errors in plain language |
| **`monte_carlo_v1` scenario sub-schema** with `percentileShape.anchor` and `successRate.naturalFrequency` (`src/routes/scenarios.ts:19-46`) | Structured simulation results with magnitude anchors |
| **Reserved `accessibility.dyscalculia` preferences sub-schema** (`src/routes/preferences.ts:37-48`) mirroring the dashboard's `DyscalculiaSettings` | Persistence of accommodations |
| **ACA cliff regime enforced** via test `[0, 0.085]` at `src/__tests__/seed-data-integrity.test.ts:323-326` — matches user-memory-enshrined "enhanced flat 8.5% cap, no cliff" | ISO/IEC 40180 — data product suitability |
| **All 70 US locations carry `healthcarePreMedicare` + `acaMarketplace`** (verified by `grep -c "healthcarePreMedicare" data/locations/us-*/location.json`) | Consistent seed-data shape across a meaningful subset |
| **Vocabulary safety** — `ruin`, `bankrupt`, `risk of` grep returns zero hits across `src/**`; `failure` only in a neutral webhook test case (`routes-webhooks.test.ts:265`) | Math-anxiety safety (carried from prior audit) |
| **`Prisma Decimal` string-arrival defense** — `financial.ts:128-131` uses `Number(out[f])` before arithmetic (aligns with user memory `prisma-string-fields.md`) | ISO/IEC 40180 — numeric precision |
| **DEV_AUTH_BYPASS dual-guard** (`auth.ts:90-94`) — requires both `NODE_ENV=development` AND `DEV_AUTH_BYPASS=1` before granting admin — safe default if misconfigured in prod | Anxiety / trust (cross-benefit) |

---

## Version History

| Version | Date | Auditor | Changes |
|---------|------|---------|---------|
| 1.0 | 2026-04-16 | Claude (automated) | Initial dyscalculia audit, 11 findings, B− (65/100) |
| 2.0 | 2026-04-19 | Claude (Opus 4.7, automated) | Recurring audit after PR #9 glossary expansion + #7/#8 location work. 7 of 11 prior findings fixed. 3 new findings surface as uneven application of remediation pattern. A− (84/100). |
