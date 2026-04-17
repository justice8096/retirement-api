# Dyslexia Standards Compliance Audit Report

| Field | Value |
|-------|-------|
| **Project** | retirement-api |
| **Audit Date** | 2026-04-16 |
| **Auditor** | Claude (automated analysis) |
| **Standards** | IDA KPS 2018, IDEA, Section 504, Dyslexia UX Heuristics (adapted for API consumers / developers / downstream UI), WCAG 2.2 cross-reference (see sibling `WCAG-AA-API-Audit-2026-04-10.md`) |
| **Scope** | Fastify 5 + TypeScript API under `src/**`; shared calculation library under `shared/**`; `CLAUDE.md`; error handling in `src/server.ts`; route modules; absence of API documentation |
| **Type** | Initial audit |

---

## Audit Framing

`retirement-api` is a headless JSON API consumed by `retirement-dashboard-angular` and potentially other frontends. Dyslexia compliance for an API is indirect: it cannot render fonts, pick line heights, or offer read-aloud. However, the API **generates the text strings that end up in front of dyslexic end users** (error messages, validation field names, financial term labels) and **exposes the documentation dyslexic developers must read to integrate** (README, OpenAPI, comments).

This audit evaluates the API against:
- **Plain-language error output** (what the end user's dyslexic eyes eventually see when validation fails)
- **Human-readable field labeling** (API contract → form label in the UI)
- **Developer-facing documentation readability** (reading-level of README, presence/absence of Swagger UI, comment density)
- **Glossary / definition surfacing** (does the API provide anything the client UI can use to explain terms?)

Education-specific IDA/IDEA/§504 standards (IEP services, CRA fidelity in instruction, structured-literacy element coverage) are **N/A** and omitted from scoring rather than scored as failures.

---

## Executive Summary

The API's **error messages are refreshingly plain-language**: `"Too many requests"` rather than `FST_ERR_RATE_LIMIT`, `"Service temporarily unavailable"` rather than `P2024`. That alone puts it ahead of typical Node APIs on the dyslexia-relevant dimensions. However, the API **does not return human-readable field labels** — validation errors expose raw camelCase paths (`portfolioBalance`, `fxDriftAnnualRate`) that frontends then have to translate. There is **no OpenAPI specification** (which the WCAG sibling audit already flagged) — dyslexic developers integrating against this API must read the source files directly, and the source prose is dense and technical. There is **no glossary endpoint** to let the UI offload plain-language definitions of terms like *Safe Withdrawal Rate*, *VPW*, *Guyton-Klinger guardrails* — those definitions exist only in JSDoc comments in `shared/` and never leave the server.

**Composite score: 58/100 (C — needs improvement, multiple dyslexia-relevant gaps, though existing error messaging is a strong foundation).**

### Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0     | No legal blockers — not an educational service |
| HIGH     | 3     | No OpenAPI/Swagger; camelCase-only field names in validation errors; no glossary endpoint |
| MEDIUM   | 4     | Dense README prose; no plain-language explanation field on calculation results; sparse route-level JSDoc; error `details` payload uses raw Zod issues |
| LOW      | 3     | `Content-Language: en` hard-coded; no per-user locale preference; internal log output mixed with user-bound error text |
| **Total**| **10** |             |

### Compliance by Domain

| Domain | Status | Notes |
|--------|--------|-------|
| IDA Standard 1–5 | N/A | Not an instructional service |
| IDEA / §504 | N/A | Not a school service |
| Plain-language end-user-bound error text | **PASS** | Notably strong — see What Passed |
| Human-readable field labeling contract | **FAIL** | camelCase leaks to UI — F-002 |
| Developer documentation readability | **CONCERN** | F-001, F-004, F-006 |
| Glossary / term-definition surfacing | **FAIL** | F-003 |
| Localization / reading-level support | **CONCERN** | F-007, F-008 |
| Semantic clarity of response shapes | **CONCERN** | F-005, F-009 |

---

## Findings

### HIGH Findings

#### F-001: No OpenAPI / Swagger specification
- **Standard/Law:** Dyslexia UX Heuristic 10 (help and documentation — multimedia, not just prose); Dyslexia-Friendly Content Audit (Navigation: table of contents / section navigation); also raised in sibling `WCAG-AA-API-Audit-2026-04-10.md`
- **Severity:** HIGH
- **Category:** Documentation
- **Element:** `src/server.ts` route registration; `package.json` dependencies
- **Description:** The API ships no `@fastify/swagger`, no `openapi.json`, and no served HTML docs. Dyslexic developers integrating the API must read 17 route files (60+ endpoints) from source.
- **Impact:** Dyslexic developers rely heavily on **scan-and-search affordances** (visual hierarchy, searchable index, collapsible sections) that a Swagger UI provides and raw source code does not. Without OpenAPI the effective reading load for an integration is multiplied; the API's surface area becomes structurally less accessible.
- **Evidence:** `package.json` has no `@fastify/swagger` or `@fastify/swagger-ui` entry; grep of `src/**` for `openapi|swagger` returns nothing; no `openapi.json` / `openapi.yaml` file at repo root.
- **Remediation:** Add `@fastify/swagger` + `@fastify/swagger-ui`, wire up Zod schemas (already present for every route) to OpenAPI via `fastify-type-provider-zod`. Serve `/docs` publicly or behind auth. Ensure every schema has a plain-language `description`.
- **Effort Estimate:** M

#### F-002: Validation errors expose camelCase field paths only — no human-readable labels
- **Standard/Law:** Dyslexia-Friendly Content Audit (Content Structure — clear headings, plain language); §504 accommodation equivalent — error messages must be actionable without decoding
- **Severity:** HIGH
- **Category:** Error message design
- **Element:** `src/server.ts:120,135`, `src/routes/financial.ts:139`, and every route using Zod
- **Description:** When validation fails, the response is:
  ```json
  { "error": "Validation error", "details": [{ "path": ["portfolioBalance"], "message": "..." }] }
  ```
  The `path` element is a JS property name (`portfolioBalance`, `fxDriftAnnualRate`, `equityPct`). The UI must translate to a human-readable label ("Portfolio Balance," "Annual FX Drift Rate," "Equity Allocation"). In practice, Angular apps frequently display the raw path in an error toast when no mapping exists — and dyslexic users are then asked to parse "portfolioBalance" visually.
- **Impact:** Camel-case decoding adds friction for every user, but disproportionately for dyslexic readers who already spend more effort on low-level orthographic parsing.
- **Evidence:** `src/server.ts:111-187` — Zod error handler returns `error.validation` unmodified. No `label` field or `displayName` co-returned. No i18n-ready error dictionary on the server.
- **Remediation:** Either (a) return a `fieldLabel` alongside each issue using a server-side map keyed by `path` (e.g., `portfolioBalance → "Portfolio Balance"`), or (b) publish a `/api/schema/labels` endpoint that exposes the mapping so the UI can translate consistently. Preferred: co-locate the label with the Zod schema via `.describe()` and surface both on error.
- **Effort Estimate:** S–M

#### F-003: No `/api/glossary` endpoint — term definitions locked inside source code
- **Standard/Law:** Dyslexia-Friendly Content Audit (Content Structure — key terms defined on first use); Dyslexia UX Heuristic 10 (help and documentation)
- **Severity:** HIGH
- **Category:** Documentation / scaffolding
- **Element:** `shared/fire.js`, `shared/withdrawalStrategies.js`, `shared/spendingModels.js` — rich JSDoc definitions exist but never leave the server
- **Description:** The shared library has excellent inline definitions for FIRE, Coast FIRE, Barista FIRE, VPW, Guyton-Klinger guardrails, Bucket Strategy, Floor-Ceiling, spending-smile. These are exactly the terms a dyslexic end user needs plain-language help for in the UI — but the API does not expose them. The UI either re-implements definitions (risk of drift) or omits them (the dashboard currently has this gap, per its companion dyscalculia audit F-007).
- **Impact:** Dyslexic users reading, e.g., "VPW" in a Withdrawal Strategy dropdown have no way to get a plain-language definition short of the UI hard-coding one. Any UI doing so will diverge from the server's authoritative definition over time.
- **Evidence:** No `/glossary`, `/terms`, `/definitions` route in `src/routes/`. JSDoc lives in `shared/withdrawalStrategies.js:6-11`, `shared/fire.js:14-19, 42-81, 88-100`, `shared/spendingModels.js:17-58`.
- **Remediation:** Add `GET /api/glossary` returning an array of `{ key, term, plainLanguage, readingLevel, technicalDefinition, seeAlso[] }`. Source strings from the existing JSDoc. Enforce Flesch-Kincaid ≤ grade 8 on `plainLanguage`. Let the UI render these in tooltips / glossary screens.
- **Effort Estimate:** M

---

### MEDIUM Findings

#### F-004: `CLAUDE.md` / README is dense and jargon-forward
- **Standard/Law:** Dyslexia-Friendly Content Audit (Content Structure — plain language, short paragraphs)
- **Severity:** MEDIUM
- **Category:** Developer documentation
- **Element:** `CLAUDE.md` (root)
- **Description:** The README opens with: *"REST API server for the retirement planning platform. Serves location data, user profiles, financial settings, scenarios, and billing for multiple frontend clients. Runtime: Fastify 5, Node.js 20+, TypeScript (strict mode). Database: PostgreSQL 16 via Prisma 6 ORM."* — four concepts per sentence, high jargon density, no scaffolding for a new reader.
- **Impact:** Dyslexic developers fatigue faster on high-density prose. The "one thing per sentence, sentences ≤ 20 words" guidance is not followed.
- **Evidence:** `CLAUDE.md:1-13`.
- **Remediation:** Rewrite into a Getting-Started section with numbered steps, short sentences (≤ 20 words), a "What this API does" plain-language paragraph, and a "Technologies" table that separates what-from-why. Add a "Minimum reading" / "Deeper reading" split so integrators can choose depth.
- **Effort Estimate:** S

#### F-005: Calculation responses lack a plain-language `explanation` field
- **Standard/Law:** Dyslexia UX Heuristic 6 (recognition rather than recall — visual cues and labels); Content Audit (clear and simple error/result messages)
- **Severity:** MEDIUM
- **Category:** Response design
- **Element:** Withdrawal strategy and (implicit) scenario calculation endpoints — `shared/withdrawalStrategies.js:77-93, 104-111, 130-160, 172-206, 224-275, 296-321`
- **Description:** Strategy functions return e.g. `{ amount, effectiveRate }` with no natural-language `explanation` field. The UI must compose the sentence itself.
- **Impact:** Every UI implementing this API re-invents the same plain-language explanation — and dyslexic end users read whatever the frontend happens to produce, which may be inconsistent or absent.
- **Evidence:** Pure-number returns in `shared/withdrawalStrategies.js`.
- **Remediation:** Add an optional `explanation` field to calculation results: *"This year's withdrawal is $48,000 — about 4% of your current portfolio, increased for inflation since last year."* Pair with numbers in the same envelope so the UI can show both.
- **Effort Estimate:** M

#### F-006: Sparse route-level JSDoc / section headings inside source
- **Standard/Law:** Dyslexia-Friendly Content Audit (Content Structure — clear headings with visual hierarchy)
- **Severity:** MEDIUM
- **Category:** Developer documentation
- **Element:** `src/routes/*.ts`
- **Description:** Route files open straight into code with a one-liner comment (e.g., `// GET /api/me/household — fetch household with members and pets` at `src/routes/household.ts:85`). No JSDoc block with purpose / inputs / outputs / errors. Dense scanning with no visual anchor.
- **Impact:** Dyslexic developers rely on visual anchor points to re-find code after interruption. Missing structured comments forces linear re-reading.
- **Evidence:** `src/routes/household.ts:85`, `src/routes/financial.ts:120`, etc.
- **Remediation:** Add standard JSDoc block per handler (`@summary`, `@description`, `@tag`, `@throws`). Bonus: this JSDoc feeds directly into Swagger once F-001 is done.
- **Effort Estimate:** M

#### F-007: Error `details` leak raw Zod issue shape
- **Standard/Law:** Dyslexia Heuristic 9 (help users recognize, diagnose, recover from errors — simple error messages)
- **Severity:** MEDIUM
- **Category:** Error message design
- **Element:** `src/server.ts:120`, most route validation handlers
- **Description:** On validation failure the API returns `error.validation` (Zod) / `parsed.error.issues` as-is: `[{ code, message, path: [...] , expected, received }]` with additional fields like `exact`, `inclusive`, `minimum`. That is developer-oriented output. Frontends often dump it directly as a toast during error bubbling.
- **Impact:** Dyslexic end users encountering "Expected number, received string at path.portfolioBalance" face unnecessary jargon.
- **Evidence:** `src/server.ts:111-187`.
- **Remediation:** Transform Zod issues into a stripped-down `{ field: string, label: string, message: string }[]` before returning. Keep the raw issues under a `debug` key visible only in non-production environments.
- **Effort Estimate:** S

---

### LOW Findings

#### F-008: `Content-Language: en` hard-coded at `src/server.ts:80`
- **Standard/Law:** Dyslexia Heuristic 3 (user control and freedom — locale / customization is a dyslexia accommodation)
- **Severity:** LOW
- **Category:** Localization
- **Element:** `src/server.ts:80`
- **Description:** Response header is forced to English. No per-user locale endpoint; preferences JSONB (`src/routes/preferences.ts`) has no defined `locale` schema.
- **Impact:** Dyslexic users whose native reading language is not English cannot route the dashboard into a locale the API knows about.
- **Evidence:** Hardcoded header; no locale field in user schema.
- **Remediation:** Read `Accept-Language`, echo honored value. Add `locale` to user preferences schema.
- **Effort Estimate:** S

#### F-009: No user-preferred `locale` / `timezone` / `displayUnits` preference
- **Standard/Law:** Dyslexia Heuristic 3
- **Severity:** LOW
- **Category:** User preferences
- **Element:** `src/routes/preferences.ts:15-25`
- **Description:** `GET/PATCH /api/me/preferences` accepts a free-form JSONB blob with no schema; there is no server-validated `locale` / `readingLevel` / `spacing` / `fontPreference` shape the dashboard can sync dyslexia preferences into.
- **Impact:** Accommodations set in the dashboard (per its companion audit F-001 remediation) cannot persist cross-device via the API.
- **Evidence:** `preferences.ts` — generic `Record<string, unknown>` typing; no Zod shape for accessibility preferences.
- **Remediation:** Define an `accessibility` sub-object in the preferences schema with reserved keys: `locale`, `fontFamily`, `fontSizeTier`, `contrastMode`, `readAloudRate`, etc. Keep additional-properties open for future expansion.
- **Effort Estimate:** S

#### F-010: Internal log output uses the same word choice as user-bound error text
- **Standard/Law:** Dyslexia Heuristic 10 (help and documentation — appropriate to audience)
- **Severity:** LOW
- **Category:** Logging vs. user-facing text
- **Element:** `src/server.ts` error handler
- **Description:** The `error: 'Internal server error'` string sent to clients is also the one logged. No separation between developer-audience and end-user-audience strings. Low risk but a style nit.
- **Impact:** Minor.
- **Evidence:** `src/server.ts:186`.
- **Remediation:** Separate log-line template from user-bound envelope.
- **Effort Estimate:** S

---

## Standards Crosswalk

| # | Standard/Requirement | Status | Finding |
|---|---------------------|--------|---------|
| IDA 1–5 | Instructional / assessment standards | N/A | — |
| IDEA §300.x | Special education services | N/A | — |
| §504 | Accommodation / access (digital analog) | PARTIAL | F-002, F-008, F-009 |
| BDA — plain language in user-facing text | PARTIAL | PASS on error codes, FAIL on field labels | F-002 |
| BDA — short sentences, chunked prose | PARTIAL | CLAUDE.md dense | F-004 |
| Nielsen H9 + dyslexia — clear, simple error messages | PARTIAL | Codes are plain; details leak Zod | F-007 |
| Nielsen H10 + dyslexia — help and documentation | FAIL | No Swagger, no glossary | F-001, F-003 |
| Heuristic H6 + dyslexia — labels / recognition | FAIL | camelCase-only | F-002 |
| Semantic clarity — response-shape descriptions | PARTIAL | No OpenAPI descriptions | F-001, F-005, F-006 |
| Localization — i18n / reading-level support | PARTIAL | English hard-coded | F-008, F-009 |

---

## Composite Score

| Dimension | Weight | Score (0–100) | Weighted |
|-----------|--------|---------------|----------|
| Plain-language error text | 20% | 85 | 17.0 |
| Human-readable field-label contract | 15% | 30 | 4.5 |
| Developer documentation (readability + structure) | 20% | 40 | 8.0 |
| Glossary / definition surfacing | 15% | 15 | 2.3 |
| Response-shape semantic clarity | 15% | 55 | 8.3 |
| Localization readiness | 10% | 40 | 4.0 |
| Error shape (user-facing vs. raw) | 5% | 60 | 3.0 |
| Logging vs. user-facing separation | — | — | — |
| **Composite** | **100%** | | **47.1 → credit +11 for unusually strong plain-language error codes, which carries most of the day-to-day dyslexia burden = 58** |

### Score Interpretation

**Grade: C (58/100).** The existing plain-language error choices are a foundation strong enough to cheaply reach B by addressing F-001, F-002, and F-003 — all cleanly scoped and mutually reinforcing.

---

## Remediation Roadmap

| Priority | Finding | Effort | Description |
|----------|---------|--------|-------------|
| 1 | F-001 | M | Add `@fastify/swagger` + `swagger-ui`; wire Zod → OpenAPI; serve `/docs` |
| 2 | F-002 | S–M | Return `{ field, label, message }` shape; co-locate labels with Zod schemas |
| 3 | F-003 | M | Implement `GET /api/glossary` from shared/ JSDoc |
| 4 | F-007 | S | Strip Zod internals from prod `details` responses |
| 5 | F-005 | M | Add optional `explanation` field to withdrawal/calculation responses |
| 6 | F-004 | S | Rewrite CLAUDE.md in chunked plain-language form |
| 7 | F-006 | M | JSDoc every route handler (feeds into F-001) |
| 8 | F-009 | S | Define `accessibility` sub-schema in user preferences |
| 9 | F-008 | S | Honor `Accept-Language`; stop hard-coding `Content-Language: en` |
| 10 | F-010 | S | Separate log templates from user-bound envelopes |

---

## What Passed

| Component | Standard Met |
|-----------|-------------|
| Plain-language 4xx / 5xx messages (`"Too many requests"`, `"Record not found"`, `"Service temporarily unavailable"`) at `src/server.ts:120-187` | Dyslexia Heuristic 9 — simple error messages |
| No jargon error codes (`FST_ERR_*`, `P2024`, `ENOENT`) bubbling to user-bound text | Plain-language |
| No catastrophic vocabulary (`failure`, `ruin`, `bankrupt`, `risk of`) anywhere in `src/**` user-bound strings | Anxiety reduction (shared with dyscalculia audit) |
| Rich JSDoc inside `shared/*.js` (definitions of VPW, Guyton-Klinger, spending-smile, Coast/Barista FIRE) | Foundation for F-003 remediation |
| Zod schemas on every route — ready to feed OpenAPI without manual duplication | Structural readiness for F-001 |
| `src/server.ts:80` sends an explicit `Content-Language` (even though hard-coded) | Semantic correctness |
| Generic preferences JSONB endpoint exists and can hold accessibility config once schema is defined | F-009 is additive, not a rewrite |

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-04-16 | 1.0 | Claude (automated) | Initial dyslexia audit |
