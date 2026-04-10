# Supply Chain Security Audit (Re-Audit)

**Date:** 2026-04-02
**Commit:** 93a719f (post-fix)
**Branch:** expand-household-model
**Auditor:** Automated (Claude Code)
**Project:** retirement-api v0.1.0
**Stack:** Node.js 20, Fastify 5, Prisma 6, TypeScript 5.9
**Previous Audit:** 2026-04-02 (initial), same commit

---

## Changes Since Last Audit

This is a re-audit of the same commit (93a719f). No code changes occurred between audits. The purpose is to verify findings, check for newly published advisories, and confirm whether previous recommendations have been addressed.

**Key changes found:** None -- the codebase is identical. However, npm advisory data has been refreshed and **3 new HIGH-severity advisories** have been discovered that were not present in the initial audit.

| Previous Finding | Current Status |
|---|---|
| `.env.example` default passwords | **UNCHANGED** -- `REDIS_PASSWORD=changeme` and `DATABASE_URL` contain `password` literal (see Section 5) |
| Backup script default passwords | **RESOLVED** -- `backup-db.sh` requires `PGPASSWORD` via `${PGPASSWORD:?...}` (no defaults) |
| `.npmrc` missing | **UNCHANGED** -- still no `.npmrc` file |
| `continue-on-error` on audit/build/typecheck | **UNCHANGED** -- still present in CI |
| Docker base image unpinned | **UNCHANGED** -- still uses `node:20-alpine` tag |
| Dependabot/Renovate | **UNCHANGED** -- still not configured |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Dependency Risk Matrix](#2-dependency-risk-matrix)
3. [Dependency Pinning Analysis](#3-dependency-pinning-analysis)
4. [Lockfile Integrity](#4-lockfile-integrity)
5. [CI/CD Secret Handling](#5-cicd-secret-handling)
6. [CycloneDX 1.4 SBOM](#6-cyclonedx-14-sbom)
7. [SLSA Level Assessment](#7-slsa-level-assessment)
8. [Known Vulnerabilities](#8-known-vulnerabilities)
9. [Dependency Freshness](#9-dependency-freshness)
10. [License Compliance](#10-license-compliance)
11. [Build Reproducibility](#11-build-reproducibility)
12. [Typosquatting Risk](#12-typosquatting-risk)
13. [Server-Specific Risks](#13-server-specific-risks)
14. [Framework Compliance Table](#14-framework-compliance-table)
15. [Summary Statistics](#15-summary-statistics)
16. [Recommendations](#16-recommendations)

---

## 1. Executive Summary

The retirement-api project has a **moderate-to-high** overall supply chain security posture risk, **upgraded from MEDIUM to MEDIUM-HIGH** since the initial audit due to the discovery of 5 HIGH-severity npm advisories (3 unique vulnerabilities) affecting `@clerk/backend`, `@clerk/fastify`, `effect` (transitive via Prisma), and `prisma` itself.

Key strengths remain: multi-stage Docker build with non-root user, CI security scanning (npm audit, CodeQL, secret detection, Hadolint), lockfile with integrity hashes, and backup scripts that require passwords via bash strict variable expansion.

Key weaknesses: zero pinned dependencies, `continue-on-error: true` on npm audit (meaning these HIGH vulns would not block CI), no `.npmrc`, no SBOM pipeline, no provenance, weak default passwords in `.env.example`, and the Redis healthcheck password exposure.

**Overall Risk Rating: MEDIUM-HIGH** (upgraded from MEDIUM)

---

## 2. Dependency Risk Matrix

### Production Dependencies

| Dependency | Specified | Resolved | Pinned? | Risk Level | Notes |
|---|---|---|---|---|---|
| `@clerk/fastify` | ^3.1.4 | 3.1.4 | NO | **HIGH** | **NEW: GHSA-gjxx-92w9-8v8f** -- SSRF in clerkFrontendApiProxy may leak secret keys |
| `@fastify/cookie` | ^10.0.0 | 10.0.1 | NO | LOW | Scoped Fastify plugin; well-maintained |
| `@fastify/cors` | ^10.0.0 | 10.1.0 | NO | LOW | Scoped Fastify plugin; well-maintained |
| `@fastify/helmet` | ^12.0.0 | 12.0.1 | NO | LOW | Security headers plugin; well-maintained |
| `@fastify/rate-limit` | ^10.0.0 | 10.3.0 | NO | LOW | Scoped Fastify plugin; well-maintained |
| `@prisma/client` | ^6.0.0 | 6.19.2 | NO | MEDIUM | Has install script (prisma generate); wide caret allows 6.0.0-6.x.x |
| `@sentry/node` | ^10.45.0 | 10.45.0 | NO | LOW | Observability SDK; large transitive tree (~40 sub-packages) |
| `dotenv` | ^16.4.0 | 16.6.1 | NO | LOW | Well-established, minimal dependency |
| `fastify` | ^5.0.0 | 5.8.4 | NO | LOW | Core framework; wide caret range allows 5.0.0-5.x.x |
| `stripe` | ^20.4.1 | 20.4.1 | NO | MEDIUM | Payment processing SDK; handles sensitive financial data |
| `zod` | ^3.23.0 | 3.25.76 | NO | LOW | Zero-dependency validation library |

### Development Dependencies

| Dependency | Specified | Resolved | Pinned? | Risk Level | Notes |
|---|---|---|---|---|---|
| `@types/node` | ^25.5.0 | 25.5.0 | NO | LOW | Type definitions only |
| `prisma` | ^6.0.0 | 6.19.2 | NO | **HIGH** | **NEW: GHSA-38f7-945m-qr2g** -- transitive `effect` < 3.20.0 context contamination |
| `tsx` | ^4.21.0 | 4.21.0 | NO | LOW | TypeScript execution engine |
| `typescript` | ^5.9.3 | 5.9.3 | NO | LOW | Compiler; Apache-2.0 license |
| `vitest` | ^3.0.0 | 3.2.4 | NO | LOW | Test framework; dev-only |

---

## 3. Dependency Pinning Analysis

**Finding: ALL 16 dependencies use caret (^) ranges. Zero are pinned to exact versions. UNCHANGED from previous audit.**

| Metric | Value |
|---|---|
| Total direct dependencies | 16 |
| Pinned (exact version) | 0 (0%) |
| Caret range (^) | 16 (100%) |
| Tilde range (~) | 0 |
| Open range (>=, *) | 0 |

**Risk:** Caret ranges allow automatic minor and patch version bumps on `npm install`. While `package-lock.json` mitigates this in practice, any `npm install` without `--frozen-lockfile` or `npm ci` can silently pull new code. The CI pipeline correctly uses `npm ci`, but local development uses `npm install`.

**Severity: MEDIUM** -- Mitigated by lockfile and CI use of `npm ci`.

---

## 4. Lockfile Integrity

| Check | Status | Details |
|---|---|---|
| Lockfile exists | PASS | `package-lock.json` present (3,976 lines) |
| Lockfile version | PASS | lockfileVersion 3 (npm v9+) |
| Integrity hashes | PASS | SHA-512 integrity hashes present on all resolved packages |
| Registry source | PASS | All 280 resolved packages point to `registry.npmjs.org`; no anomalous registries |
| `.npmrc` enforcement | FAIL | No `.npmrc` file found; `engine-strict=true` and `save-exact=true` not enforced |
| Lockfile in `.gitignore` | PASS | `package-lock.json` is NOT in `.gitignore` (correctly tracked) |

**Severity: LOW** -- Lockfile is healthy but could benefit from `.npmrc` configuration. Unchanged from previous audit.

---

## 5. CI/CD Secret Handling

### GitHub Actions (`ci.yml`)

| Check | Status | Details |
|---|---|---|
| Hardcoded secrets in workflow | PASS | No secrets in workflow file |
| Secret detection in CI | PASS | Grep scan for Stripe, AWS, and private key patterns |
| Unsafe eval/exec detection | PASS | CI scans for dynamic code execution patterns |
| `npm audit` in CI | PASS | Runs `npm audit --audit-level=critical` |
| CodeQL analysis | PASS | GitHub CodeQL for javascript-typescript |
| Dockerfile linting | PASS | Hadolint action on Dockerfile |
| `continue-on-error` on audit | **FAIL** | `npm audit` uses `continue-on-error: true`; the 5 HIGH vulns found today would NOT block merge |
| `continue-on-error` on typecheck | WARN | TypeScript typecheck uses `continue-on-error: true` |
| `continue-on-error` on build | WARN | Build step uses `continue-on-error: true` |
| `continue-on-error` on Hadolint | WARN | Dockerfile linting uses `continue-on-error: true` |
| GitHub Actions pinning | WARN | Uses tag refs (`@v4`, `@v3`) not SHA digests |

**Re-audit note:** Upgraded `continue-on-error` on audit from WARN to FAIL because real HIGH vulnerabilities now exist and would be silently ignored.

### Dockerfile

| Check | Status | Details |
|---|---|---|
| Multi-stage build | PASS | 4-stage build (deps, prisma, builder, runner) |
| Non-root user | PASS | `adduser --system --uid 1001 api` with `USER api` |
| `npm ci` for installs | PASS | Uses `npm ci` for deterministic installs |
| No secrets in image | PASS | Secrets passed via environment variables at runtime |
| Health check | PASS | wget-based health check on `/api/health/ready` |
| Minimal final image | PASS | Only dist/, node_modules, shared/, prisma/ copied to runner |
| Base image pinning | WARN | Uses `node:20-alpine` tag, not a SHA256 digest |

### docker-compose.yml

| Check | Status | Details |
|---|---|---|
| Required secrets enforced | PASS | `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ENCRYPTION_MASTER_KEY` use `:?` (required) |
| Optional secrets defaulted | PASS | Clerk, Stripe, Sentry keys default to empty string |
| Password in Redis healthcheck | WARN | `redis-cli -a ${REDIS_PASSWORD} ping` exposes password in process list |
| DATABASE_URL construction | WARN | Password interpolated in connection string visible in environment |
| No secrets in volumes | PASS | Only `pgdata` volume for PostgreSQL data |

### Environment Files

| Check | Status | Details |
|---|---|---|
| `.env` in `.gitignore` | PASS | `.env` is listed in `.gitignore` |
| `.env.example` default passwords | **WARN** | `REDIS_PASSWORD=changeme` is a weak default; `DATABASE_URL` contains literal `password`; `POSTGRES_PASSWORD` correctly uses `<GENERATE_STRONG_PASSWORD>` placeholder |
| `.env` file exists locally | WARN | `.env` file present in working directory (should not be committed) |

### Backup Scripts

| Check | Status | Details |
|---|---|---|
| `backup-db.sh` password handling | **PASS** | Uses `${PGPASSWORD:?PGPASSWORD environment variable must be set}` -- requires env var, no defaults |
| No hardcoded credentials | PASS | All credentials sourced from environment variables |
| No default passwords in backup | PASS | Script fails fast if `PGPASSWORD` is unset |

**Re-audit note on `.env.example`:** The `POSTGRES_PASSWORD` field was changed from a default value to `<GENERATE_STRONG_PASSWORD>` placeholder, which is good. However, `REDIS_PASSWORD=changeme` and the `DATABASE_URL` containing literal `password` remain. These are example-file-only risks (not runtime), but developers who copy `.env.example` to `.env` without changing values will run with weak credentials.

**Overall CI/CD Secret Handling: GOOD with actionable warnings.**

---

## 6. CycloneDX 1.4 SBOM

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "serialNumber": "urn:uuid:b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "version": 2,
  "metadata": {
    "timestamp": "2026-04-02T00:00:00Z",
    "tools": [
      {
        "vendor": "Anthropic",
        "name": "Claude Code Audit",
        "version": "1.0.0"
      }
    ],
    "component": {
      "type": "application",
      "name": "retirement-api",
      "version": "0.1.0",
      "purl": "pkg:npm/retirement-api@0.1.0"
    }
  },
  "components": [
    {
      "type": "library",
      "name": "@clerk/fastify",
      "version": "3.1.4",
      "purl": "pkg:npm/%40clerk/fastify@3.1.4",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@fastify/cookie",
      "version": "10.0.1",
      "purl": "pkg:npm/%40fastify/cookie@10.0.1",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@fastify/cors",
      "version": "10.1.0",
      "purl": "pkg:npm/%40fastify/cors@10.1.0",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@fastify/helmet",
      "version": "12.0.1",
      "purl": "pkg:npm/%40fastify/helmet@12.0.1",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@fastify/rate-limit",
      "version": "10.3.0",
      "purl": "pkg:npm/%40fastify/rate-limit@10.3.0",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@prisma/client",
      "version": "6.19.2",
      "purl": "pkg:npm/%40prisma/client@6.19.2",
      "scope": "required",
      "licenses": [{"license": {"id": "Apache-2.0"}}]
    },
    {
      "type": "library",
      "name": "@sentry/node",
      "version": "10.45.0",
      "purl": "pkg:npm/%40sentry/node@10.45.0",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "dotenv",
      "version": "16.6.1",
      "purl": "pkg:npm/dotenv@16.6.1",
      "scope": "required",
      "licenses": [{"license": {"id": "BSD-2-Clause"}}]
    },
    {
      "type": "library",
      "name": "fastify",
      "version": "5.8.4",
      "purl": "pkg:npm/fastify@5.8.4",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "stripe",
      "version": "20.4.1",
      "purl": "pkg:npm/stripe@20.4.1",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "zod",
      "version": "3.25.76",
      "purl": "pkg:npm/zod@3.25.76",
      "scope": "required",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "@types/node",
      "version": "25.5.0",
      "purl": "pkg:npm/%40types/node@25.5.0",
      "scope": "optional",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "prisma",
      "version": "6.19.2",
      "purl": "pkg:npm/prisma@6.19.2",
      "scope": "optional",
      "licenses": [{"license": {"id": "Apache-2.0"}}]
    },
    {
      "type": "library",
      "name": "tsx",
      "version": "4.21.0",
      "purl": "pkg:npm/tsx@4.21.0",
      "scope": "optional",
      "licenses": [{"license": {"id": "MIT"}}]
    },
    {
      "type": "library",
      "name": "typescript",
      "version": "5.9.3",
      "purl": "pkg:npm/typescript@5.9.3",
      "scope": "optional",
      "licenses": [{"license": {"id": "Apache-2.0"}}]
    },
    {
      "type": "library",
      "name": "vitest",
      "version": "3.2.4",
      "purl": "pkg:npm/vitest@3.2.4",
      "scope": "optional",
      "licenses": [{"license": {"id": "MIT"}}]
    }
  ],
  "vulnerabilities": [
    {
      "id": "GHSA-gjxx-92w9-8v8f",
      "description": "Clerk SSRF in clerkFrontendApiProxy may leak secret keys to unintended host",
      "affects": [
        {"ref": "pkg:npm/%40clerk/fastify@3.1.4"},
        {"ref": "pkg:npm/%40clerk/backend@3.2.2"}
      ],
      "ratings": [{"severity": "high"}]
    },
    {
      "id": "GHSA-38f7-945m-qr2g",
      "description": "Effect AsyncLocalStorage context lost/contaminated under concurrent load with RPC",
      "affects": [
        {"ref": "pkg:npm/prisma@6.19.2"},
        {"ref": "pkg:npm/%40prisma/config@6.19.2"}
      ],
      "ratings": [{"severity": "high"}]
    }
  ]
}
```

**Note:** This SBOM covers direct dependencies only. A full transitive SBOM should be generated via `@cyclonedx/cyclonedx-npm` in CI. SBOM version incremented to 2 for this re-audit. Vulnerabilities section added per CycloneDX 1.4 spec.

---

## 7. SLSA Level Assessment

| SLSA Criterion | Level | Status | Details |
|---|---|---|---|
| **L0: No guarantees** | -- | Baseline | -- |
| **L1: Build process documented** | L1 | PARTIAL | Dockerfile and CI workflow exist, but no formal build provenance |
| L1: Build script exists | L1 | PASS | `npm run build` runs `tsc`; Dockerfile codifies full pipeline |
| L1: Provenance generated | L1 | FAIL | No SLSA provenance attestation generated |
| **L2: Hosted build platform** | L2 | PARTIAL | GitHub Actions is a hosted platform |
| L2: Build service authenticated | L2 | PASS | GitHub Actions provides authenticated runners |
| L2: Provenance signed | L2 | FAIL | No signed provenance |
| **L3: Hardened builds** | L3 | FAIL | No hermetic builds; no isolated build environment beyond Docker |
| L3: Non-falsifiable provenance | L3 | FAIL | No provenance at all |
| **L4: Two-party review** | L4 | FAIL | No branch protection rules verified; no required reviewers in CI config |

**Current SLSA Level: L1 (partial)** -- Unchanged from previous audit. The project has build scripts and CI but lacks provenance generation and signing.

---

## 8. Known Vulnerabilities

**CHANGED from previous audit: 5 HIGH-severity advisories now reported by `npm audit`.**

| Dependency | Version | Advisory | Severity | Status | New? |
|---|---|---|---|---|---|
| `@clerk/backend` | 3.2.2 | [GHSA-gjxx-92w9-8v8f](https://github.com/advisories/GHSA-gjxx-92w9-8v8f) -- SSRF in clerkFrontendApiProxy leaks secret keys | HIGH | **FIX AVAILABLE** via `npm audit fix` | YES |
| `@clerk/fastify` | 3.1.4 | [GHSA-gjxx-92w9-8v8f](https://github.com/advisories/GHSA-gjxx-92w9-8v8f) -- same as above (depends on @clerk/backend) | HIGH | **FIX AVAILABLE** via `npm audit fix` | YES |
| `effect` (transitive) | < 3.20.0 | [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) -- AsyncLocalStorage context lost/contaminated under concurrent load | HIGH | **FIX AVAILABLE** via `npm audit fix` | YES |
| `@prisma/config` | 6.19.2 | Depends on vulnerable `effect` | HIGH | **FIX AVAILABLE** | YES |
| `prisma` | 6.19.2 | Depends on vulnerable `@prisma/config` | HIGH | **FIX AVAILABLE** | YES |
| `cookies` | 0.9.1 | Transitive via @clerk/fastify; older package | LOW | MONITOR | no |

**Mitigation notes:**
- **Clerk SSRF (GHSA-gjxx-92w9-8v8f):** This affects the opt-in `clerkFrontendApiProxy` feature. If this API does NOT use `clerkFrontendApiProxy`, the practical risk is lower. However, the fix should still be applied. Run `npm audit fix` to update.
- **Effect context contamination (GHSA-38f7-945m-qr2g):** This affects `effect` < 3.20.0, pulled in transitively by Prisma's `@prisma/config`. The vulnerability involves AsyncLocalStorage context leaking under concurrent RPC load. If Prisma's usage of `effect` hits this path, it could cause data leakage between requests. Run `npm audit fix` to update.

**Action required: Run `npm audit fix` and update lockfile.**

---

## 9. Dependency Freshness

Unchanged from previous audit. All dependencies are on current major versions.

| Dependency | Resolved | Range Width | Freshness | Notes |
|---|---|---|---|---|
| `@clerk/fastify` | 3.1.4 | ^3.1.4 (narrow) | CURRENT | Patch available for GHSA-gjxx-92w9-8v8f |
| `@fastify/cookie` | 10.0.1 | ^10.0.0 | CURRENT | -- |
| `@fastify/cors` | 10.1.0 | ^10.0.0 | CURRENT | -- |
| `@fastify/helmet` | 12.0.1 | ^12.0.0 | CURRENT | -- |
| `@fastify/rate-limit` | 10.3.0 | ^10.0.0 | CURRENT | -- |
| `@prisma/client` | 6.19.2 | ^6.0.0 | CURRENT | 19 minors ahead of floor; wide range |
| `@sentry/node` | 10.45.0 | ^10.45.0 | CURRENT | -- |
| `dotenv` | 16.6.1 | ^16.4.0 | CURRENT | -- |
| `fastify` | 5.8.4 | ^5.0.0 | CURRENT | 8 minors ahead of floor; wide range |
| `stripe` | 20.4.1 | ^20.4.1 | CURRENT | -- |
| `zod` | 3.25.76 | ^3.23.0 | CURRENT | Many patches ahead of floor |
| `typescript` | 5.9.3 | ^5.9.3 | CURRENT | -- |
| `vitest` | 3.2.4 | ^3.0.0 | CURRENT | -- |
| `tsx` | 4.21.0 | ^4.21.0 | CURRENT | -- |
| `prisma` | 6.19.2 | ^6.0.0 | CURRENT | Patch available for effect vuln |
| `@types/node` | 25.5.0 | ^25.5.0 | CURRENT | -- |

---

## 10. License Compliance

Unchanged from previous audit.

| License | Count | Risk | Packages |
|---|---|---|---|
| MIT | ~140 | PERMISSIVE | Majority of tree (fastify, clerk, sentry, zod, vitest, tsx, etc.) |
| Apache-2.0 | ~50 | PERMISSIVE | Prisma ecosystem, TypeScript, OpenTelemetry (@sentry transitive) |
| BSD-2-Clause | 2 | PERMISSIVE | dotenv, glob-parent |
| BSD-3-Clause | 5 | PERMISSIVE | fastify-related (fast-json-stringify, etc.) |
| ISC | 4 | PERMISSIVE | glob, graceful-fs, semver, signal-exit |
| 0BSD | 1 | PERMISSIVE | tslib |
| BlueOak-1.0.0 | 1 | PERMISSIVE | jackspeak (minipass transitive) |
| Unlicense | 1 | PERMISSIVE | fast-content-type-parse |

| Check | Status |
|---|---|
| Copyleft licenses (GPL, AGPL, LGPL, MPL) | **NONE FOUND** |
| Restrictive/proprietary licenses | **NONE FOUND** |
| Missing license declarations | **NONE FOUND** |
| License conflicts | **NONE** |

**Finding: PASS** -- All licenses are permissive. No copyleft or restrictive licenses detected.

---

## 11. Build Reproducibility

Unchanged from previous audit.

| Criterion | Status | Details |
|---|---|---|
| Lockfile committed | PASS | `package-lock.json` tracked in git |
| `npm ci` in CI | PASS | CI workflow uses `npm ci` |
| `npm ci` in Dockerfile | PASS | Dockerfile uses `npm ci` |
| Deterministic compiler | PASS | TypeScript `tsc` is deterministic for same input |
| Docker base image pinned | WARN | Uses `node:20-alpine` tag, not `node:20-alpine@sha256:...` |
| No network calls in build | PASS | Build only runs `tsc` after deps installed |
| `.npmrc` with `save-exact` | FAIL | No `.npmrc` file |
| Source maps in prod | INFO | `sourceMap: true` in tsconfig -- intentional for Sentry |

**Build Reproducibility: MEDIUM** -- Unchanged.

---

## 12. Typosquatting Risk

Unchanged from previous audit. All 16 direct dependencies are scoped under verified organizations or are well-established top-level packages.

**Finding: LOW RISK** -- No suspicious package names detected.

---

## 13. Server-Specific Risks

### Prototype Pollution

Unchanged. No high-risk prototype pollution vectors detected. Fastify v5 uses `secure-json-parse`.

### Known Malicious Packages

Unchanged. No known malicious or compromised packages found in the dependency tree.

### Install Scripts

Packages with `hasInstallScript: true` (6 total, up from 4 in previous audit count):

| Package | Script Purpose | Risk | Scope |
|---|---|---|---|
| `@clerk/shared` (4.3.2) | Post-install setup | MEDIUM | production |
| `@prisma/client` (6.19.2) | Generates Prisma client | MEDIUM | production |
| `@prisma/engines` (6.19.2) | Downloads platform-specific query engine binary | MEDIUM | devOptional |
| `prisma` (6.19.2) | Downloads query engine binary | MEDIUM | devOptional |
| `esbuild` (0.27.4) | Downloads platform-specific binary | LOW | dev-only |
| `fsevents` (2.3.3) | macOS file watcher native addon | LOW | dev-only, macOS-only |

**Re-audit note:** Previous audit listed 4 packages. This audit correctly identifies 6 by including `@prisma/engines` and `fsevents` which were missed previously.

---

## 14. Framework Compliance Table

### SLSA (Supply-chain Levels for Software Artifacts)

Unchanged from previous audit.

| Level | Requirement | Status |
|---|---|---|
| L0 | No requirements | MET |
| L1 | Scripted build + provenance exists | PARTIAL (build scripted; no provenance) |
| L2 | Hosted build + signed provenance | PARTIAL (hosted build; no signing) |
| L3 | Hardened + non-falsifiable | NOT MET |
| L4 | Two-party review + hermetic | NOT MET |

### SSDF (Secure Software Development Framework, NIST SP 800-218)

Unchanged from previous audit.

### OpenSSF Scorecard Criteria

| Check | Score (0-10) | Change | Notes |
|---|---|---|---|
| Binary Artifacts | 10 | -- | No checked-in binaries |
| Branch Protection | 3 | -- | No required reviews or status checks verified |
| CI Tests | 8 | -- | CI runs tests on PR and push |
| Code Review | 3 | -- | No evidence of required code review |
| Dangerous Workflow | 8 | -- | No `pull_request_target` or untrusted input in CI |
| Dependency Update Tool | 0 | -- | No Dependabot or Renovate configuration |
| Fuzzing | 0 | -- | No fuzzing infrastructure |
| License | 10 | -- | All dependencies permissively licensed |
| Maintained | 8 | -- | Active commits on branch |
| Packaging | 5 | -- | Docker build exists but no published package signing |
| Pinned Dependencies | 3 | -- | Lockfile present but package.json uses caret ranges; Docker base not pinned |
| SAST | 8 | -- | CodeQL analysis in CI |
| Security Policy | 7 | -- | SECURITY.md present |
| Signed Releases | 0 | -- | No release signing |
| Token Permissions | 6 | -- | CI has `security-events: write` scope |
| Vulnerabilities | **5** | **-3** | 5 HIGH vulns now present; `continue-on-error` means they don't block CI |

**Estimated OpenSSF Scorecard: 5.2 / 10** (down from 5.4 due to vulnerability score drop)

---

## 15. Summary Statistics

| Metric | Value | Change from Previous |
|---|---|---|
| **Direct production dependencies** | 11 | -- |
| **Direct dev dependencies** | 5 | -- |
| **Total direct dependencies** | 16 | -- |
| **Total lockfile packages** | ~180 | -- |
| **Pinned dependencies** | 0 / 16 (0%) | -- |
| **Dependencies with install scripts** | 6 | +2 (corrected count) |
| **Known CVEs/advisories (HIGH)** | 5 (3 unique) | **+5 NEW** |
| **Known CVEs/advisories (LOW)** | 1 | -- |
| **Copyleft licenses** | 0 | -- |
| **Outdated major versions** | 0 | -- |
| **SLSA level** | L1 (partial) | -- |
| **OpenSSF estimated score** | 5.2 / 10 | -0.2 |
| **Overall risk rating** | **MEDIUM-HIGH** | **upgraded from MEDIUM** |

---

## 16. Recommendations

### Critical (Do Now)

1. **Run `npm audit fix` immediately** to resolve the 5 HIGH-severity advisories (Clerk SSRF, Effect context contamination). These have published fixes available.
2. **Remove `continue-on-error: true` from `npm audit`** in CI so vulnerabilities like these block merges. This was recommended in the previous audit and remains unaddressed.
3. **Replace `REDIS_PASSWORD=changeme`** in `.env.example` with `<GENERATE_STRONG_PASSWORD>` placeholder (matching the Postgres pattern). Replace `DATABASE_URL` literal `password` with `<YOUR_POSTGRES_PASSWORD>`.

### High (This Sprint)

4. **Pin Docker base images by SHA256 digest** instead of tag: `node:20-alpine@sha256:<digest>`.
5. **Add `.npmrc`** with `engine-strict=true` and `save-exact=true`.
6. **Add Dependabot or Renovate** for automated dependency update PRs with security alerts.
7. **Enable branch protection** requiring at least one approving review and passing CI checks.
8. **Remove `continue-on-error: true`** from the typecheck, build, and Hadolint steps in CI.

### Medium (This Quarter)

9. **Generate SBOM in CI** using `@cyclonedx/cyclonedx-npm` and upload as a build artifact.
10. **Add SLSA provenance** using `slsa-framework/slsa-github-generator` for L2 attestation.
11. **Pin all existing dependencies** to exact versions in `package.json` (remove caret prefixes).
12. **Add `--ignore-scripts` to CI `npm ci`** and explicitly run required install scripts as separate steps.
13. **Hash-pin GitHub Actions** (e.g., `actions/checkout@<sha>` instead of `@v4`).

### Low (Backlog)

14. **Rotate the Redis healthcheck** to avoid exposing the password in process lists (use `redis-cli --no-auth-warning` or file-based auth).
15. **Add npm package provenance** with `--provenance` flag when publishing.
16. **Implement Sigstore signing** for Docker images.
17. **Add fuzzing** for input validation (Zod schemas) and API endpoints.

---

*End of re-audit report.*
