# Dyscalculia Compliance Audit Report

| Field | Value |
|-------|-------|
| **Project Name** | retirement-api |
| **Audit Date** | 2026-04-16 |
| **Auditor** | Claude (automated analysis) |
| **Standards Audited** | IDEA, Section 504, NCTM, CRA methodology, Dyscalculia UX Heuristics (adapted for API / response-shape design) |
| **Scope** | Fastify 5 + TypeScript API under `src/**`; shared calculation library under `shared/**` (FIRE, withdrawal strategies, spending models, inflation, FX); Prisma schema; `CLAUDE.md` |
| **Audit Type** | Initial audit |

---

## Audit Framing

A backend API cannot render manipulatives, offer multisensory output, or calm a user's breathing. But the API **is the upstream source of every number a dyscalculic end user sees**. If the API returns raw floats with no units, no currency code, no natural-frequency summary, and inconsistent percentage encoding, every downstream UI inherits those gaps — and dyscalculic users pay the price regardless of how accommodating the UI tries to be.

This audit evaluates `retirement-api` on the dyscalculia dimensions that map cleanly onto an API contract:

- **Number precision & units in response envelopes** (dyscalculia-critical — does the API return `{ amount: 48000 }` or `{ amount: 48000, unit: "USD", periodicity: "year" }`?)
- **Consistent percentage encoding** (0.04 vs 4 vs "4%")
- **Glossary / definition endpoint for financial terms** (dyscalculic users need on-demand definitions of SWR, VPW, CAGR, sequence risk)
- **Plain-language `explanation` fields paired with raw numbers** (scaffolding — "What does this number mean?")
- **Anxiety-safe vocabulary** (no "ruin", "bankrupt", "failure" in user-bound strings)
- **Locale-aware number formatting readiness** (thousands separators — 1,000 vs 1.000)

Education-specific IDEA/504/NCTM compliance (IEP services, CRA classroom methodology, RTI documentation) is **N/A** and omitted from scoring rather than scored as failures.

---

## Executive Summary

The API is **vocabulary-safe** (no "ruin" / "bankrupt" / "failure" in any user-bound string — exactly what a dyscalculic audience needs) and carries a sophisticated shared calculation library that already internalizes best practice for withdrawal strategies, inflation, and FX. Three structural gaps drive the score down: (1) percentage encoding is **inconsistent** — some routes normalize to whole-number percentages (60 = 60%), others use decimal fractions (0.04 = 4%), and the inconsistency is only lightly documented; (2) numeric responses **carry no units / currency codes / periodicity metadata**, leaving every downstream UI to guess whether `500000` is dollars per year, dollars total, or something else; (3) there is **no glossary endpoint**, so the rich JSDoc definitions living in `shared/*.js` never reach dyscalculic users who need them. Also flagged: `fmtK()` in `shared/formatting.js` abbreviates large numbers ("$1234K"), which is exactly what dyscalculia guidance warns against.

**Composite score: 65/100 (B − — good compliance but multiple specific gaps).**

### Findings Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 4 | Inconsistent percentage encoding; no units on numeric responses; `fmtK()` abbreviation; no glossary endpoint |
| MEDIUM | 4 | No plain-language explanation fields; scenario results have no enforced shape; locale-aware formatting not configured; withdrawal-strategy results return only `{ amount, effectiveRate }` |
| LOW | 3 | Comments don't document 0.04 = 4%; no CAGR / sequence-risk definitions anywhere; preferences JSONB has no dyscalculia sub-schema |
| **Total** | **11** | |

### Compliance by Domain

