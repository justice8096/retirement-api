# SLSA L1 → L2 Promotion — retirement-api

| Field | Value |
|---|---|
| **Date** | 2026-04-20 |
| **Branch** | master |
| **Supersedes** | `supply-chain-audit-2026-04-20-post-upgrade.md` SLSA target row |

## What changed — two adjacent hardening actions

### 1. Build-provenance attestation

New `provenance` job in `.github/workflows/ci.yml`, gated to
`master`-branch pushes. The job:

1. Compiles the TypeScript server output (`npx tsc`).
2. Calls `actions/attest-build-provenance@v2.4.0` to produce an in-toto
   statement signed via Sigstore + GitHub OIDC, covering every
   `dist/**/*.js` output.
3. The signed attestation is stored in GitHub's public attestation
   store and becomes queryable per artefact digest:
   ```
   gh attestation verify dist/server.js \
     --repo justice8096/retirement-api
   ```

**Permissions** (provenance job only):
- `id-token: write` — Sigstore OIDC signing
- `attestations: write` — GitHub attestation store

Pull-request runs **do not** get these permissions (gate: `if:
github.event_name == 'push' && github.ref == 'refs/heads/master'`),
blocking fork-PR token exfiltration.

### 2. Docker base-image digest pin

`Dockerfile` `FROM node:25-alpine` (tag-only, mutable) is replaced
with `FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4`
(immutable). Dependabot's `docker` ecosystem monitor will open a PR
when a new digest ships for the same tag.

To refresh manually:
```
docker buildx imagetools inspect node:25-alpine --format '{{json .Manifest.Digest}}'
```

## SLSA L2 requirements satisfied

| Requirement | Evidence |
|---|---|
| Build-service generated provenance | `actions/attest-build-provenance` via Sigstore + GitHub OIDC |
| Source is version-controlled | GitHub — L1 |
| Build-as-code | `.github/workflows/ci.yml` — L1 |
| Hosted build platform | GitHub-hosted `ubuntu-latest` runner |
| Signed, authenticated provenance | Sigstore cert chain verifiable via `gh attestation verify` |
| Deterministic base image | Dockerfile digest-pinned |
| Retention of provenance | GitHub attestation store (no expiry on public repos) |

## SLSA L3 path (future)

L3 requires:
- Hardened, hermetic build platform (GitHub hosted runners don't
  formally meet this; SLSA-conformant `slsa-github-generator` reusable
  workflows do)
- Deploy-time verification — deploy pipeline must call
  `gh attestation verify` before publishing the artefact

Not pursuing L3 this cycle; deferred behind the CD pipeline rollout.

## Open governance gaps (unchanged from post-upgrade audit)

- Commit signing not enforced via branch protection (separate concern
  from SLSA L2; tracked for next GitHub-setup review)
