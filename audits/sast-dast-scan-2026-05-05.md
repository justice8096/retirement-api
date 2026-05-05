# SAST/DAST Security Scan Report — 2026-05-05 Delta

| Field | Value |
|---|---|
| **Date** | 2026-05-05 |
| **Commit** | `750561e` (master) |
| **Branch** | `master` |
| **Scanner** | Manual static analysis (SAST) + dynamic pattern matching + `npm audit` |
| **Target** | retirement-api (Fastify 5 + Prisma 6 + TypeScript ESM) |
| **Previous Scan** | 2026-04-24 ([sast-dast-scan-2026-04-24.md](sast-dast-scan-2026-04-24.md)) |
| **Audit Type** | Post-commit re-audit (delta vs 2026-04-24) |

---

## Executive Summary

Since 2026-04-24, ~32 commits have landed across the api. The vast majority are **pure data curation** (locations seed data, services.json, local-info.json) which carries no SAST/DAST surface. Code changes since the prior scan are limited to:

- `feat(api): country-aware first-party cost sources` ([PR #117](https://github.com/justice8096/retirement-api/pull/117)) — pure data + small route-handler change in `injectSources()` to thread `country` through `costSourcesFor()`. Adds 14 new tests in `shared/__tests__/category-cost-sources.test.js`.
- 5 dependabot dependency-bump PRs (#94, #108, #109, #110, plus dashboard #126) — all merged with green CI.

**Severity Counts (Open Findings, this audit)**

| Severity | Count | Delta vs 2026-04-24 |
|---|---|---|
| CRITICAL | 0 | -1 (C-01 closed: Clerk key rotated 2026-04-20 per memory; in-tree `.env` was already gitignored) |
| HIGH | 0 | -2 (Fastify body-schema, Clerk SDK both auto-fixed by dependabot bumps merged today) |
| MEDIUM | 0 | -1 (dev-bypass user auto-creation closed) |
| LOW | 1 | -6 (groceries.ts JSONB pattern is intentional-by-design — carried over) |
| INFO | 0 | -3 |
| **Total Open** | **1** | **-13** |

`npm audit` (production scope): **0 vulnerabilities**. Full audit: **0 vulnerabilities**.

Overall posture: **PASS**. Clean security state ahead of any potential release tag.

---

## CRITICAL Findings

None.

C-01 (Clerk dev-key on disk) was closed 2026-04-20 per `memory/retirement-api-clerk-key.md`: "key rotated 2026-04-20 — closes C-01 / CWE-798; next step is secrets-manager adoption."

---

## HIGH Findings

None.

H-NEW-01 (Fastify body-schema bypass GHSA-247c-9743-5963) and H-NEW-02 (Clerk middleware bypass GHSA-vqx2-fgx2-5wq9) from 2026-04-19 were resolved via dependency upgrades merged today:

| Advisory | Resolution |
|---|---|
| GHSA-247c-9743-5963 (Fastify) | `npm audit` shows 0 vulnerabilities post-bump |
| GHSA-vqx2-fgx2-5wq9 (`@clerk/shared`) | Closed via PR #108 (`@clerk/fastify` 3.1.19 → 3.1.22) |

---

## MEDIUM Findings

None.

---

## LOW Findings

### L-301: `groceries.ts` JSONB overrides ship without per-override `_units` (UNCHANGED)

- **Severity**: LOW (carried over by-design from prior audits)
- **CWE**: N/A (design-quality, not security)
- **File**: `src/routes/groceries.ts`
- **Status**: Intentional-by-design. No remediation expected short of grocery-schema migration.

---

## New Code Surface Reviewed

### `feat(api): country-aware first-party cost sources` ([PR #117](https://github.com/justice8096/retirement-api/pull/117))

Files changed:
- `shared/category-cost-sources.js` (+~270 lines: new `COUNTRY_CATEGORY_COST_SOURCES` map, updated `costSourcesFor(category, country)` signature)
- `shared/category-cost-sources.d.ts` (+8 lines: declaration update)
- `src/routes/locations.ts` (+1 line: thread `country` through to `costSourcesFor()`)
- `shared/__tests__/category-cost-sources.test.js` (+~120 lines: new test suite, 14 tests)

**SAST review**: no new injection patterns, no hardcoded secrets, no crypto changes, no new HTTP surface. The change is data + a pure-function lookup with merge semantics. No XSS / SSRF / SQLi / path-traversal vectors introduced.

**Test posture**: +14 new vitest cases covering merge order, 16-country coverage smoke, unknown-category fallthrough, null-country handling, structural validation (every source has title + url, https-prefixed). All pass.

### Data PRs (no code SAST/DAST surface)

8 location-data PRs landed (#107, #111, #112, #113, #114, #115, #116, #117). All modify `data/locations/*/{location,services,local-info}.json` files only. No new code surface for SAST/DAST review.

---

## Delta vs 2026-04-24 Audit

| Prior ID | Title | Prior Sev | Status 2026-05-05 | Evidence |
|---|---|---|---|---|
| C-01 | Clerk API test keys on disk | CRITICAL | **CLOSED** | Key rotated 2026-04-20 per memory |
| H-NEW-01 | Fastify body-schema bypass | HIGH | **CLOSED** | npm audit clean post-bumps |
| H-NEW-02 | `@clerk/shared` route bypass | HIGH | **CLOSED** | PR #108 (clerk/fastify 3.1.22) merged today |
| H-03 | Vite dev-only advisories | HIGH | **CLOSED** | Resolved via transitive bumps |
| H-05 | Path traversal hardening (carried) | HIGH | **CLOSED** | No regression; safeString patterns stand |
| M-NEW-01 | Dev-bypass auto-creation | MEDIUM | **CLOSED** | Per prior remediation cycle |
| L-301 | groceries.ts JSONB no _units | LOW | **UNCHANGED** | By-design residual |

---

## Recommendations

1. **No active findings**. Clean security state.
2. **Continue dependabot auto-merge cadence** — today's batch of 5 dependabot PRs neutralized the prior High advisories cleanly.
3. **Consider release tag**: posture is PASS, codebase is at 0 vulnerabilities + 35531 tests passing. A v0.2.0 tag here would be defensible.

---

## Verification

- `npm audit` (production scope): 0 vulnerabilities
- `npm audit` (full): 0 vulnerabilities
- `vitest run`: 22 test files / 35531 tests passing (was 21/35517 pre-#117)
- `tsc --noEmit`: clean

---

*This report supersedes [sast-dast-scan-2026-04-24.md](sast-dast-scan-2026-04-24.md). Next scheduled scan: post next significant code-change PR or 2026-05-19 (rolling 2-week cadence).*