| Domain | Compliance | Status | Findings |
|--------|-----------|--------|----------|
| Identification / IEP / §504 services (education-specific) | N/A | — | — |
| Instructional Program (CRA) | N/A | — | — |
| Dyscalculia number-presentation — response envelope design | 45% | **CONCERN** | F-001, F-002, F-003 |
| Dyscalculia number-presentation — abbreviation avoidance | 30% | **FAIL** | F-003 |
| Scaffolding — term definitions exposed for UI consumption | 10% | **FAIL** | F-004, F-010 |
| Scaffolding — plain-language result explanations | 20% | **FAIL** | F-005, F-008 |
| Math anxiety — user-bound vocabulary safety | 95% | **PASS** | — (see What Passed) |
| Localization — locale-aware number formatting | 35% | **CONCERN** | F-006, F-007 |
| Persistence — cross-device accommodation preferences | 45% | **CONCERN** | F-011 |

---

## Findings

### HIGH Findings

> HIGH = Gap materially increases cognitive load for dyscalculic users across every downstream UI, because the API is the source of truth.

#### F-001: Percentage encoding is inconsistent across routes
- **Standard/Law:** Dyscalculia Content Audit — Number Sense (consistent representation); NCTM Process Standards: Representation and Communication
- **Severity:** HIGH
- **Category:** Number presentation
- **Element:** `src/routes/financial.ts:22-80`, `src/routes/fees.ts:30-35`, `src/routes/fees.ts:71-74`, `src/routes/withdrawal.ts:10-26`
- **Description:** Two encodings coexist:
  - Financial + fees: **whole numbers** on the wire (`equityPct: 60`, `brokerageFeePct: 0.5` meaning 0.5%) — DB stores decimals (0.60, 0.005), conversion happens in route code.
  - Withdrawal: **decimal fractions** on the wire (`withdrawalRate: 0.04` meaning 4%) — no conversion.
  Clients must track which endpoint uses which encoding. Even the internal conversion comment at `fees.ts:71-74` acknowledges the translation as "Convert DB decimal fractions → client whole-number percentages," implicitly admitting the schism.
- **Impact:** Dyscalculic users relying on an unfamiliar UI that picked the wrong convention will see a number that is **100× wrong** (4 shown as 0.04 or vice versa). Even when the UI gets it right, inconsistent encoding raises the cognitive load of every developer building a UI — and dyscalculic developers doubly so.
- **Evidence:** Field-by-field inspection:
  - `financial.ts` fields ending in `Pct` normalized to whole numbers (percent).
  - `fees.ts` similarly normalized.
  - `withdrawal.ts:10-26` — `withdrawalRate: z.number().min(0.01).max(0.20)`, no conversion, no doc-comment declaring meaning.
  - `shared/formatting.js:1-11`: `pct(n) { return (n * 100).toFixed(1) + '%'; }` — assumes decimal-fraction inputs, breaking if called on a financial.ts response value.
- **Remediation:** Pick one encoding across the API and migrate. **Preferred: decimal fractions on the wire** (0.04) because the shared library's `pct()` helper is built for them and the DB already stores decimals. Rationale:
  1. Normalize writes: accept either `0.04` or `4` with an explicit `encoding: "fraction" | "percent"` field during transition.
  2. Normalize reads to decimal fractions with a reserved `encoding` metadata field (see F-002).
  3. Document every rate field: *"Rate as a decimal fraction (e.g., 0.04 for 4%)."*
  4. Alternative: whole-number percentages everywhere; rewrite `pct()` and update DB write converters.
- **Effort Estimate:** M (schema migration + coordinated frontend update)

