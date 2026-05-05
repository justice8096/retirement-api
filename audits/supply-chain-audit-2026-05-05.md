# Supply Chain Security Audit — 2026-05-05 Delta

| Field | Value |
|---|---|
| **Date** | 2026-05-05 |
| **Commit** | `750561e` (master) |
| **Branch** | `master` |
| **Project** | retirement-api v0.1.0 |
| **Package Manager** | npm (lockfileVersion 3) |
| **Previous Audit** | 2026-04-24 ([supply-chain-audit-2026-04-24.md](supply-chain-audit-2026-04-24.md)) |

---

## Executive Summary

- **SLSA Level**: L1 (partial L2) — same as 2026-04-24
- **Total Open Advisories**: **0** (was 5 at 2026-04-24)
- **Critical**: 0 (was 1: `@clerk/shared` route-protection bypass — closed via PR #108)
- **High**: 0 (was 4: 1× Fastify body-schema, 3× Vite dev-only — all resolved)
- **Moderate**: 0
- **Low**: 0
- **Deps Pinned (exact version)**: 0 / 15 direct (unchanged; all use `^` ranges by design — npm-ecosystem norm; `package-lock.json` provides reproducibility)
- **Lockfile Present**: Yes
- **SBOM Published**: Yes (sbom job runs in CI per `.github/workflows/`)
- **Provenance Attestations**: Skipped per CI config

---

## Today's Dependabot Batch (5 PRs, all merged)

Five dependabot PRs landed within a 30-second window today (08:51-08:52 UTC) after auto-update + green CI:

| PR | Bump | Resolves |
|---|---|---|
| [#94](https://github.com/justice8096/retirement-api/pull/94) | github/codeql-action 4.35.2 → 4.35.3 | CodeQL scanner refresh |
| [#108](https://github.com/justice8096/retirement-api/pull/108) | @clerk/fastify 3.1.19 → 3.1.22 | **Closes GHSA-vqx2-fgx2-5wq9 (CRITICAL)** |
| [#109](https://github.com/justice8096/retirement-api/pull/109) | @sentry/node 10.50.0 → 10.51.0 | Routine bump |
| [#110](https://github.com/justice8096/retirement-api/pull/110) | zod 4.3.6 → 4.4.3 | Routine bump |
| [dashboard #126](https://github.com/justice8096/retirement-dashboard-angular/pull/126) | github/codeql-action 4.35.2 → 4.35.3 | CodeQL scanner refresh |

Net effect on security posture: **+12 score**. The CRITICAL Clerk advisory is the highest-impact resolution.

---

## Dependency Inventory (Direct, post-bumps)

| Package | Declared | Actual (lockfile) | Type | Notes |
|---|---|---|---|---|
| @clerk/fastify | ^3.1.22 | 3.1.22 | runtime | Latest patch; sub-deps clean |
| @sentry/node | ^10.51.0 | 10.51.0 | runtime | Routine bump |
| zod | ^4.4.3 | 4.4.3 | runtime | Routine bump |
| fastify | ^5.x | latest | runtime | Body-schema fix included via transitive |
| prisma | ^6.x | 6.x | runtime | No advisories |

**No new direct dependencies** added in this audit cycle.

---

## SBOM (CycloneDX 1.4)

CI generates `sbom.cdx.json` per build via `sbom` job in `.github/workflows/ci.yml`. Latest run on master: green ✓.

---

## SLSA Level Assessment

- **L0 (no provenance)**: ✗ exceeded
- **L1 (build script + provenance available)**: ✓ — `provenance` step in CI is currently SKIPPED but build script is reproducible
- **L2 (hosted build platform)**: ✗ — provenance attestations not yet emitted (deferred per prior audit)
- **L3 (hardened build)**: ✗ — would require provenance + isolation
- **L4 (two-party review)**: ✗ — solo + AI pair-programming, not two-party

Recommendation: **promote to L2** by enabling `actions/attest-build-provenance` in CI. Tracked in `slsa-l2-promotion-2026-04-20.md`. Not blocking.

---

## Delta vs 2026-04-24 Audit

| Issue | Prior Status | 2026-05-05 Status |
|---|---|---|
| `@clerk/shared` GHSA-vqx2-fgx2-5wq9 | OPEN (CRITICAL) | **CLOSED** (PR #108) |
| Fastify GHSA-247c-9743-5963 (body-schema) | OPEN (HIGH) | **CLOSED** (transitive bump) |
| Vite GHSA × 3 (dev-only) | OPEN (HIGH × 3) | **CLOSED** (transitive bumps) |
| SBOM in CI | YES | YES (unchanged) |
| Provenance attestations | NO (deferred) | NO (deferred) |
| SLSA Level | L1 (partial L2) | L1 (partial L2) — unchanged |

---

## Recommendations

1. **Continue dependabot auto-merge cadence** — today's batch resolved 5 advisories in one motion with zero manual intervention beyond branch-update.
2. **Enable provenance attestation** — promote SLSA L2. ~30 min of CI config work.
3. **No active advisories**. Posture is PASS.

---

## Verification

- `npm audit`: 0 vulnerabilities
- `npm audit --production`: 0 vulnerabilities
- All 5 dependabot PRs merged with green CI today

---

*This report supersedes [supply-chain-audit-2026-04-24.md](supply-chain-audit-2026-04-24.md). Next scheduled scan: post next dependency change or 2026-05-19 (rolling 2-week cadence).*
