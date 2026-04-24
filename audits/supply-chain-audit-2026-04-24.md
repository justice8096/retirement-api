# Supply Chain Audit — retirement-api

| Field | Value |
|---|---|
| **Date** | 2026-04-24 |
| **Commit** | `4a70922` (master) |
| **Previous audit** | `supply-chain-audit-2026-04-20-post-upgrade.md` |
| **Scope** | Dependency hygiene, lockfile integrity, CI/CD pipeline security, SBOM readiness, SLSA level. |
| **Recent merges covered** | No new `dependencies` / `devDependencies` added in the recent batch (Portugal IRS brackets are data-only; YouTube scripts use built-in `node:fs` + `fetch`). |

---

## Executive Summary

Supply-chain posture is **strong** and unchanged from the 2026-04-20 re-audit. Every direct dependency uses either an exact (`stripe`) or caret-ranged pin. `package-lock.json` is present, version 3, with 378 locked entries — each carrying both `resolved` and `integrity` hashes. CI workflow (`ci.yml`) pins every GitHub Action to a full commit SHA, produces a CycloneDX SBOM on every push (90-day retention), and attaches a Sigstore-signed SLSA provenance attestation on `master`-branch pushes. Dockerfile base image is digest-pinned.

**Best-guess SLSA level: L2** (CI-produced, signed build provenance via `actions/attest-build-provenance@v2`, OIDC-trusted Sigstore signer, scripted/hosted build platform).

### Key findings

| Check | Status |
|---|---|
| `package-lock.json` present and committed | PASS |
| Lockfile version | 3 (modern) |
| All direct deps pinned/ranged (no `*`, no git+URL, no `latest`) | PASS — 14 prod + 5 dev, all semver-caret or exact |
| Dev/prod split documented | PASS — 5 items in `devDependencies` |
| SBOM generation in CI | PASS — CycloneDX via `npm sbom` step, 90-day artifact retention |
| SBOM-ready package metadata | PARTIAL — `name`, `version`, `private: true` present; **no `license` field, no `repository`, no `author`** |
| GitHub Actions pinned to full SHA | PASS — all 5 action uses are SHA-pinned |
| Dockerfile base image digest-pinned | PASS — all four `FROM node:25-alpine@sha256:bdf2cc…` |
| Secrets in CI workflow | NONE |
| Dependabot enabled | PASS — npm + github-actions + docker ecosystems, weekly cadence |
| SLSA level (best-guess) | **L2** — provenance attestation with signed in-toto statement |
| Typosquat risk | LOW — every dependency is a well-known ecosystem package on well-known scopes (`@fastify/*`, `@prisma/*`, `@clerk/*`, `@sentry/*`) |

No direct action required from this audit.

---

## Dependencies — version pinning review

Source: `package.json`.

### Production dependencies (14)

| Package | Version | Notes |
|---|---|---|
| `@clerk/fastify` | `^3.1.15` | caret — Clerk-scoped, legitimate |
| `@fastify/cookie` | `^11.0.2` | caret |
| `@fastify/cors` | `^11.2.0` | caret |
| `@fastify/helmet` | `^13.0.2` | caret |
| `@fastify/rate-limit` | `^10.0.0` | caret |
| `@fastify/swagger` | `^9.0.0` | caret |
| `@fastify/swagger-ui` | `^5.0.0` | caret |
| `@prisma/adapter-pg` | `^7.7.0` | caret — Prisma 7 driver-adapter pattern |
| `@prisma/client` | `^7.7.0` | caret |
| `@sentry/node` | `^10.49.0` | caret |
| `dotenv` | `^17.4.2` | caret |
| `fastify` | `^5.0.0` | caret |
| `ioredis` | `^5.10.1` | caret |
| `stripe` | `22.0.2` | **exact pin** — intentional (payment-processor SDK) |
| `zod` | `^4.3.6` | caret |

### Development dependencies (5)

| Package | Version | Notes |
|---|---|---|
| `@types/node` | `^25.6.0` | caret |
| `prisma` | `^7.7.0` | caret |
| `tsx` | `^4.21.0` | caret |
| `typescript` | `^6.0.3` | caret |
| `vitest` | `^4.1.5` | caret |

**Result:** no wildcards, no `git+`/`http(s):` URLs, no tag aliases. Every entry is a semver constraint. PASS.

---

## Lockfile