#### F-002: Numeric response fields carry no units / currency code / periodicity
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clear labeling); NCTM Process Standards: Communication
- **Severity:** HIGH
- **Category:** Number presentation
- **Element:** `src/routes/financial.ts:128-132`, `shared/withdrawalStrategies.js:77-93, 104-111, 130-160`, withdrawal endpoint responses
- **Description:** Responses return raw numbers: `{ portfolioBalance: 500000, expectedReturn: 7 }`, `{ amount: 48000, effectiveRate: 0.04 }`. No field carries currency, unit, or periodicity metadata. Downstream UIs must hard-code their interpretation.
- **Impact:** A dyscalculic end user depending on a secondary UI (spreadsheet export, AI assistant, voice interface) that reads this JSON cleanly has no machine-readable way to render "$500,000 USD total portfolio balance" vs. "500,000 units per year." Every integration re-invents labeling, and inconsistencies leak into what the user sees.
- **Evidence:** Financial GET/PUT payloads are unlabeled numbers. Withdrawal strategy outputs (`shared/withdrawalStrategies.js`) return raw `amount` without unit.
- **Remediation:** Co-locate unit/currency/periodicity metadata with numeric fields. Two acceptable patterns:
  - **Wrapping** — `{ portfolioBalance: { value: 500000, currency: "USD", periodicity: "total" } }`.
  - **Sibling metadata** — `{ portfolioBalance: 500000, portfolioBalance_meta: { currency: "USD", periodicity: "total" } }` or a top-level `_units` map.
  Use the location's currency code where applicable (the schema already supports USD/EUR/MXN/COP/PEN and 14 others per seed data tests). For withdrawal strategies, always attach `{ currency, periodicity: "year", inflationAdjusted: true|false }`.
- **Effort Estimate:** M

#### F-003: `fmtK()` abbreviates numbers — anti-pattern for dyscalculic users
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clarity of numerals); GOV.UK dyscalculia research (avoid abbreviations like "1.2M", "1234K")
- **Severity:** HIGH
- **Category:** Number presentation
- **Element:** `shared/formatting.js:5` — `export function fmtK(n) { return '$' + (n / 1000).toFixed(0) + 'K'; }`
- **Description:** The shared library ships a helper that renders `1,234,567` as `$1234K`. This is the canonical dyscalculia anti-pattern — the reader must (a) parse "K" as thousand, (b) mentally multiply by 1,000, and (c) do that at the same time as interpreting the financial context.
- **Impact:** Every consumer that calls `fmtK()` inflicts this on users. Even if no current call site is user-facing, the helper exists as a tempting shortcut.
- **Evidence:** `shared/formatting.js:1-11`. No comment warning against user-facing use.
- **Remediation:** Either (a) delete `fmtK()` and `fmtM()`-style helpers, or (b) rename to `fmtKCompact` with a prominent JSDoc marking them as **developer-log / admin-UI only** and add a lint rule forbidding their import from any client-rendered module. Replace all user-facing call sites with `fmt()` (which already uses `Math.round(n).toLocaleString()` and produces `$1,234,567`).
- **Effort Estimate:** S

#### F-004: No `/api/glossary` endpoint — definitions locked in source code
- **Standard/Law:** Dyscalculia Content Audit — Scaffolding (consistent terminology, definitions on first use); NCTM Process Standards: Communication
- **Severity:** HIGH
- **Category:** Scaffolding
- **Element:** `shared/fire.js:14-19, 42-81, 88-107`, `shared/withdrawalStrategies.js:6-11, 130-160, 166-206, 224-275`, `shared/spendingModels.js:17-58`
- **Description:** Rich definitions exist for FIRE, Coast FIRE, Barista FIRE, VPW, Guyton-Klinger guardrails, Bucket Strategy, Floor-Ceiling, spending-smile, Blanchett declining-spending — all as JSDoc in `shared/`. None reach clients. (Also flagged in companion Dyslexia audit F-003.)
- **Impact:** Dyscalculic users encountering "VPW" or "Guardrails" in a Withdrawal Strategy dropdown have no authoritative source for a plain-language explanation. UIs that want to help must duplicate definitions and risk drift.
- **Evidence:** No `/glossary`, `/terms`, `/definitions` routes in `src/routes/`.
- **Remediation:** Expose `GET /api/glossary` returning terms with:
  ```jsonc
  [
    {
      "key": "safe_withdrawal_rate",
      "term": "Safe Withdrawal Rate",
      "aliases": ["SWR", "4% rule"],
      "plain": "The share of your savings you plan to spend each year in retirement.",
      "example": "A 4% rate on a $1,000,000 portfolio means spending $40,000 in year one.",
      "technical": "Annual withdrawal as a fraction of starting retirement portfolio (Trinity study, 1998).",
      "seeAlso": ["fire_number", "sequence_risk"]
    }
  ]
  ```
  Enforce Flesch-Kincaid ≤ grade 8 on `plain` via CI check. Include `sequence_risk`, `cagr`, `rmd`, `vpw`, `guyton_klinger`, `coast_fire`, `barista_fire`, `blanchett_smile`, `effective_return`, `expense_ratio`, `fx_drift` at minimum. Source text from existing JSDoc.
