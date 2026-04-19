# Supply Chain Security Audit

| Field | Value |
|---|---|
| **Date** | 2026-04-20 |
| **Commit** | 2fb9f43 |
| **Branch** | fix/audit-remediation-all (PR #11) |
| **Project** | retirement-api v0.1.0 |
| **Package Manager** | npm (lockfileVersion 3) |
| **Previous Audit** | 2026-04-19 (`audits/supply-chain-audit.md`) |
| **Supersedes** | `audits/supply-chain-audit.md` |

---

## Delta vs 2026-04-19

| Indicator | 2026-04-19 | 2026-04-20 | Change |
|---|---|---|---|
| Total open advisories | 5 (1 CRITICAL + 4 HIGH) | **0** | Cleared (resolved in `c295d2e` pre-cycle) |
| Direct-dep CVEs | 2 | **0** | Cleared |
| Exact-version pins | 0 / 19 | **1 / 19** (`stripe`) | +1 |
| SBOM published | No | **Yes** (CycloneDX, per-push artefact) | New |
| `continue-on-error` on typecheck | Yes | **No** | Hardened |
| `continue-on-error` on build | Yes | **No** | Hardened |
| `continue-on-error` on `npm audit` | Yes | **No** | Hardened |
| `npm audit` threshold | `--audit-level=critical` | `--audit-level=high` | Tightened |
| SECURITY.md populated | Stub | **Full** (disclosure contact, SLA, 6-phase IR runbook) | New |
| `docs/OPS.md` | Absent | **132 lines** (Clerk rotation, gitleaks, Redis obs.) | New |
| ADRs | 0 | **3** (`0001` stack, `0002` ACA regime, `0003` API versioning) | New |
| Docker base-image digest pin | No | Guidance comment present; digest pending Renovate | Partial |
| Renovate / Dependabot | Absent | Absent | Gap unchanged |
| SLSA level | L1 (partial) | **L1** (SBOM + hermetic `npm ci`) | Level promoted |

**Net**: All three HIGH advisories flagged on 2026-04-19 (Fastify body-schema, Clerk middleware bypass, Vite dev-only ×3) are gone. Per `git log`, fixes landed in `c295d2e` before this remediation cycle began; the 2026-04-19 audit captured them as open because it ran before the fix merge. The remainder of this cycle focused on governance: SBOM generation, CI strictness, documentation, and a first exact pin (`stripe`).

---

## Executive Summary

- **SLSA Level**: **L1** (SBOM generated & published as CI artefact; `npm ci` hermetic install; build-as-code via GitHub Actions). Path to L2 is provenance attestations.
- **Total Open Advisories**: **0**
- **Critical**: 0 · **High**: 0 · **Moderate**: 0 · **Low**: 0
- **Direct deps**: 14 runtime + 5 dev = 19 (unchanged)
- **Exact pins**: 1 / 19 (`stripe@20.4.1`) — first exact pin in project history
- **Lockfile present**: Yes (`package-lock.json`, lockfileVersion 3)
- **SBOM published**: Yes (`sbom-cyclonedx` artefact, 90-day retention)
- **Provenance attestations**: No (SLSA L2 gap)
- **Commit signing enforced**: No (branch-protection gap)
- **Renovate / Dependabot**: No (governance gap)

The security-audit CI step is now authoritative: `npm audit --audit-level=high` runs without `continue-on-error`, so any future HIGH disclosure blocks merge. The typecheck and build steps are likewise hardened — the whole lint-and-test matrix is now a true gate instead of an advisory.

---

## Dependency Inventory (Direct)

| Package | Declared | Type | Notes |
|---|---|---|---|
| @clerk/fastify | ^3.1.4 | runtime | `@clerk/shared` now ≥ 4.8.1 (A-02/19 cleared) |
| @fastify/cookie | ^10.0.0 | runtime | |
| @fastify/cors | ^10.0.0 | runtime | |
| @fastify/helmet | ^12.0.0 | runtime | |
| @fastify/rate-limit | ^10.0.0 | runtime | |
| @fastify/swagger | ^9.0.0 | runtime | |
| @fastify/swagger-ui | ^5.0.0 | runtime | |
| @prisma/client | ^6.0.0 | runtime | |
| @sentry/node | ^10.45.0 | runtime | |
| dotenv | ^16.4.0 | runtime | |
| fastify | ^5.0.0 | runtime | ≥ 5.8.5 (A-01/19 cleared) |
| ioredis | ^5.10.1 | runtime | |
| **stripe** | **20.4.1** | runtime | **Exact pin (new)** |
| zod | ^3.23.0 | runtime | |
| @types/node | ^25.5.0 | dev | |
| prisma | ^6.0.0 | dev | |
| tsx | ^4.21.0 | dev | |
| typescript | ^5.9.3 | dev | |
| vitest | ^3.0.0 | dev | Transitive Vite ≥ patched (A-03..05/19 cleared) |

---

## Advisories (`npm audit`)

`npm audit --json` returns:

```json
{
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 },
    "dependencies": { "prod": 201, "dev": 99, "optional": 52, "peer": 13, "total": 309 }
  }
}
```

No open advisories at any severity. Table intentionally empty.

| ID | Package | Severity | Status |
|---|---|---|---|
| _(none)_ | — | — | — |

---

## Dependency Pinning

| | Count |
|---|---|
| Direct deps using `^` (caret) | 18 / 19 |
| Direct deps using `~` (tilde) | 0 / 19 |
| Direct deps with exact pin | **1 / 19** (`stripe`) |

Stripe was singled out per the 2026-04-19 recommendation — the Stripe SDK occasionally ships minor-version event-shape changes and is on a webhook-critical path. Remaining 18 deps still float within caret ranges; lockfile + `npm ci` freeze transitive versions in CI/Docker, but introduction of Renovate or Dependabot remains the correct structural fix.

---

## Lockfile & Hermetic Install

- `package-lock.json` present (lockfileVersion 3).
- `npm ci` used in all three relevant CI jobs: `lint-and-test` (line 26), `sbom` (line 54), `security-audit` (line 76).
- Docker `deps` stage uses `npm ci` (Dockerfile line 11).
- No `.npmrc` changes disabling integrity; no `--force`, `--legacy-peer-deps`, or `--no-audit` observed.

**Status**: Hermetic for npm install. Sufficient for SLSA L1 isolation requirement on GitHub-hosted runners.

---

## CI/CD Posture

| Check | Status | Notes |
|---|---|---|
| `continue-on-error` on typecheck | **Removed** | Was line 39 in prior audit |
| `continue-on-error` on build | **Removed** | Was line 43 in prior audit |
| `continue-on-error` on `npm audit` | **Removed** | Was line 61 in prior audit |
| `continue-on-error` on hadolint | Present (line 140) | OK — informational lint |
| Audit threshold | `--audit-level=high` (line 79) | Was `critical` |
| Secret scanning | Present | Patterns for live/test Stripe keys, AWS access keys, PEM blocks |
| Unsafe-code lint | Present | Warns on dynamic-eval and shell-spawn patterns |
| OWASP Top-10 checklist | Present | A01–A10, with file references |
| CodeQL analysis | Present | `javascript-typescript`, `security-events: write` scoped |
| SBOM generation | **Present** (lines 43–62) | `npm sbom --sbom-format cyclonedx` → `sbom-cyclonedx` artefact, 90-day retention |

The only remaining `continue-on-error: true` in the workflow is on the hadolint step (line 140), which is acceptable for informational Dockerfile linting.

---

## SBOM (Software Bill of Materials)

**Status**: **Published** as CI artefact.

- Tool: `npm sbom --sbom-format cyclonedx --sbom-type application` (native since npm 10).
- Format: CycloneDX JSON.
- Artefact name: `sbom-cyclonedx`.
- Trigger: every push to `main` / `master` and every PR.
- Retention: 90 days.

This satisfies SLSA L1's "generated SBOM" requirement and the SSDF PS.3.1 requirement for per-release component inventories. A signed, attestation-bound SBOM (SLSA L2) remains future work.

---

## Build Reproducibility

- Multi-stage Dockerfile (deps → prisma → builder → runner); non-root `api` user with uid 1001.
- `npm ci` in deps stage guarantees deterministic `node_modules`.
- Base image: `node:20-alpine` (floating). Lines 1–6 now carry a digest-pin guidance comment pointing to `docker buildx imagetools inspect` and flagging Renovate as the intended automation. Actual digest pin is deferred to the Renovate onboarding task.
- `docker-compose.yml` present; hadolint gated in CI.

**Recommendation**: pin `node:20-alpine@sha256:<digest>` once Renovate is live so updates are automated rather than manual.

---

## Documentation & Governance Artefacts

| Artefact | Lines | Purpose |
|---|---|---|
| `SECURITY.md` | 134 | Disclosure contact, SLA tiers, 6-phase IR runbook |
| `docs/OPS.md` | 132 | Clerk key rotation, gitleaks pre-commit, Redis observability |
| `docs/adr/0001-runtime-stack.md` | — | Fastify + Prisma + Clerk runtime choice |
| `docs/adr/0002-aca-regime.md` | — | ACA cliff-default regime rationale |
| `docs/adr/0003-api-versioning-percent-encoding.md` | — | API versioning + percent-encoding policy |

These satisfy ISO 27001 A.5 (policies), NIST SP 800-218A PO.1/PO.5 (documented processes), and EU AI Act Art. 11 (technical documentation) evidentiary requirements in spirit.

---

## Code Signing & Provenance

- Commit signing: **not enforced** on branch policies (gap, carried forward from 2026-04-19).
- npm provenance: N/A — package is private, not published.
- SLSA build-provenance attestations: **absent** (blocks L2).

---

## SLSA Level Assessment

| Requirement | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Version-controlled source | ✔ | ✔ | ✔ | ✔ |
| Scripted build | ✔ | ✔ | ✔ | ✔ |
| Build-as-code (GitHub Actions) | ✔ | ✔ | ✔ | ✔ |
| SBOM generated & published | ✔ | ✔ | ✔ | ✔ |
| Hermetic install (`npm ci`) | ✔ | ✔ | ✔ | ✔ |
| Isolated build (GH-hosted runner) | ✔ | ✔ | ✔ | ✔ |
| Authenticated provenance | ✘ | ✘ | ✘ | ✘ |
| Service-generated provenance | ✘ | ✘ | ✘ | ✘ |
| Parameterless | ✘ | ✘ | ✘ | ✘ |
| Fully hermetic build | partial | ✘ | ✘ | ✘ |

**Current Level**: **L1** (promoted from L1-partial).

**Path to L2**: adopt `slsa-framework/slsa-github-generator` to emit in-toto provenance attestations alongside the Docker image and the SBOM artefact.

---

## Risk Matrix

| Risk | Likelihood | Impact | Score | Mitigation |
|---|---|---|---|---|
| Unpinned direct-dep float | Medium | Low | Low | Lockfile + `npm ci`; add Renovate for deliberate PRs |
| Unsigned Docker base image | Low | Medium | Low-Med | Pin `node:20-alpine@sha256:<digest>` via Renovate |
| No build provenance | High | Low | Low | SLSA L2 migration |
| No commit signing | Medium | Low | Low | Require signed commits on `main` |
| Undisclosed future HIGH CVE | Medium | Medium | Medium | CI now blocks at `--audit-level=high`; Renovate would surface patch PRs within SLA |
| SBOM not signed / attested | Medium | Low | Low | Sign with Sigstore / cosign once L2 in place |

---

## Framework Compliance

### SLSA v1.0
| Track | Level | Evidence |
|---|---|---|
| Build | **L1** | SBOM artefact, hermetic `npm ci`, build-as-code |
| Source | L1 | GitHub-native branch history; signing not enforced |
| Dependencies | L1 | Lockfile + CycloneDX SBOM |

### NIST SP 800-218A (SSDF)
| Practice | Status | Evidence |
|---|---|---|
| PO.1 (documented SDLC) | ✔ | `SECURITY.md`, `docs/OPS.md`, ADRs |
| PO.3 (secure build) | ✔ | Hermetic CI, hadolint, CodeQL |
| PS.1 (protect source) | Partial | Branch protections; commit signing not enforced |
| PS.3 (archive + SBOM) | ✔ | CycloneDX SBOM artefact per push |
| PW.4 (reuse secure components) | ✔ | `npm audit --audit-level=high` gating |
| RV.1 (vuln identification) | ✔ | `npm audit` + CodeQL in CI |
| RV.2 (vuln remediation) | Partial | No Renovate/Dependabot; manual cadence only |

### EU AI Act
| Article | Status | Notes |
|---|---|---|
| Art. 11 (technical documentation) | Partial→✔ | ADRs + `SECURITY.md` + `docs/OPS.md` established |
| Art. 15 (accuracy, robustness, cybersecurity) | Partial | CI gating + OWASP checklist; formal threat model outstanding |
| Art. 25 (supply-chain risk mgmt) | Partial | SBOM + audit gating in place; no vendor attestations yet |

### ISO 27001:2022 Annex A
| Control | Status | Evidence |
|---|---|---|
| A.5 (policies) | ✔ | `SECURITY.md`, ADRs |
| A.8.8 (technical vulnerability mgmt) | ✔ | `npm audit` gate + CodeQL + 90-day SBOM retention |
| A.8.28 (secure coding) | ✔ | OWASP checklist, sanitize middleware, Prisma parameterization |
| A.8.30 (outsourced development) | Partial | No third-party SBOM attestation review process |
| A.15 (supplier relationships) | Partial | No formal supplier review register |

---

## Remaining Gaps (Priority-Ordered)

1. **Adopt Renovate or Dependabot** — the single largest remaining governance gap. Would automate the other 18 direct-dep pins, base-image digest pinning, and weekly CVE-surface PRs within SLA.
2. **SLSA L2 provenance** — adopt `slsa-framework/slsa-github-generator`; emit in-toto attestations for both the Docker image and the CycloneDX SBOM.
3. **Commit signing** — require Sigstore / GPG signed commits on `main` via branch protection.
4. **Pin remaining direct deps** — extend the `stripe` pattern to at least `@clerk/fastify`, `fastify`, `@prisma/client`, and `@sentry/node` (blast-radius-weighted choices).
5. **Threat model document** — formal STRIDE / LINDDUN pass to close EU AI Act Art. 15 and ISO A.8.25 gaps.
6. **Vendor attestation register** — lightweight table in `docs/OPS.md` of third-party components and their own security postures (Clerk, Stripe, Sentry, Upstash).

---

## Verification Commands (reproducibility)

The following checks were run at commit `2fb9f43` on branch `fix/audit-remediation-all`:

- `npm audit --json | head -60` → `vulnerabilities: {}`, all severity counts 0.
- `grep -n 'stripe' package.json` → line 42: `"stripe": "20.4.1"` (exact pin, no caret).
- `grep -n 'continue-on-error' .github/workflows/ci.yml` → single hit on line 140 (hadolint).
- `grep -n 'npm sbom' .github/workflows/ci.yml` → line 56 (CycloneDX generation step).
- `ls docs/adr/` → `0001-runtime-stack.md`, `0002-aca-regime.md`, `0003-api-versioning-percent-encoding.md`.

All five checks passed.
