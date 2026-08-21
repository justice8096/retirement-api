# A1 — `retirement.db` and static-mirror consumer audit

Date: 2026-08-21. Scope: the 7 repos under `D:\retirement\` named in the plan
(`retirement-api`, `retirement-dashboard`, `retirement-dashboard-angular`,
`retirement-mcp`, `retirement-monitor`, `commercialRetirementProject`,
`retirementProject`), plus the n8n instance on rogue. `.claude` memory/session
directories are excluded as instructed. All file:line citations were read
directly, not inferred from filename.

## Step 1 — `retirement\.db` sweep (all 7 repos)

| Path | What it reads/writes | Disposition |
|---|---|---|
| `retirement-api/tools/build-db.js:8` — `const DB_PATH = join(DATA_DIR, 'retirement.db')` | Builds `retirement-api/data/retirement.db` from the canonical `data/locations/*` JSON via better-sqlite3. Invoked as the final step of `retirement-api/tools/agents/orchestrator.js` (`runBuildDb()`, line 353) on every agent-pipeline run. | **Keep** (per plan: stays as an ad-hoc snapshot tool; only its output becomes untracked in C4). |
| `retirement-dashboard` — **no hits** for the literal string `retirement.db` anywhere in `.ts/.js/.mjs/.md/.json` outside node_modules/dist/coverage | See "Surprise finding" below — the loader chain never references the filename as a string because it never actually fetches it. | **Dies with the React repo** (see below). |
| `commercialRetirementProject/packages/tools/build-db.js:8` — same `DB_PATH = join(DATA_DIR, 'retirement.db')` pattern | Builds `commercialRetirementProject/packages/data/retirement.db` from the monorepo's own **local** copy of location JSON. Self-contained; does not read from or write to `retirement-api` or `retirement-dashboard`. | **New consumer (as flagged) but isolated** — dies when the monorepo is archived in Phase D. Does not need repointing since it never crosses into the repos C4 touches. |
| `commercialRetirementProject/docs/DESIGN-DOCUMENT.md:280` | Doc line in a file tree diagram: `├── retirement.db  # SQLite (built from JSON via build-db.js)`. | Docs-to-update (see subsection) — dies with monorepo archival, no action needed beyond that. |
| `retirementProject/tools/build-db.js:8` — same pattern again | Builds `retirementProject/data/retirement.db` from **its own** local `data/locations/*` (17 legacy locations). Confirmed self-contained: grepped for `retirement-api`/`retirement-dashboard` path references anywhere in the repo — the only two hits (`dashboard/package.json:2`, `dashboard/src/store/useAppStore.js:101`) are the string `"retirement-dashboard"` used as an npm package name and a Zustand persist-storage key, not a filesystem/URL reference. | **New consumer (as flagged) but isolated, and stale.** See "Unexpected repo" note below. |
| `retirementProject/CLAUDE.md:13,31` | Doc lines describing `data/retirement.db` and `tools/build-db.js` for that repo's own local data. | Docs-to-update (see subsection); repo is stale/self-contained regardless. |
| `retirement-dashboard-angular` — no hits | Confirmed: Angular dashboard is a pure API client. | N/A. |
| `retirement-mcp` — no hits | — | N/A. |
| `retirement-monitor` — no hits | — | N/A. |

### Surprise finding: the React dashboard's sql.js path is dead code, not just "the mirror consumer"

The plan's Facts section states the React loader chain is "API → sql.js
`public/data/retirement.db` → JSON fallback." That's the *designed* chain, but
reading the actual source shows the sql.js branch never executes:

- `retirement-dashboard/src/data/db.ts:5-7`:
  ```ts
  export async function initDatabase(): Promise<Database | null> {
    return null;
  }
  ```
  This has returned `null` unconditionally since the repo's initial commit
  (`git log -- src/data/db.ts`: `97a09e9` "Initial commit", `07c2e56`, then
  `425afa1` only removed a `console.log('Using JSON data files (SQLite
  disabled)')` line — the behavior itself never changed). No commit in this
  repo's history ever made `initDatabase` read `public/data/retirement.db`.
- Because `db` is always `null`, `loader.ts:80` (`loadData`) always takes
  either the API branch (`loadLocationsFromApi()`, `loader.ts:24-72`) or, if
  the API is unreachable, the local-JSON fallback branch at
  `loader.ts:115-134` (`fetch('./data/index.json')` +
  `fetch('./data/locations/' + entry.id + '/location.json')`), and
  `locations.ts:47` for supplemental per-location JSON. The `dbAll`/`dbGet`/
  `buildLocationFromDB` functions in `db.ts:9-79` are fully wired into
  `loader.ts` and `useDatabase.ts` but are unreachable at runtime.
- `public/data/retirement.db` itself **does exist** as a tracked 8.3MB binary
  (`git ls-files public/data/retirement.db` confirms it's tracked; `git
  status` currently shows it modified) and is kept in sync by a **manual**
  process, not a script: Claude memory file
  `guam-territory-neighborhoods-fixed.md` (session
  `fe66178c-be9f-42e6-b67a-5c20b9457b57`, 2026-08-21) records "data/retirement.db
  was rebuilt ... and files + db mirrored to
  D:\retirement\retirement-dashboard\public\data\" as a one-off manual copy
  after a data-fix session. No automated script performs this copy in any of
  the 7 repos (`retirement-api`'s `orchestrator.js` only rebuilds its own
  `data/retirement.db`, in-place, and never touches the dashboard's `public/`).

Net effect: `retirement.db` in the dashboard is inert weight that is
copied by hand and never read by the running app. The **JSON half** of the
mirror (`public/data/index.json` + `public/data/locations/*.json`) is the
one part that's genuinely live — it's the fallback path exercised whenever
`loadLocationsFromApi()` fails (`loader.ts:69-71`, `locations.ts` per-location
supplemental fetch). Both halves still die together with the React repo,
since Step 2 below found no other repo depends on either.

### Unexpected repo: `retirementProject`

`retirementProject` is not mentioned anywhere in the consolidation plan's
"Facts this plan is built on" section, but it exists and is a genuinely
separate, older, fully self-contained predecessor project:

- Own git remote: `https://github.com/justice8096/retirement-planning`
  (different repo from `retirement-api`/`retirement-dashboard`).
- Own `data/`, `dashboard/` (React+Vite), and `tools/` — a near-complete
  parallel copy of the same architecture, scoped to 17 legacy locations
  (`CLAUDE.md:4`) vs. the 138+ in `retirement-api`.
- Git history is stale: last commit `9f6e2fb "chore: add LICENSE"`; working
  files date to March–April 2026.
- An n8n workflow, **"Retirement Project Checkup"** (id `TH9HschleVBN0vJi`,
  inactive), runs `git status`/`npm outdated`/`npm run build` against
  `/mnt/nas/disk1/retirementProject` on a weekly cron and writes a report note
  to Obsidian. That path is a NAS mirror of this same stale repo, not related
  to `retirement-api`/`retirement-dashboard` in any way, and the workflow
  never touches `retirement.db` or `public/data`.
- No cross-references to `retirement-api` or `retirement-dashboard` paths were
  found anywhere in the repo (checked above).

This repo is out of scope for the consolidation plan as written (it isn't
one of "the standalone repos" the plan tracks) but it does exist on disk and
does hold its own `retirement.db`. It requires no action for Task C4 — it
neither consumes nor is consumed by anything C4 touches — but the user should
be told it exists, since the plan's ecosystem description didn't account for
it.

## Step 2 — `retirement-dashboard/public` mirror-path sweep

Ran exactly as specified, across `retirement-api`, `retirement-monitor`,
`retirement-mcp`:

| Path | What it reads | Disposition |
|---|---|---|
| `retirement-api/docs/superpowers/plans/2026-08-21-consolidate-to-angular.md` (multiple lines) | The plan document itself, discussing the mirror. | Docs-to-update — this is the plan, not a stale doc; no action. |
| `retirement-monitor` — no hits | — | N/A. |
| `retirement-mcp` — no hits | — | N/A. |

### Additional finding surfaced while investigating Step 1 (not caught by the literal Step 2 grep, since it targets `commercialRetirementProject`, which Step 2's repo list excludes)

`commercialRetirementProject/tools/inject-detailed-us.js:18-20` and
`commercialRetirementProject/tools/inject-detailed-latam.js:19-21` both
declare:

```js
const SYNC_TARGETS = [
  'D:/retirement-dashboard/public/data/locations',
  'D:/retirement-api/data/locations',
];
```

These are hardcoded **absolute Windows paths missing the `retirement\` parent
directory** that both real repos actually live under
(`D:\retirement\retirement-dashboard`, `D:\retirement\retirement-api`).
Verified `D:\retirement-dashboard` and `D:\retirement-api` (top-level, no
`retirement\` prefix) do not exist as repos on this machine — `D:\retirement-dashboard`
only contains unrelated Claude session-scratch folders, and `D:\retirement-api`
doesn't exist at all. These two scripts are already broken/non-functional as
written; they cannot currently sync anywhere real. They die with the monorepo
in Phase D regardless, and would need no separate repointing even if they were
still live, since they never resolved to the real dashboard/API paths in the
first place on this machine.

## n8n check

`n8n_list_workflows` returned 11 workflows total, none active, none named
anything containing "biweekly," "cost refresh," "retirement.db," or
"mirror." Only one is retirement-related by name:

- **"Retirement Project Checkup"** (`TH9HschleVBN0vJi`) — fetched full JSON.
  Contains 4 nodes: a weekly cron trigger, an `executeCommand` node running
  `git status`/`npm outdated`/`npm run build` against
  `/mnt/nas/disk1/retirementProject` (the stale legacy repo, see above), a
  Code node formatting the output, and a `readWriteFile` node writing an
  Obsidian note. No reference to `retirement-dashboard`, `retirement.db`, or
  `public/data` anywhere in its JSON.

No other workflow's name or content suggested a link to the retirement data
pipeline. **The biweekly "data: biweekly cost refresh" commits visible in
`retirement-api`'s git log (e.g. `2d3820f`, and branches
`origin/data/biweekly-cost-refresh-2026-06-15`, `-07-01`, `-refresh-2026-06-01`,
`-08-01`) are not produced by any n8n workflow on this instance.** Whatever
schedules those runs (Windows Task Scheduler, a Claude Code scheduled
agent/cron, or a manual cadence) is outside n8n and outside the scope of the
tools available to this audit — recorded here as an **open item**, not
guessed at further.

## Docs-to-update subsection (concept consumers, not blockers)

- `retirement-api/docs/superpowers/plans/2026-08-21-consolidate-to-angular.md` — the plan itself; no update needed, it already describes the target state.
- `commercialRetirementProject/docs/DESIGN-DOCUMENT.md:280` — stale design doc; dies with monorepo archival (Phase D), no separate edit needed.
- `retirementProject/CLAUDE.md:13,31` — describes that repo's own local `retirement.db`; out of scope for this plan, left as-is.
- `retirement-api/CLAUDE.md` — does not currently mention `retirement.db` or a mirror step at all (confirmed via grep, zero hits), so Task C4 Step 2 ("remove/replace any instruction describing the dashboard mirror step") will find nothing to remove there; the "add one line about `build-db.js`" part still applies.
- Claude memory file `guam-territory-neighborhoods-fixed.md` — already flagged in the plan's Task E1 as needing an "obsolete" annotation once C3 lands; confirmed here as the actual mechanism behind the manual mirror copies.

## Verdict

**No consumers outside the React dashboard and retirement-api's own
build/docs — Task C4 may proceed as scoped.**

Detail behind that verdict:
- The two "new consumer" hits this sweep turned up (`commercialRetirementProject/packages/tools/build-db.js` and `retirementProject/tools/build-db.js`) each build and read their **own local, self-contained** `retirement.db` from their own local data directories. Neither reads from nor writes to `retirement-api`'s or `retirement-dashboard`'s files. Neither needs repointing before C4; both simply go away on their own repo's eventual archival/disposition (Phase D for the monorepo; `retirementProject` isn't part of this plan at all).
- `retirement-monitor` and `retirement-mcp` have zero references to either `retirement.db` or the `public/data` mirror in any form.
- No n8n workflow reads or writes `retirement.db` or `public/data`.
- The React dashboard's own consumption of `retirement.db` turned out to already be dead code (`initDatabase()` hardcoded to `null` since the repo's first commit) — it was never functionally live, only manually mirrored. The JSON half of the mirror (`public/data/index.json` + per-location JSON) is genuinely live as an offline fallback, but only within the React app itself.
- The one thing to flag to the user (not a blocker, an FYI): `retirementProject` is a fully separate, stale, self-contained predecessor repo that the consolidation plan's "Facts" section doesn't mention. It requires no action for C4.
