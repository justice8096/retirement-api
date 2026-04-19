# Supply Chain Security Audit

| Field | Value |
|---|---|
| **Date** | 2026-04-19 |
| **Commit** | 80e2e91 |
| **Branch** | cleanup/seed-data-integrity-path |
| **Project** | retirement-api v0.1.0 |
| **Package Manager** | npm (lockfileVersion 3) |
| **Previous Audit** | 2026-04-16 |

---

## Executive Summary

- **SLSA Level**: L1 (partial L2) — same as 2026-04-16
- **Total Open Advisories**: 3 root packages, 5 advisory entries (via transitive)
- **Critical**: 1 (`@clerk/shared` route-protection bypass)
- **High**: 4 (1× Fastify body-schema, 3× Vite dev-only)
- **Moderate**: 0
- **Low**: 0
- **Deps Pinned (exact version)**: 0 / 19 direct (unchanged; all use `^` ranges)
- **Lockfile Present**: Yes (`package-lock.json`)
- **SBOM Published**: No
- **Provenance Attestations**: No

Two new ecosystem advisories have been disclosed since 2026-04-16 that affect this project's direct dependencies:

1. `GHSA-247c-9743-5963` — Fastify body-schema validation bypass
2. `GHSA-vqx2-fgx2-5wq9` — Clerk middleware route protection bypass

Both have upstream patches available; `npm audit fix` will resolve them.

---

## Dependency Inventory (Direct)

| Package | Declared | Type | Notes |
|---|---|---|---|
| @clerk/fastify | ^3.1.4 | runtime | Pulls `@clerk/shared` (vulnerable sub-range) |
| @fastify/cookie | ^10.0.0 | runtime | |
| @fastify/cors | ^10.0.0 | runtime | |
| @fastify/helmet | ^12.0.0 | runtime | |
| @fastify/rate-limit | ^10.0.0 | runtime | |
| @fastify/swagger | ^9.0.0 | runtime | New since 2026-04-16 |
| @fastify/swagger-ui | ^5.0.0 | runtime | New since 2026-04-16 |
| @prisma/client | ^6.0.0 | runtime | |
| @sentry/node | ^10.45.0 | runtime | |
| dotenv | ^16.4.0 | runtime | |
| fastify | ^5.0.0 | runtime | **Vulnerable version resolved (GHSA-247c-9743-5963)** |
| ioredis | ^5.10.1 | runtime | |
| stripe | ^20.4.1 | runtime | |
| zod | ^3.23.0 | runtime | |
| @types/node | ^25.5.0 | dev | |
| prisma | ^6.0.0 | dev | |
| tsx | ^4.21.0 | dev | |
| typescript | ^5.9.3 | dev | |
| vitest | ^3.0.0 | dev | **Pulls vulnerable Vite transitively** |

Direct dependency count: **14 runtime + 5 dev = 19** (up from 16 at 2026-04-16; added: `@fastify/swagger`, `@fastify/swagger-ui`, explicit `ioredis`).

---

## Advisories (`npm audit`)

### A-01 — Fastify Body Schema Validation Bypass (HIGH)

| Field | Value |
|---|---|
| CVE/GHSA | GHSA-247c-9743-5963 |
| Severity | HIGH (CVSS 7.5) |
| CWE | CWE-1287 |
| Package | fastify |
| Vulnerable Range | `>=5.3.2 <=5.8.4` |
| Fix Available | Yes (`npm audit fix`) |
| Introduced | Direct dependency |

**Description**: A leading-space `Content-Type` header can cause the body schema to be skipped, letting malformed JSON reach handlers and bypass content-type-keyed parsers.

**Impact on this project**: Every route uses Zod `safeParse` as a secondary validation layer, which limits downstream damage. Still, the skipped parse means content-type enforcement can be lost.

**Action**: Upgrade Fastify to `>=5.8.5` via `npm audit fix`.

---

### A-02 — Clerk SDK Middleware Route Protection Bypass (CRITICAL)

| Field | Value |
|---|---|
| CVE/GHSA | GHSA-vqx2-fgx2-5wq9 |
| Severity | CRITICAL (CVSS 9.1) |
| CWE | CWE-436, CWE-863 |
| Package | @clerk/shared |
| Vulnerable Range | `>=4.0.0 <4.8.1` |
| Fix Available | Yes |
| Introduced | Transitive via `@clerk/fastify` |

**Description**: Crafted request headers or paths allow a user to bypass Clerk middleware route protection and reach routes intended to require authentication.

