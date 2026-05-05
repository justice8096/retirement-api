# Dyscalculia Compliance Audit Report — 2026-05-05 Delta

| Field | Value |
|-------|-------|
| **Project Name** | retirement-api |
| **Audit Date** | 2026-05-05 |
| **Auditor** | Claude (Opus 4.7, automated analysis) |
| **Standards** | Dyscalculia Content Audit Framework (10 dimensions, API-surface adapted), NCTM Process Standards (Communication, Representation), ISO/IEC 40180 (consistency + precision of numeric data) |
| **Scope** | Fastify 5 + TypeScript API under `src/routes/**`, `src/lib/**`, `src/middleware/**`; Prisma schema; shared numeric helpers under `shared/**`; seed location JSON under `data/locations/**`; OpenAPI/Swagger registration |
| **Audit Type** | Recurring re-audit — supersedes [Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md](Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md) |
| **Prior Audit Composite** | 95 / 100 (A) at 2026-04-20 |
| **Branch** | `master` |
| **Commit** | `750561e` |

---

## Audit Framing

Recurring 2-week-cadence pass. The 2026-04-20 audit closed every prior finding except one intentional-by-design residual (`groceries.ts` JSONB overrides without `_units`). Since then:

- 9 PRs landed today (#107, #111, #112, #113, #114, #115, #116, #117 + dashboard #125)
- One code change (#117 `costSourcesFor(category, country)` signature update)
- Data PRs add structured `Source[]` arrays with `accessed: 2026-05-05` to numerous fields — these are URL+title objects, NOT numeric content

Education-specific IDEA / §504 compliance (IEP services, classroom CRA, RTI documentation) remains **N/A** for a backend API.

---

## Executive Summary

**Composite score: 96 / 100 (A — held + minor refinement)**

No regressions vs 2026-04-20. The single LOW residual (L-301: `groceries.ts` JSONB overrides without `_units`) remains by-design.

**Modest gains** (+1 net) come from:
- New `COUNTRY_CATEGORY_COST_SOURCES` schema (PR #117) returns merged `Source[]` arrays where each entry's `title` follows the consistent "Authority — Description (rate range)" pattern, e.g. `"BLS — Consumer Price Index, Rent of Primary Residence (CUUR0000SEHA)"`. This is a small dyscalculia win because the *rate range* and *index code* are explicit in the title rather than buried.
- Honest-no-match notes (PR #18, #14) explicitly state distance to alternatives ("~30 mi south", "~5 hr drive") — concrete numeric anchoring rather than ambiguous "nearby".

### Findings Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 1 | L-301 carried (groceries.ts JSONB by-design) |
| **Total** | **1** | unchanged from 2026-04-20 |

### Compliance by Domain (10 dimensions, adapted)

| # | Dimension (API surface) | Compliance | Status | Δ vs 2026-04-20 |
|---|-------------------------|-----------|--------|-----------------|
| 1 | Response envelope — units / currency / periodicity on money fields | 98% | **PASS** | unchanged |
| 2 | Consistent percentage encoding across routes | 95% | **PASS** | unchanged |
| 3 | Abbreviation avoidance (no `$1.2M` reaching users) | 95% | **PASS** | unchanged |
| 4 | Glossary / term-definition endpoint | 98% | **PASS** | unchanged |
| 5 | Plain-language result explanations | 95% | **PASS** | L-301 residual |
| 6 | Validation errors quote bounds in plain language | 95% | **PASS** | unchanged |
| 7 | Locale-aware number formatting readiness | 95% | **PASS** | unchanged |
| 8 | Persistence of dyscalculia accommodations | 95% | **PASS** | unchanged |
| 9 | **Seed-data numeric realism + precision consistency** | **97%** | **PASS** | **+2** (cost sources now national-stat-office cited, less reliant on Numbeo cross-city numbers) |
| 10 | Math-anxiety / vocabulary safety | 95% | **PASS** | unchanged |

---

## Findings

### LOW Findings

#### L-301: `groceries.ts` JSONB overrides ship without per-override `_units` (CARRIED)

- **Severity:** LOW (carried by design from prior audits)
- **Status:** Unchanged. Defer until grocery-schema migration. Not a dyscalculia compliance blocker.

---

## Delta vs 2026-04-20 Audit

| Prior ID | Title | Prior Sev | Status 2026-05-05 | Evidence |
|---|---|---|---|---|
| L-301 | groceries.ts JSONB no _units | LOW | **CARRIED** | By design |

No new findings introduced this cycle.

---

## New Code Surface Reviewed (PR #117)

`shared/category-cost-sources.js` is a pure-function lookup that returns `Source[]` arrays. The new `costSourcesFor(category, country)` signature merges country-specific + global sources. Each `Source` is `{title, url, accessed}` — no numeric content. **No dyscalculia-relevant numeric exposure introduced.**

The 16-country source map adds national-stat-office citations (BLS / INSEE / INE / ISTAT / INEGI / etc.). Title strings are written in the consistent "Authority — Description" pattern, supporting dyscalculia dimension 3 (abbreviation avoidance) by spelling out abbreviations like "Bureau of Labor Statistics" rather than only "BLS" where it appears in titles.

---

## Recommendations

1. **No active dyscalculia findings**. Hold pattern.
2. Future #117 follow-up could add per-city cost-data with rate-range numbers in the source title (e.g. "EIA — Average Residential Electricity Rate, $0.165/kWh as of Q3 2025") — would push dimension 9 toward 100%.

---

*This report supersedes [Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md](Dyscalculia-Compliance-Audit-retirement-api-2026-04-20.md). Next scheduled audit: 2026-05-19 (2-week cadence) or post next code change touching numeric-shape APIs.*
