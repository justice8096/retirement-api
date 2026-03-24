---
name: Dependency Audit
description: >-
  This skill should be used when the user asks to "audit dependencies",
  "check for vulnerabilities", "npm audit", "update packages", "find outdated
  packages", "check deprecated dependencies", "dependency review", "security
  vulnerabilities in packages", "unused dependencies", or mentions upgrading
  or auditing npm packages across the monorepo.
version: 1.0.0
---

# Dependency Audit

Audit npm dependencies across all 4 workspace packages for vulnerabilities, deprecations, outdated versions, and unused packages.

## When to Use

- Periodic security maintenance (monthly recommended)
- Before production deployment
- After Dependabot/Renovate alerts
- When adding new dependencies
- During security review

## Audit Steps

### 1. Vulnerability Scan

```bash
cd d:/commercialRetirementProject
npm audit --json
npm audit --audit-level=high
```

For each vulnerability:
- Severity (critical/high/medium/low)
- Affected package and version
- Fix available? (`npm audit fix` or manual update)
- Is it a direct or transitive dependency?

### 2. Outdated Packages

```bash
npm outdated --json
```

Priority updates:
- **Security-critical**: Fastify, Prisma, Vite (web-facing)
- **Major versions behind**: check changelogs for breaking changes
- **Deprecated packages**: replace with maintained alternatives

### 3. Unused Dependencies

Check each package.json against actual imports:

```
packages/shared/package.json    — Should have zero runtime dependencies
packages/api/package.json       — Fastify, Prisma, Zod, dotenv, etc.
packages/dashboard/package.json — React, Vite, Chart.js, Zustand, etc.
packages/tools/package.json     — CLI-specific dependencies
```

For each dependency, search for import/require statements. Flag any that are listed in package.json but never imported.

### 4. License Check

Verify all dependencies use permissive licenses (MIT, Apache-2.0, BSD, ISC). Flag:
- GPL or AGPL (copyleft, may require source disclosure)
- Unlicensed packages
- Custom/proprietary licenses

### 5. Supply Chain Risk

Flag packages with:
- Very low download counts (< 100/week)
- Single maintainer with no organization
- No recent commits (> 2 years stale)
- Known typosquat targets

## Report Format

```
## CRITICAL VULNERABILITIES
- [CVE-XXXX] package@version — Description. Fix: upgrade to version X.Y.Z

## HIGH VULNERABILITIES
- ...

## OUTDATED (major version behind)
- fastify: 4.x.x → 5.x.x (breaking changes: ...)

## UNUSED DEPENDENCIES
- packages/api: `somepackage` listed but never imported

## LICENSE CONCERNS
- packages/dashboard: `chart-lib` uses AGPL-3.0

## SUMMARY
- Total dependencies: XX
- Vulnerabilities: X critical, X high, X medium
- Outdated: X packages
- Unused: X packages
```

## Key Files

- `package.json` (root) — Workspace config
- `packages/*/package.json` — Per-package dependencies
- `package-lock.json` — Locked versions