**Impact on this project**: The API does not rely solely on Clerk middleware for enforcement — each protected route uses an explicit `requireAuth` preHandler that calls `getAuth(request)` and returns 401 if `userId` is missing. Defense in depth is present. Still, `clerkPlugin` is globally loaded, so the vulnerable code path is reachable in principle.

**Action**: Upgrade `@clerk/shared` to ≥ 4.8.1 via `npm audit fix`.

---

### A-03 through A-05 — Vite Dev-Only Advisories (HIGH, dev-only)

| Field | Value |
|---|---|
| GHSAs | GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583 |
| Severity | HIGH / moderate |
| CWE | CWE-22, CWE-200, CWE-180, CWE-284 |
| Package | vite (transitive via vitest) |
| Vulnerable Range | `>=7.0.0 <=7.3.1` |
| Fix Available | Yes |

**Description**: Path traversal in optimized deps `.map` handling; `server.fs.deny` bypassed by query strings; arbitrary file read via dev-server WebSocket.

**Impact on this project**: Dev-only. `vite` is a transitive dependency of `vitest` (the test runner). No dev server is exposed publicly in production. If a developer runs vitest UI on a machine on an untrusted local network, file reads are possible.

**Action**: `npm audit fix` will pull a patched Vite via vitest's latest minor.

---

## Dependency Pinning

| | Count |
|---|---|
| Direct deps using `^` (caret) | 19/19 |
| Direct deps using `~` (tilde) | 0/19 |
| Direct deps with exact pin | 0/19 |

**Status**: **UNCHANGED** since 2026-04-16 — zero exact pins. Lockfile freezes transitive versions, but `npm install` (without `npm ci`) in an ungated environment would float within caret ranges.

**Recommendation**:
1. Ensure all CI/CD and deploy paths use `npm ci` (already configured in `.github/workflows/ci.yml`).
2. Add a `renovate.json` or Dependabot configuration to batch updates with explicit PRs.
3. Pin the Stripe SDK exactly (`stripe: "20.4.1"`) — Stripe SDK minor updates occasionally change event shapes.

---

## Lockfile Integrity

- `package-lock.json` present, version 3.
- `npm ci` used in CI (`.github/workflows/ci.yml` lines 26 and 57).
- No `.npmrc` modifications that disable integrity checks.
- No `--legacy-peer-deps`, `--force`, or `--no-audit` flags observed.

**Status**: **GOOD** — unchanged from 2026-04-16.

---

## CI/CD Secret Handling

Reviewing `.github/workflows/ci.yml`:

| Check | Status | Notes |
|---|---|---|
| Secret scanning in CI | YES | Custom grep pattern for `sk_live_`, `whsec_live_`, `sk_test_*` (20+ char), `AKIA*`, PEM keys |
| `GITHUB_TOKEN` scope | implicit `read-all` default | `security-events: write` on CodeQL job only |
| Secrets referenced in workflow | None inline | Good |
| `continue-on-error` on audit | YES (line 61) | **Risk**: severity findings no longer break CI |
| `continue-on-error` on typecheck | YES (line 39) | minor — should be strict |
| `continue-on-error` on build | YES (line 43) | **Risk**: broken builds pass CI |
| `continue-on-error` on hadolint | YES (line 122) | OK for informational lint |

**Issues (unchanged since 2026-04-16)**:

1. `npm audit --audit-level=critical` with `continue-on-error: true` (line 60-61) — the current HIGH + CRITICAL advisories would not block CI. **Recommendation**: drop `continue-on-error` on the security-audit job, or set `--audit-level=high` and gate on exit code.
2. TypeScript typecheck and build both allow failure — undermines the whole compliance pipeline.

---

## SBOM (Software Bill of Materials)

**Status**: **MISSING** (unchanged).

No CycloneDX or SPDX SBOM generated. No `@cyclonedx/cyclonedx-npm` or `syft` in devDependencies.

**Recommendation**:
```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json --output-format json
```
Run as part of release workflow. Store as a release artifact.

---

## Build Reproducibility

- `Dockerfile` present (multi-stage build).
- `docker-compose.yml` present for local orchestration.
- `npm ci` in the Docker build stage guarantees deterministic `node_modules`.
- Base image floating at minor version (`node:22-alpine`) — should pin to sha256 digest.
- No `apt-get install` without version pinning observed (hadolint runs in CI).

**Recommendation**: Pin base image by digest in Dockerfile:
```dockerfile
FROM node:22-alpine@sha256:<digest>
```

