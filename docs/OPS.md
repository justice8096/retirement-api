# Operations Runbook

Short, idempotent procedures for deploy-adjacent tasks. Pairs with `SECURITY.md`
(incident response) and `docs/METHODOLOGY.md` (data provenance).

---

## 1. Rotating the Clerk test keys (SAST C-01)

The `.env` file on the developer machine stores a live `sk_test_…` Clerk key
which is intentionally outside git. Rotate it whenever:
- A workstation is lost or compromised.
- A new contributor's access is revoked.
- Any CI or log service may have captured the key.

### Procedure
1. Go to the [Clerk dashboard](https://dashboard.clerk.com) → **API Keys**.
2. Click **Create secret key**. Copy the new `sk_test_…` value.
3. Update the local `.env`: `CLERK_SECRET_KEY=sk_test_<new>` and
   `CLERK_PUBLISHABLE_KEY=pk_test_<new>` if both rolled.
4. Restart the API: `npm run dev`. Verify `/api/health/ready` → 200 and
   an authenticated request succeeds.
5. **Revoke the old key** in the Clerk dashboard.
6. Note the rotation in `CHANGELOG.md` under a `### Security` subsection.

### Production keys
Production `sk_live_…` keys must live in a secrets manager (Doppler,
1Password, Windows Credential Manager, or the host's KMS) and must not touch
developer machines. Follow the same rotation steps but bump the
secrets-manager entry rather than a local file.

---

## 2. Pre-commit secret scanning (gitleaks)

Install [gitleaks](https://github.com/gitleaks/gitleaks) locally so an
accidental `git add .env` is blocked before it reaches the remote.

### Install
- macOS: `brew install gitleaks`
- Windows: `scoop install gitleaks` or use a release binary.
- Linux: `go install github.com/gitleaks/gitleaks/v8@latest` or a release tarball.

### Configure
Add `.gitleaks.toml` at the repo root:
```toml
title = "retirement-api secret scan"

[[rules]]
id = "clerk-secret"
description = "Clerk secret key"
regex = '''sk_(test|live)_[A-Za-z0-9]{24,}'''
tags = ["secret", "clerk"]

[[rules]]
id = "stripe-secret"
description = "Stripe secret or webhook key"
regex = '''(sk|whsec)_(test|live)_[A-Za-z0-9]{24,}'''
tags = ["secret", "stripe"]

[[rules]]
id = "encryption-master-key"
description = "64-char hex encryption key"
regex = '''[a-f0-9]{64}'''
tags = ["secret", "crypto"]
```

### Pre-commit hook
Install [pre-commit](https://pre-commit.com) and add `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```
Then run `pre-commit install`. Every `git commit` now scans the staged diff.

---

## 3. Redis error-rate observability (SAST I-NEW-01)

The rate-limit middleware falls back to in-memory when Redis is unhealthy.
Silent fallback causes per-replica drift. The metric below alerts on that.

### Instrument
Add a counter in `src/middleware/rate-limit.ts` when the Redis connection
errors:
```ts
import { metrics } from '@opentelemetry/api';
const meter = metrics.getMeter('retirement-api');
const redisErrors = meter.createCounter('rate_limit_redis_errors_total');
redis.on('error', () => redisErrors.add(1));
```
(If OTEL isn't wired yet, substitute `app.log.warn({ event: 'rate_limit_redis_error' })`
so the log aggregator can roll it up.)

### Alert
Trigger on `rate_limit_redis_errors_total > 5 / 5min per replica`.
- Severity: warning — in-memory fallback preserves correctness at the
  cost of per-replica drift.
- Runbook: check Redis health (`redis-cli PING`), confirm network path,
  re-issue the Redis password from the secrets manager if rotated.

### Dashboard
Expose the counter alongside `rate_limit_hits_total` and
`rate_limit_rejects_total` so the operator can see whether fallback
correlates with user impact.

---

## 4. Running CI locally before pushing

```bash
npm ci
npm run lint --if-present
npm run typecheck
npm test
npm run test:shared
npm audit --audit-level=high
```

If any step fails, fix locally — CI no longer runs `continue-on-error: true`
on typecheck / build / audit steps, so a red check will block the PR.

---

## 5. SBOM

CI publishes `sbom-cyclonedx` as an artefact on every push. Download from the
Actions tab → workflow run → Artifacts. Format is CycloneDX JSON; feed into
Dependency-Track, OWASP DC, or Snyk for longitudinal analysis.
