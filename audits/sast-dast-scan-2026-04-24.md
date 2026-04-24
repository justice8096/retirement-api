# SAST Scan Report — retirement-api

| Field | Value |
|---|---|
| **Date** | 2026-04-24 |
| **Commit** | `4a70922` (master) |
| **Scanner** | Manual static analysis (ripgrep + file review) |
| **Target** | retirement-api (Fastify 5 + Prisma 7 + TypeScript ESM) |
| **Previous scan** | `sast-dast-scan-2026-04-20.md` — baseline for delta |
| **Recent merges covered** | Portugal IRS brackets (data only), YouTube channel curation scripts (`scripts/curate-youtube-via-api.mjs`, `scripts/curate-youtube-fallback-queries.mjs`, `scripts/apply-youtube-auto.mjs`, `scripts/apply-youtube-curation.mjs`), crime/safety citations (`scripts/add-crime-sources-to-cons.mjs`). No new package.json deps. |

---

## Executive Summary

Scope was the recent-merge delta since the 2026-04-20 audit plus a regression check on the core server. Four new one-off scripts were introduced in `scripts/`. None are wired into the server runtime — they are developer CLIs that run offline against `data/locations/*.json`. All direct file writes are scoped under `data/locations/` and either take location ids from `readdirSync(DATA_DIR)` (trusted local filesystem) or from `process.argv` (operator input).

**Counts:** 0 CRITICAL / 0 HIGH / 0 MEDIUM / 3 LOW / 2 INFO.

Overall posture: **PASS (no regressions, no new high-severity findings)**. The LOW items are defence-in-depth hardening suggestions on developer-only scripts, not exploitable in the deployed API surface.

### Severity counts (open findings, this audit)

| Severity | Count | Delta vs 2026-04-20 |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 0 | 0 |
| MEDIUM | 0 | 0 |
| LOW | 3 | +3 (new-script hygiene items) |
| INFO | 2 | 0 (unchanged from prior audit) |

---

## CRITICAL

*No CRITICAL findings.*

## HIGH

*No HIGH findings.*

## MEDIUM

*No MEDIUM findings.*

## LOW