---

## Code Signing & Provenance

- Commit signing not enforced on branch policies.
- No npm provenance attestations (package is private, not published to npm).
- No SLSA L3 build provenance artifacts.

---

## SLSA Level Assessment

| Requirement | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Version-controlled source | ✔ | ✔ | ✔ | ✔ |
| Generated build process | ✔ | ✔ | ✔ | ✔ |
| Build-as-code | ✔ (GitHub Actions) | ✔ | ✔ | ✔ |
| Authenticated provenance | partial | ✘ | ✘ | ✘ |
| Service-generated provenance | ✘ | ✘ | ✘ | ✘ |
| Isolated build | ✔ (GitHub-hosted) | ✔ | ✔ | ✘ |
| Parameterless | ✘ | ✘ | ✘ | ✘ |
| Hermetic | ✘ | ✘ | ✘ | ✘ |

**Current Level**: **L1** (with some L2 characteristics).

**Path to L2**: Enable artifact provenance by adopting the SLSA GitHub Actions reusable workflow (`slsa-framework/slsa-github-generator`). Publish provenance attestations alongside Docker image tags.

---

## Risk Matrix

| Risk | Likelihood | Impact | Score | Mitigation |
|---|---|---|---|---|
| Clerk bypass (A-02) exploit in prod | Low | High | **Medium** | Patch via `npm audit fix` immediately |
| Fastify body-schema bypass (A-01) | Low | Medium | Low-Medium | Zod parses every route; still patch |
| Redis default password (`.env.example`) | Medium | Medium | Medium | Replace with placeholder |
| Dev bypass in wrong env | Low | High | Medium | Add `DEV_AUTH_BYPASS=1` secondary guard |
| Float within caret ranges | Medium | Low | Low | Lockfile + `npm ci` cover it |
| Missing SBOM | High | Low | Low | Add CycloneDX in release workflow |
| No build provenance | High | Low | Low | SLSA L2 migration |

---

## Framework Compliance Matrix

| Framework | Compliant | Partial | Gaps |
|---|---|---|---|
| NIST SP 800-218A (SSDF) | | ✔ | No SBOM, no formal provenance, unsigned commits |
| NIST SP 800-53 SI-7 (Software Integrity) | | ✔ | Lockfile yes, commit signing no |
| SLSA v1.0 | L1 | partial L2 | No provenance, not hermetic |
| OWASP SCS (Software Component Security) | | ✔ | `npm audit` in CI but `continue-on-error` masks it |
| EU AI Act Art. 25 (supply chain risk mgmt) | | ✔ | No risk register, no vendor attestations |
| ISO 27001 A.15 (Supplier relationships) | | ✔ | No formal supplier review |
| SOC 2 CC9.1 (Change Management) | ✔ | | GitHub Actions + PR reviews present |

---

## Delta vs 2026-04-16

| | 2026-04-16 | 2026-04-19 |
|---|---|---|
| Direct dep count | 16 | 19 |
| Open advisories (high+) | 5 (Clerk SSRF, Effect, others) | 5 (Fastify, Clerk new, Vite ×3) |
| Critical advisories | 0 | 1 |
| SLSA level | L1 (partial) | L1 (partial) — no change |
| Lockfile present | ✔ | ✔ |
| SBOM | ✘ | ✘ |
| Provenance | ✘ | ✘ |
| CI `continue-on-error` on audit | ✔ (still there) | ✔ (still there) |

**Net change**: Prior audit's `@clerk/shared` SSRF (GHSA-gjxx-92w9-8v8f) and Effect advisory (GHSA-38f7-945m-qr2g) are resolved (no longer in current audit output) — presumably fixed during the early-April master merges. The new Fastify + new Clerk advisories are fresh disclosures, not regressions.

---

## Recommendations (Priority-Ordered)

1. **Run `npm audit fix`** immediately — closes A-01, A-02, A-03/A-04/A-05. No breaking changes expected (all patch-level).
2. **Drop `continue-on-error: true`** from the `npm audit` step in `.github/workflows/ci.yml`. Use `--audit-level=high`.
3. **Generate SBOM in CI**: add `npx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json` to the `docker-security` job.
4. **Pin Docker base image by digest** in `Dockerfile`.
5. **Add Dependabot/Renovate** config for controlled weekly dependency-update PRs.
6. **Adopt SLSA provenance** via `slsa-framework/slsa-github-generator` when moving to signed releases.
7. **Require commit signing** on `main` via branch protection.