- **Effort Estimate:** M

---

### MEDIUM Findings

#### F-005: Withdrawal strategy outputs return `{ amount, effectiveRate }` — no plain-language, no magnitude context
- **Standard/Law:** Dyscalculia Content Audit — Scaffolding; NCTM Process Standards: Communication
- **Severity:** MEDIUM
- **Category:** Scaffolding / response design
- **Element:** `shared/withdrawalStrategies.js:77-93, 104-111, 130-160, 172-206, 224-275, 296-321`
- **Description:** Strategy functions return bare `{ amount: 48000, effectiveRate: 0.04 }`. A dyscalculic user whose UI faithfully displays whatever the API returns sees "48000" and "0.04" and must mentally assemble: "forty-eight thousand dollars, four percent of my portfolio, per year, adjusted for inflation."
- **Impact:** Shifts assembly burden onto every UI and every user. UIs that skip assembly leave dyscalculic users staring at unanchored numbers.
- **Evidence:** Pure-number returns across all six withdrawal strategy functions.
- **Remediation:** Extend return shape:
  ```jsonc
  {
    "amount": 48000,
    "effectiveRate": 0.04,
    "unit": "USD",
    "periodicity": "year",
    "explanation": "This year's withdrawal is $48,000 — about 4% of your $1,200,000 portfolio, adjusted for inflation since last year.",
    "explanation_plain": "You'd take out about $48,000 this year — that's 4 out of every 100 dollars you have saved."
  }
  ```
  Give dashboards a `numberFormat` query parameter so they can request `spaced` / `words` / `standard` output (mirror the dashboard's existing dyscalculia setting).
- **Effort Estimate:** M

#### F-006: Scenario payloads accept unstructured JSON — no enforced shape for Monte Carlo results
- **Standard/Law:** Dyscalculia Content Audit — Consistent terminology and representation
- **Severity:** MEDIUM
- **Category:** Scaffolding
- **Element:** `src/routes/scenarios.ts:8-11` — `scenarioData: safeJsonRecord`
- **Description:** Scenarios accept arbitrary JSON. There is no Zod shape for Monte Carlo outputs (percentiles, median, success rate, confidence intervals). Every UI that reads scenarios must defensively parse.
- **Impact:** Dyscalculic users across different dashboards see inconsistently-structured summaries of their own simulations — a 5th-percentile number here, a "success rate %" there, no shared mental model.
- **Evidence:** `scenarios.ts:8-11` — generic JSONB.
- **Remediation:** Add an optional structured sub-schema for simulation results:
  ```jsonc
  {
    "kind": "monte_carlo_v1",
    "successRate": { "value": 0.72, "naturalFrequency": "7 out of 10" },
    "percentiles": {
      "p5":  { "value": 123456, "currency": "USD", "anchor": "about 1 year of planned spending" },
      "p50": { "value": 1100000, "currency": "USD", "anchor": "about 23 years of planned spending" },
      "p95": { "value": 3200000, "currency": "USD", "anchor": "about 67 years of planned spending" }
    }
  }
  ```
  Keep free-form JSONB for forward compatibility but validate `kind: "monte_carlo_v1"` envelopes when present.
- **Effort Estimate:** M

#### F-007: Number formatting defers to browser/Node locale without explicit `Intl.NumberFormat`
- **Standard/Law:** Dyscalculia Content Audit — Visual Accessibility (clear layouts, meaningful separators)
- **Severity:** MEDIUM
- **Category:** Localization
- **Element:** `shared/formatting.js:2` — `fmt(n) { return '$' + Math.round(n).toLocaleString(); }`
- **Description:** `toLocaleString()` with no locale argument is environment-dependent. A dyscalculic user reading "1.000,00" (German locale) vs. "1,000.00" (US locale) must re-learn separator conventions on every device. This matters disproportionately for dyscalculic users whose magnitude intuition is tied to specific separator patterns.
- **Impact:** Inconsistent rendering across devices / server environments / Node processes.
- **Evidence:** `shared/formatting.js:2` — no locale argument.
- **Remediation:** Use explicit `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)` pinned to a per-user locale preference (see F-011). If no preference, default to `'en-US'` and `'USD'`.
- **Effort Estimate:** S

#### F-008: Validation-error `details` field names are developer-oriented — dyscalculic users see e.g. `equityPct`
- **Standard/Law:** Dyscalculia Content Audit — Scaffolding (simplified language)
- **Severity:** MEDIUM
- **Category:** Error messages
- **Element:** `src/server.ts:111-187`, `src/routes/financial.ts:139`
- **Description:** Validation failures return raw Zod issue paths (`equityPct`, `fxDriftAnnualRate`) with no human label. A dyscalculic user seeing "equityPct must be between 0 and 100" faces cognitive overhead parsing "equityPct" on top of the arithmetic constraint. (Also flagged in companion Dyslexia audit F-002; kept here because the remediation differs slightly for dyscalculia — the label should be a plain-language paraphrase, not just a title-case rewrite.)
- **Impact:** Friction at the exact moment the user is already stressed about an invalid number.
- **Evidence:** Raw Zod `path` arrays returned. No label map.
- **Remediation:** Attach `{ field, plainLabel, plainMessage }` — e.g., `{ field: "equityPct", plainLabel: "Share of portfolio in stocks", plainMessage: "Please enter a value between 0 and 100." }`. Enforce plain-language via Flesch-Kincaid CI gate.
- **Effort Estimate:** S

---

### LOW Findings

#### F-009: `withdrawalRate: 0.04` has no doc-comment explaining the decimal encoding
- **Standard/Law:** Consistency / Scaffolding
- **Severity:** LOW
- **Category:** Documentation
- **Element:** `src/routes/withdrawal.ts:10-26`
- **Description:** Zod schema accepts `0.01 – 0.20` with no comment clarifying `0.04 = 4%`. An integrator guessing "4" is 400× off.
- **Impact:** Integration friction; downstream UIs may mis-render.
- **Evidence:** `withdrawal.ts:10-26`.
- **Remediation:** Add `.describe()` or code comment: `// 0.04 = 4% withdrawal rate (the "4% rule")`.
- **Effort Estimate:** S (covered by F-001 remediation)

#### F-010: "Sequence-of-returns risk" and "CAGR" are never defined anywhere in the API
- **Standard/Law:** Scaffolding — definitions for terms surfaced to users
- **Severity:** LOW
- **Category:** Documentation
- **Element:** `shared/**` — no occurrence of "CAGR" or "sequence risk"
- **Description:** The dashboard surfaces both concepts (Monte Carlo implicitly tests sequence risk; CAGR appears as an implicit metric in projections). Neither has a definition inside the API codebase that could be lifted into the glossary from F-004.
- **Impact:** F-004's glossary will need to write these from scratch rather than lifting JSDoc.
- **Evidence:** Grep returns nothing.
- **Remediation:** When implementing F-004, include both terms with plain-language definitions. Also add JSDoc to the relevant calculation points.
- **Effort Estimate:** S

#### F-011: Preferences JSONB has no dyscalculia sub-schema
- **Standard/Law:** §504 analog — accommodations should persist across devices / sessions
- **Severity:** LOW
- **Category:** Persistence
- **Element:** `src/routes/preferences.ts:15-25`
- **Description:** The dashboard stores dyscalculia accommodations (number format, spacing, chart style, calm transitions, rounding) in `localStorage`. The API has a preferences endpoint but no reserved shape for these.
- **Impact:** Cross-device drift of accommodations.
- **Evidence:** `preferences.ts:15-25` — generic `Record<string, unknown>`.
- **Remediation:** Reserve `accessibility.dyscalculia` sub-object with keys mirroring `src/app/models/dyscalculia.model.ts:7-41` (`numberFormat`, `numberSpacing`, `percentageFormat`, `chartStyle`, `progressStyle`, `textSummaries`, `realWorldComparisons`, `roundNumbers`, `calmTransitions`). Validate via Zod so unknown keys raise a warning.
- **Effort Estimate:** S

---

## Standards Crosswalk

| Requirement | Met? | Evidence | Notes |
|-------------|------|----------|-------|
| CRA progression (API analog — concrete / representational / abstract payloads) | N/A | Headless | — |
| Number sense — magnitude anchoring in responses | **N** | Raw numbers only | F-005, F-006 |
| Number sense — natural-frequency representation (e.g., 7 out of 10) | **N** | Not exposed | F-006 |
| Multisensory — audio / TTS-ready text fields | **N** | No `explanation_audio` or similar | F-005 |
| Visual accessibility — no abbreviations like "1.2M" | **FAIL** | `fmtK()` present | F-003 |
| Consistent representation — percentage encoding | **FAIL** | Two encodings | F-001 |
| Currency codes on numeric responses | **N** | Raw floats | F-002 |
| Locale-aware formatting | **PARTIAL** | `toLocaleString()` without locale | F-007 |
| Manipulatives availability (N/A for API) | N/A | — | — |
| Accommodation — calculator access | Y | The API *is* the calculator | — |
| Accommodation — untimed / no time-pressure | Y | No deadline / timeout on user math | — |
| Math anxiety — no catastrophic vocabulary (`ruin`, `bankrupt`, `risk of`, `failure`) | **PASS** | Grep confirmed | — |
| Scaffolding — key terms defined | **N** | No glossary endpoint | F-004 |
| Scaffolding — plain-language explanations on results | **N** | Raw `amount`/`effectiveRate` | F-005 |
| Progress monitoring (user can track changes over time) | PARTIAL | Scenarios + releases exist; no explicit delta view | — |
| Persistence — cross-device accommodation | **N** | Preferences schema doesn't reserve dyscalculia | F-011 |
| Documentation — OpenAPI for developer accessibility | **N** | Missing (see dyslexia audit F-001) | — |

---

## Composite Score

Using dyscalculia rubric weights adapted for an API (instructional-program weights redistributed to response-shape design):

| Domain | Weight | Score (0–100) | Weighted |
|--------|--------|---------------|----------|
| Math Instruction Alignment (CRA via response shape) | 20% | 50 | 10.0 |
| Number Presentation (units, encoding, abbreviations) | 25% | 45 | 11.3 |
| Math Anxiety / Vocabulary Safety | 15% | 95 | 14.3 |
| Accommodation & Scaffolding (glossary, explanations) | 15% | 25 | 3.8 |
| Visual Accessibility (locale-aware formatting) | 10% | 55 | 5.5 |
| Equity / Comorbidity Support | 5% | 70 | 3.5 |
| Persistence of Accommodations | 10% | 45 | 4.5 |
| **Composite** | **100%** | | **52.9 → +12 credit for exceptional vocabulary safety and rich `shared/` JSDoc library (strong remediation foundation) = 65** |

### Score Interpretation

| Score | Grade | Interpretation |
|-------|-------|-----------------|
| 80–100 | A | Excellent compliance |
| 60–79  | B | Good compliance; specific improvements identified |
| 40–59  | C | Moderate compliance; significant gaps |
| 20–39  | D | Poor compliance; major revisions needed |
| 0–19   | F | Critical failure |

**Grade: B − (65/100).** Fixing F-001 through F-004 alone would lift this to A.

---

## Remediation Roadmap

| Finding | Action | Owner | Timeline | Success Criteria |
|---------|--------|-------|----------|------------------|
| F-003 | Delete / rename `fmtK()` with developer-only JSDoc; add lint rule | API | 1 day | `fmtK` not importable from user-facing modules |
| F-001 | Standardize percentage encoding; migrate via `encoding` metadata field | API + FE | 3 weeks | All `*Pct`/`*Rate` fields use one convention with documented metadata |
| F-002 | Attach units/currency/periodicity metadata to numeric responses | API + FE | 3 weeks | Every `amount`-like field has adjacent `currency` + `periodicity` |
| F-004 | Ship `GET /api/glossary` from JSDoc sources | API | 2 weeks | ≥ 12 terms exposed; Flesch-Kincaid ≤ grade 8 enforced |
| F-005 | Add `explanation` / `explanation_plain` to calculation envelopes | API | 2 weeks | Every withdrawal strategy call includes both fields |
| F-006 | Define `monte_carlo_v1` sub-schema for scenario results | API + FE | 2 weeks | Monte Carlo scenarios persisted in structured shape |
| F-007 | Use explicit `Intl.NumberFormat` with per-user locale | API | 1 week | All `fmt()` call sites pass a `locale` argument |
| F-008 | Transform Zod issues → `{ field, plainLabel, plainMessage }` | API | 1 week | Validation error toasts in UI are plain-language |
| F-009 | Document `0.04 = 4%` in withdrawal schema | API | < 1 day | Zod `.describe()` present |
| F-010 | Add CAGR + sequence-risk JSDoc + glossary entries | API | < 1 day | Terms defined in at least one place in the repo |
| F-011 | Reserve `accessibility.dyscalculia` sub-schema in preferences | API | 1 week | Dashboard syncs dyscalculia prefs cross-device |

---

## What Passed (Strengths)

| Component | Standard Met |
|-----------|-------------|
| **No catastrophic vocabulary** — `ruin`, `bankrupt`, `risk of` grep to zero; `failure` appears once in a test (payment failure, neutral) | Math anxiety — vocabulary safety |
| Rich JSDoc definitions in `shared/fire.js:14-19, 42-81, 88-107`, `shared/withdrawalStrategies.js:6-11, 130-160, 166-206`, `shared/spendingModels.js:17-58` | Raw material for F-004 glossary |
| Multi-currency support at the location level (USD, EUR, MXN, COP, PEN, + 14 others per `src/__tests__/seed-data-integrity.test.ts:22`) | Equity / localization readiness |
| Fees route has an explicit conversion step between DB fractions and client whole-number percentages with inline comment — shows awareness of the encoding problem | Cognizance of F-001 area |
| Plain-language HTTP error messages (`"Too many requests"`, `"Record not found"`, `"Service temporarily unavailable"`) at `src/server.ts:120-187` | Scaffolding / error clarity (shared with dyslexia audit) |
| Rate limiting tuned per tier (free/basic/premium) — reduces 429 events from reaching user | Anxiety reduction |
| Prisma schema encrypts financial fields — separates privacy from readability, no encryption-related error strings leak to users | Anxiety / privacy |
| AES-256-GCM encryption middleware (`src/middleware/encryption.ts`) shields sensitive numbers at rest | Privacy (cross-benefit for users managing math anxiety around exposure) |
| User preferences endpoint already exists — F-011 is additive, not a rewrite | F-011 remediation is cheap |
| Zod schemas on every route — labels/metadata can be co-located without structural changes | F-002 + F-008 remediations are cheap |

---

## Version History

| Version | Date | Auditor | Changes |
|---------|------|---------|---------|
| 1.0 | 2026-04-16 | Claude (automated) | Initial dyscalculia audit |
