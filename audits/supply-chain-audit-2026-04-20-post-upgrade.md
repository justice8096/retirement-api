# Supply Chain Security Audit — post-Dependabot-drain refresh

| Field | Value |
|---|---|
| **Date** | 2026-04-20 (post-upgrade pass) |
| **Commit** | a583dda (tip of master after #32 + 9 dependabot merges) |
| **Branch** | master |
| **Project** | retirement-api v0.1.0 |
| **Package Manager** | npm (lockfileVersion 3) |
| **Previous Audit** | 2026-04-20 morning (`audits/supply-chain-audit-2026-04-20.md`) |
| **Supersedes** | previous 2026-04-20 audit |

---

## Delta vs 2026-04-20 (morning)

| Indicator | Previous (morning) | Now (post-drain) | Change |
|---|---|---|---|
| `npm audit` total | 0 | **0** | Held at zero |
| Open GitHub Dependabot alerts | 0 | **0** | Held at zero |
| Direct prod-dep bumps merged | — | 5 (fastify group × 3 + @sentry/node + stripe 20→22) | New |
| Direct dev-dep bumps merged | — | 1 (@types/node 25.5→25.6) | New |
| CI action bumps merged | — | 6 (checkout, setup-node, hadolint, codeql, upload-artifact, docker/node-alpine major) | New |
| `@clerk/fastify` | 3.1.4 (declared `^`) | **3.1.15** (declared `^3.1.15`) | resolved bump |
| `stripe` | 20.4.1 (exact pin) | **22.0.2** (exact pin) | +2 major |
| Docker base image | `node:20-alpine` | **`node:25-alpine`** | +5 major |
| `@sentry/node` | 10.45.0 | **10.49.0** | patch |
| Prisma 6 → 7 bundle (#28) | Not offered | **Closed / deferred** (major breaking; same call as prior #20) | Logged |
| Typescript 5.9 → 6.0 (#31) | Not offered | **Left open / deferred** (memory: Angular 21 matrix only goes to TS 5.9; API has no reason to race ahead) | Logged |
| SLSA level | L1 | **L1** | Held |
| SBOM | Present | Present | Held |
| `continue-on-error` on audit/typecheck/build | None | None | Held |

**Net:** all 9 mergeable Dependabot PRs landed (6 CI SHA bumps + 3 runtime/package bumps). Two majors held back deliberately: Prisma 7 (20+ call sites need migration) and TypeScript 6 (Fastify/Prisma compat unverified). Zero new vulnerabilities introduced; zero old ones re-surfaced. Posture is the same L1 as the morning audit, with the dependency graph now one cycle ahead of drift.

---

## Executive Summary

- **SLSA Level**: **L1** (SBOM + hermetic `npm ci` + CI-as-code)
- **Total Open Advisories**: **0**
- **Direct deps**: 14 runtime + 5 dev = 19 (unchanged from morning)
- **Exact pins**: 1 / 19 (`stripe@22.0.2`) — first-and-still-only exact pin
- **Lockfile present**: Yes (`package-lock.json`, lockfileVersion 3, sha512 integrity)
- **SBOM published**: Yes (CycloneDX, 90-day retention per run)
- **Provenance attestations**: No (SLSA L2 gap)
- **Commit signing enforced**: No (branch-protection gap)
- **Renovate / Dependabot**: Dependabot only — running weekly, grouped (fastify, prisma, clerk, sentry, dev-tooling). Dev-tooling configured to exclude bundled majors (post-#27 split-majors policy).

The security-audit CI gate remains authoritative: `npm audit --audit-level=high` runs without `continue-on-error`, so any future HIGH disclosure will block merge.

---

## Dependency Inventory (Direct)

| Package | Declared | Resolved | Notes |
|---|---|---|---|
| @clerk/fastify | ^3.1.15 | 3.1.15 | Bumped this cycle (#21 earlier + transitive effects) |
| @fastify/cookie | ^11.0.2 | — | **Fastify group** (#19): 10.x → 11.x major — `@fastify/cookie`, `@fastify/cors`, `@fastify/helmet` |
| @fastify/cors | ^11.2.0 | — | Fastify group (#19) |
| @fastify/helmet | ^13.0.2 | — | Fastify group (#19). CORP policy hardened to `same-site` (#32). |
| @fastify/rate-limit | ^10.0.0 | — | Not bumped this cycle |
| @fastify/swagger | ^9.0.0 | — | Not bumped this cycle |
| @fastify/swagger-ui | ^5.0.0 | — | Not bumped this cycle |
| @prisma/client | ^6.0.0 | 6.19.2 | **Prisma 7 bump (#28) closed/deferred** — major breaking migration |
| @sentry/node | ^10.49.0 | 10.49.0 | Bumped this cycle |
| dotenv | ^16.4.0 | 16.x | Unchanged |
| fastify | ^5.0.0 | 5.x | Unchanged (5.8.5+ keeps A-01/19 cleared) |
| ioredis | ^5.10.1 | 5.x | Unchanged |
| **stripe** | **22.0.2** | 22.0.2 | **Exact pin — bumped 20→22 this cycle (#30)** |
| zod | ^3.23.0 | 3.x | Unchanged |
| @types/node | ^25.6.0 | 25.6.0 | Bumped this cycle (#29) |
| prisma | ^6.0.0 | 6.19.2 | Same as @prisma/client — deferred |
| tsx | ^4.21.0 | 4.x | Unchanged |
| typescript | ^5.9.3 | 5.9.x | **TS 6 bump (#31) left open / deferred** |
| vitest | ^3.0.0 | 3.x | Unchanged |

---

## Vulnerability Detail

**None.** `npm audit --json` returns `"vulnerabilities": {}`:

```json
"metadata": {
  "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 },
  "dependencies": { "prod": 207, "dev": 99, "optional": 52, "peer": 0, "total": 305 }
}
```

GitHub Dependabot alerts: **0 open** (verified via `gh api /repos/justice8096/retirement-api/dependabot/alerts`).

---

## Risk Matrix

| Dimension | Status | Notes |
|-----------|--------|-------|
| Dependency pinning | PARTIAL | 1/19 exact pin (`stripe`); rest are `^`/`~` with lockfile |
| Lockfile integrity | GOOD | v3, sha512, committed |
| CI hardening | GOOD | SHA-pinned actions; 6 bumped this cycle; no `continue-on-error` on critical steps |
| Dependency update strategy | GOOD | Grouped Dependabot + split-majors policy for dev-tooling (#27) |
| SBOM generation | GOOD | CycloneDX per push, 90-day artifact retention |
| Signed commits | ABSENT | Gap |
| Build provenance (SLSA) | L1 | SBOM + hermetic + CI-as-code. L2 = attestations. |
| Docker hardening | IMPROVED | Base image now `node:25-alpine` (#14); digest-pinning still pending |
| Private registry | NO | Public npm only |
| `postinstall` audit | GOOD | No install-time lifecycle scripts beyond `prisma` (declared, reviewed) |
| Secret scanning | GOOD | GitHub secret-scanning + push-protection on the public repo |
| CodeQL | GOOD | SHA-pinned to latest (#18) |

---

## Open Governance Gaps (unchanged from morning)

- **SLSA L2**: no attestations yet. Add `actions/attest-build-provenance@<SHA>` post-build.
- **Commit signing**: not enforced.
- **Docker digest pinning**: Dockerfile uses `FROM node:25-alpine`; migrate to `FROM node:25-alpine@sha256:...` for deterministic builds.
- **Prisma 7 migration**: tracked for a scheduled `feat/prisma-7-upgrade` branch (20+ import-site changes + client regeneration + test sweep).
- **TypeScript 6 bump**: deferred pending Fastify + Prisma compatibility verification.

---

## Follow-ups

1. **Prisma 7 migration** — schedule as a standalone task; estimated 1 day of focused work.
2. **TypeScript 6 bump** — revisit after Prisma 7 + next Fastify minor lands.
3. **Next scheduled audit** — on next substantive dep bump merge, or in ≤30 days, whichever comes first.