### L-2026-04-24-01 — `apply-youtube-curation.mjs` writes to path built from unchecked argv
- **CWE:** [CWE-22 Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- **File:** `scripts/apply-youtube-curation.mjs:15-34`
- **Snippet:**
  ```js
  const [, , locId, channelName, channelRef, ...descParts] = process.argv;
  const filePath = join('data/locations', locId, 'local-info.json');
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  ...
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  ```
- **Risk:** Developer script. If `locId` contains `..` segments, `path.join` will resolve outside the intended directory. Not exposed to user input — operator-run only — but defence-in-depth says validate. Same pattern in `apply-youtube-auto.mjs:89`.
- **Fix:** Add `if (!/^[a-z0-9-]+$/.test(locId)) { console.error('Invalid locId'); process.exit(1); }` before the `join()` call. Mirrors the `safeIdSchema` pattern used in `src/routes/locations.ts:103`.

### L-2026-04-24-02 — YouTube API-key query string logged to error output on non-OK responses
- **CWE:** [CWE-532 Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- **File:** `scripts/curate-youtube-via-api.mjs:48-51` and `scripts/curate-youtube-via-api.mjs:64-67`
- **Snippet:**
  ```js
  const res = await fetch(`${SEARCH_URL}?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`search.list ${res.status}: ${body.slice(0, 200)}`);
  }
  ```
- **Risk:** `params` contains `key=<YOUTUBE_API_KEY>`. If the Google API ever echoes the request URL in its error body (it sometimes does for 400-class errors), the key would land in stderr and potentially CI logs. The fallback script (`curate-youtube-fallback-queries.mjs:56-68`) already does the right thing — parses `body.error.errors[0].reason` and drops the raw body.
- **Fix:** Mirror the fallback script's `throwApiError` helper: parse JSON, extract `.error.errors[0].reason`, never include raw body in the thrown message.

### L-2026-04-24-03 — `add-crime-sources-to-cons.mjs` swallows fetch errors without cap on concurrent retries
- **CWE:** [CWE-754 Improper Check for Unusual or Exceptional Conditions](https://cwe.mitre.org/data/definitions/754.html)
- **File:** `scripts/add-crime-sources-to-cons.mjs:63-70`
- **Snippet:**
  ```js
  async function probeUrlHead(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
      return res.ok;
    } catch {
      return false;
    }
  }
  ```
- **Risk:** Developer script only. A DNS failure or network outage will silently return `false` for every probe, causing the script to skip Wikipedia sources across all locations without surfacing the outage. Re-running doesn't distinguish "URL doesn't exist" from "network down".
- **Fix:** Log `err.message` on catch so the run summary can count network failures separately from 404s. Optional: abort the run if >50% of probes error out with `ECONNRESET`/`ENOTFOUND`.

## INFO

### I-2026-04-24-01 — Health endpoint returns 503 when `ENCRYPTION_MASTER_KEY` missing (positive control)
- **File:** `src/middleware/encryption.ts:37-42`, `src/routes/health.ts`
- **Note:** Carried over from I-NEW-02 (2026-04-19). Production refuses to boot without the key (`throw` at `encryption.ts:40`); non-prod warns via `warnOnce()`. Verified still in place. Intentional positive control — no action.

### I-2026-04-24-02 — Swagger UI served at `/api/docs` in all environments
- **File:** `src/lib/swagger.ts`
- **Note:** Carried over from I-NEW-03 (2026-04-20). Swagger UI is registered regardless of `NODE_ENV`. Schema disclosure is intentional (open API) but worth re-evaluating once the product is revenue-bearing. No action for this audit.

---

## Scanned Patterns (Negative Results)

The following scans returned **no matches**, confirming no regressions:

| Pattern | Scope | Result |
|---|---|---|
| Dynamic code execution (runtime evaluation APIs, subprocess spawning) | `src/` | None |
| Unsafe Prisma raw-query builders (`Unsafe` suffix variants) | whole repo | None (all raw queries use tagged-template `$queryRaw\`SELECT 1\``) |
| Weak crypto hashes (MD5 / SHA-1) used for security | `src/` | None |
| Live Stripe / Clerk / AWS key prefixes | whole repo | None (only test stubs `whsec_test_fake`, `whsec_fake` in `__tests__`; real key rotated 2026-04-20) |
| `new RegExp(` built from user input | `src/` | None |
| `path.join` / `readFileSync` with `req.*` / `request.*` input | `src/` | None |
| `fetch()` with user-controlled URL | `src/` | Only one: `src/middleware/auth.ts:28` — Clerk user lookup with `${clerkUserId}` which is validated via Clerk JWT auth before reaching this line. Safe. |
| TLS-verification disabling (`rejectUnauthorized: false` / env opt-out) | whole repo | None |
| CORS `origin: '*'` with `credentials: true` | `src/server.ts:59-62` | Explicitly guarded: wildcard is stripped with a warning before registration. Safe. |
| Cookie `httpOnly: false` / `secure: false` / `sameSite: 'None'` without secure | `src/` | None (no custom cookies set; only `@fastify/cookie` registration) |

---

## Verification Commands

```text
$ git -C D:/retirement-api log --oneline -1
4a70922 feat(local-info): fallback YouTube queries + relevance audit (#66)

$ ripgrep 'Unsafe\b' src/ prisma/        # raw-query escape-hatch scan
(no matches)

$ ripgrep 'createHash.{1,5}(md5|sha1)' src/     # weak-hash scan
(no matches)

$ ripgrep 'rejectUnauthorized|NODE_TLS_REJECT' src/
(no matches)
```

---

## Conclusion

Four new developer scripts introduced in the recent batch. No server-facing code changes that affect security posture. Three new LOW defence-in-depth items filed against script hygiene (path-traversal hardening, error-log redaction, error-handling observability). No MEDIUM or above findings. No regressions on the 2026-04-20 closed list.