- **File:** `package-lock.json`
- **Committed:** yes (in VCS since initial commit)
- **Lockfile version:** 3
- **Packages indexed:** 378
- **Integrity hashes:** 378 (100% — every package has `"integrity"`)
- **Resolved URLs:** 378 (100% — every package has `"resolved"`)
- **Drift check:** cannot verify in-sync without running `npm install` — left to CI (`npm ci` fails on drift; CI workflow's `lint-and-test` job runs `npm ci` on every push/PR).

---

## CI/CD workflow review (`.github/workflows/ci.yml`)

### Jobs

1. **lint-and-test** — matrix over Node 20, 22. Runs `npm ci`, lint (optional), shared tests, API tests, typecheck, build.
2. **sbom** — generates CycloneDX SBOM via `npm sbom --sbom-format cyclonedx --sbom-type application > sbom.json`. Uploaded as `sbom-cyclonedx` artifact, 90-day retention.
3. **provenance** — runs on `master`-branch pushes only (not PRs). `id-token: write` + `attestations: write` permissions. Uses `actions/attest-build-provenance@v2.4.0` to sign `dist/**/*.js`. This is the SLSA L2 evidence producer.
4. **security-audit** — `npm audit --audit-level=high`, a custom grep for leaked secret prefixes (stripe-live, stripe-test >= 20 chars, AWS access keys, PEM private keys), a grep for dynamic-code-execution patterns, and an OWASP Top-10 checklist echo.
5. **codeql-analysis** — GitHub CodeQL `init` + `analyze` with `languages: javascript-typescript`.
6. **docker-security** — `hadolint/hadolint-action@v3.3.0` on the Dockerfile.

### Action pinning

All five external actions are pinned to a full commit SHA with the version tag in a trailing comment:

```
actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
actions/attest-build-provenance@e8998f949152b193b063cb0ec769d69d929409be # v2.4.0
github/codeql-action/init@ce64ddcb0d8d890d2df4a9d1c04ff297367dea2a # v3
github/codeql-action/analyze@ce64ddcb0d8d890d2df4a9d1c04ff297367dea2a # v3
hadolint/hadolint-action@2332a7b74a6de0dda2e2221d575162eba76ba5e5 # v3.3.0
```

PASS — immune to tag-rewriting supply-chain attacks.

### Secrets in workflow

None. No `${{ secrets.* }}` references; the runtime API keys (Clerk, Stripe, Sentry, Redis, encryption key) are injected at deploy time, not at CI time.

---

## Dockerfile review

- Base image `node:25-alpine` is **digest-pinned** on all four `FROM` stages (`@sha256:bdf2cc…`).
- Non-root runtime user (`addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 api`, `USER api`).
- Multi-stage build isolates build tooling from the runtime image.
- Healthcheck present (`wget --spider http://localhost:3000/api/health/ready`).

PASS.

---

## SBOM readiness

### Package metadata

```json
{
  "name": "retirement-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  ...
}
```

- `name`: present
- `version`: present
- `license`: **MISSING** — no top-level `license` field. Repo `LICENSE` file exists but the SBOM generator can't pick it up from package.json alone.
- `repository`: MISSING
- `author`: MISSING

**Recommendation (INFO, not a finding):** add `"license": "SEE LICENSE IN LICENSE"` (or the SPDX identifier once finalised) and a `"repository"` field so CycloneDX SBOMs have full provenance. Per user memory, main repos are ARR, so the literal field would be e.g. `"license": "UNLICENSED"` or `"license": "SEE LICENSE IN LICENSE"`.

### SBOM artifact

Generated in CI and uploaded every push. 90-day retention. This meets NIST SSDF PO.1.1 and SLSA L1 requirements for machine-readable component inventory.

---

## SLSA level assessment

Best-guess: **SLSA Build L2**.

| Requirement | Evidence |
|---|---|
| Scripted build | CI workflow `ci.yml` calls `npx tsc` in the `provenance` job |
| Build platform | GitHub-hosted runner (trusted hosted platform) |
| Provenance generated | Yes — `actions/attest-build-provenance@v2.4.0` |
| Provenance authenticated / signed | Yes — Sigstore + OIDC (GitHub id-token) |
| Provenance distributed | Yes — attached to workflow run, verifiable via `gh attestation verify` |
| Build is hermetic | PARTIAL — `npm ci` uses network but `package-lock.json` pins integrity |
| Build is reproducible | Not attested |
| Isolation (build-env hardening) | Default GitHub Actions sandboxing |

SLSA L3 would require hardened build platform + parameterless / hermetic builds, which is not a goal at this stage.

The previous audit (`slsa-l2-promotion-2026-04-20.md`) formally attested the L2 promotion. No change in this audit.

---

## Typosquat / namespace review

All 19 direct deps (14 prod + 5 dev) come from either:

- Well-known unscoped packages: `fastify`, `dotenv`, `stripe`, `zod`, `ioredis`, `prisma`, `tsx`, `typescript`, `vitest`
- Official scopes: `@fastify/*`, `@prisma/*`, `@clerk/*`, `@sentry/*`, `@types/*`

None are look-alikes of popular packages. PASS.

---

## Recommendations (all INFO, none blocking)

1. Add `license`, `repository`, `author` fields to `package.json` so the SBOM carries full provenance. (Low effort — 3 lines.)
2. Once ARR license strategy is finalised (per user memory note 2026-04-22), replace whatever placeholder ends up in `license` with the canonical SPDX string.
3. Continue receiving weekly Dependabot PRs; the grouped config (fastify / prisma / clerk / sentry) makes review tractable.

---

## Conclusion

No action required. Supply chain posture is mature for a pre-launch API of this size: locked, pinned, signed, auto-updated, and continuously scanned. The only observable gap is cosmetic SBOM metadata in `package.json`.
