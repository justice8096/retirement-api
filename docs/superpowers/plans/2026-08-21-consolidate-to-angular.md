# Retirement Ecosystem Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate to a single dashboard (Angular), a single engine package (`@retirement/shared` living in retirement-api), and a single data path (canonical JSON → Postgres → API), then retire the React dashboard and the stale `commercialRetirementProject` monorepo.

**Architecture:** The Angular dashboard is already a pure API client (HttpClient against `environment.apiBaseUrl`; no sql.js, no static JSON). The API already seeds Postgres from the canonical `data/locations/*/` JSON. So the target state needs no new plumbing — it needs the *removal* of the parallel paths: the React dashboard's static-mirror pipeline (public/data JSON + retirement.db + sql.js), the `sync-engine.mjs` copy step, and the monorepo's duplicate `@retirement/shared`. The engine's TypeScript source moves to one package that Angular, the API, and the MCP all import.

**Tech Stack:** TypeScript, Angular 18+ (signals), Fastify 5, Prisma 7/PostgreSQL, better-sqlite3 (build tooling only), MCP SDK, vitest.

**Decisions already made by the user:**
- Keep the **Angular** dashboard (`D:\retirement\retirement-dashboard-angular`); remove the **React** one (`D:\retirement\retirement-dashboard`).
- Nothing gets hard-deleted: retired repos are archived (renamed + final tag), not destroyed.

**Facts this plan is built on (verified 2026-08-21):**
- Angular dashboard loads everything via `ApiService` (`src/app/services/api.service.ts`) → `environment.apiBaseUrl` (dev `http://localhost:3000/api`, prod `/api`). It never reads `retirement.db` or static location JSON.
- React dashboard's loader chain is API → sql.js `public/data/retirement.db` → `public/data/index.json` + per-location JSON. It is the only known consumer of `retirement.db` and of the `public/data/locations` mirror.
- Engine copies: canonical TS in `retirement-dashboard-angular/src/app/lib/` (monte-carlo.ts, rental-income.ts, tax-sources.ts, aca-constants.ts) + `src/app/data/historical-returns.ts`; generated copy in `retirement-api/src/lib/engine/` via `tools/sync-engine.mjs`; compiled JS calc lib in `retirement-api/shared/`; React worker `src/workers/montecarlo.worker.ts` (dies with the repo); monorepo copy in `commercialRetirementProject/packages/shared` (the MCP's current `file:` dependency).
- `retirement-mcp/package.json` depends on `"@retirement/shared": "file:../commercialRetirementProject/packages/shared"`.
- `commercialRetirementProject` is a parallel monorepo (packages: api, dashboard, data, shared, tools). All recent live work (git log through #170) happens in the standalone repos.

---

## Phase A — Audits (no behavior changes; each produces an artifact the later phases consume)

### Task A1: Confirm the full consumer list for `retirement.db` and the static mirror

**Files:**
- Create: `D:\retirement\retirement-api\docs\superpowers\plans\artifacts\a1-db-consumers.md`

- [ ] **Step 1: Sweep for retirement.db references outside node_modules**

Run (Git Bash; `-rn` over the repo roots only, skipping node_modules explicitly so it finishes fast):

```bash
for repo in retirement-api retirement-dashboard retirement-dashboard-angular retirement-mcp retirement-monitor commercialRetirementProject retirementProject; do
  grep -rn "retirement\.db" "/d/retirement/$repo" \
    --include="*.ts" --include="*.js" --include="*.mjs" --include="*.md" --include="*.json" \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage -l 2>/dev/null \
    | sed "s|^|$repo: |"
done
```

Expected: hits in `retirement-dashboard` (loader/db/useDatabase), `retirement-api/tools/build-db.js` + docs. Any hit in `retirement-monitor`, `retirement-mcp`, or the monorepo is a **new consumer** — record it; it changes Task C4's disposition of `build-db.js`.

- [ ] **Step 2: Sweep the same repos for `public/data/locations` mirror references**

```bash
for repo in retirement-api retirement-monitor retirement-mcp n8n-flows; do
  grep -rn "retirement-dashboard/public" "/d/retirement/$repo" \
    --exclude-dir=node_modules -l 2>/dev/null | sed "s|^|$repo: |"
done
```

Also check n8n: open the n8n workflow list (n8n MCP `n8n_list_workflows`) and search workflow JSON for `retirement-dashboard` or `retirement.db` (the biweekly "data: biweekly cost refresh" automation may write to or read from the mirror).

- [ ] **Step 3: Write the artifact**

`a1-db-consumers.md` lists every consumer found, one line each: `path — what it reads — disposition (dies with React repo / must be repointed / keep)`.

- [ ] **Step 4: Commit**

```bash
cd /d/retirement/retirement-api && git add docs/superpowers/plans/artifacts/a1-db-consumers.md && git commit -m "docs: audit retirement.db and static-mirror consumers (consolidation A1)"
```

### Task A2: Identify what the running `retirement-planner` MCP server actually executes

**Files:**
- Create: `docs/superpowers/plans/artifacts/a2-mcp-source.md` (in retirement-api)

- [ ] **Step 1: Find the registered command for the server**

```bash
grep -rn "retirement" ~/.claude.json ~/.claude/settings.json 2>/dev/null | grep -i "mcp\|command\|args" | head
```

(If not there, check `claude mcp list` output in an interactive session, or `%USERPROFILE%\.claude\settings.local.json` and project `.mcp.json` files.)

- [ ] **Step 2: Read the entry point it runs and record where `list_locations` / `get_location` / `run_scenario` get their data**

The connected server exposes `list_locations`, `get_location`, `list_presets`, `run_scenario`, `compare_scenarios`. `retirement-mcp/src/index.ts` greps clean for "location", so the running build is probably `retirement-mcp/dist/` from an older source, or a server inside the monorepo. Read the actual file the registered command points at; note: (a) repo + file, (b) data source for location tools (JSON dir? API? bundled copy?), (c) which `@retirement/shared` it loads.

- [ ] **Step 3: Write `a2-mcp-source.md` with those three facts and commit**

```bash
cd /d/retirement/retirement-api && git add docs/superpowers/plans/artifacts/a2-mcp-source.md && git commit -m "docs: audit retirement-planner MCP entry point and data source (consolidation A2)"
```

### Task A3: Engine drift audit across the four copies

**Files:**
- Create: `docs/superpowers/plans/artifacts/a3-engine-drift.md` (in retirement-api)

- [ ] **Step 1: Textually diff each copy against the Angular canonical**

```bash
cd /d/retirement
for f in monte-carlo.ts rental-income.ts tax-sources.ts aca-constants.ts; do
  echo "== $f: angular vs api/src/lib/engine =="
  git diff --no-index --stat "retirement-dashboard-angular/src/app/lib/$f" "retirement-api/src/lib/engine/$f"
done
git diff --no-index --stat "retirement-dashboard-angular/src/app/data/historical-returns.ts" "retirement-api/src/lib/engine/historical-returns.ts"
echo "== monorepo shared vs api/shared =="
diff -qr commercialRetirementProject/packages/shared retirement-api/shared --exclude=node_modules --exclude=__tests__ | head -40
```

Expected: angular↔api diffs limited to the import-specifier rewrites `sync-engine.mjs` performs (`.js` extension suffixes and the GENERATED header). Anything beyond that is real drift.

- [ ] **Step 2: Diff the React worker's engine usage**

```bash
grep -n "import\|from" /d/retirement/retirement-dashboard/src/workers/montecarlo.worker.ts | head -20
```

Record whether the worker embeds its own math or imports a lib copy. Any bugfix that exists *only* in the React worker must be listed for porting into the shared package (Phase B).

- [ ] **Step 3: Write `a3-engine-drift.md`**

For every real (non-mechanical) difference: file, hunk summary, and a verdict — `canonical-wins` / `port-into-canonical` / `investigate`. This list is the work queue for Task B2 Step 3.

- [ ] **Step 4: Commit**

```bash
cd /d/retirement/retirement-api && git add docs/superpowers/plans/artifacts/a3-engine-drift.md && git commit -m "docs: audit engine drift across the four copies (consolidation A3)"
```

### Task A4: React → Angular feature-parity audit

**Files:**
- Create: `docs/superpowers/plans/artifacts/a4-parity-gaps.md` (in retirement-api)

- [ ] **Step 1: Enumerate the React surface**

```bash
ls /d/retirement/retirement-dashboard/src/tabs
ls /d/retirement/retirement-dashboard/src/components | head -40
ls /d/retirement/retirement-dashboard/src/__tests__
```

- [ ] **Step 2: For each React tab, find (or fail to find) the Angular equivalent**

```bash
ls /d/retirement/retirement-dashboard-angular/src/app/components
grep -rn "neighborhood\|grocery\|inclusion\|services\|local-info" /d/retirement/retirement-dashboard-angular/src/app/components -li | head -20
```

Build a two-column table in `a4-parity-gaps.md`: React feature → Angular status (`exists` / `partial: <what's missing>` / `missing`). Known specifics to check explicitly: the NeighborhoodsTab's Google Maps links and map-pin coordinates rendering, the Monte Carlo web-worker responsiveness pattern, the grocery-override UI, and the accessibility affordances (the React app is the one the dyslexia/dyscalculia audits were run against — confirm Angular's `dyslexia.service.ts` / `dyscalculia.service.ts` cover the same accommodations).

- [ ] **Step 3: Get the user's sign-off on the gap list**

Present the `missing`/`partial` rows to the user and ask which ones actually matter to them (they are the only user; unused features should not be ported). Mark each row `port` or `drop`. **Do not proceed to Phase C until every row is marked.**

- [ ] **Step 4: Commit**

```bash
cd /d/retirement/retirement-api && git add docs/superpowers/plans/artifacts/a4-parity-gaps.md && git commit -m "docs: React->Angular parity audit with port/drop decisions (consolidation A4)"
```

---

## Phase B — Single engine package (`@retirement/shared` in retirement-api)

The package home is `retirement-api/shared/` because it is already versioned beside the canonical data and the API imports it via the `#shared/*` subpath. The Angular engine TS files move in as source; consumers switch to importing the package; the generated copy and the sync script die.

### Task B1: Make `retirement-api/shared` a real named package

**Files:**
- Create: `D:\retirement\retirement-api\shared\package.json`
- Test: existing `shared/__tests__/` suite (already run by `npm run test:shared`)

- [ ] **Step 1: Write the package manifest**

```json
{
  "name": "@retirement/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./*": "./*"
  }
}
```

Note: check first whether `shared/index.js` exists (`ls /d/retirement/retirement-api/shared/index.*`). If there is no barrel file, omit the `"."` export and keep only the wildcard subpath export — consumers import `@retirement/shared/monte-carlo` etc.

- [ ] **Step 2: Verify nothing breaks**

```bash
cd /d/retirement/retirement-api && npm run test:shared && npm run typecheck
```

Expected: both pass (the manifest is additive; `#shared/*` imports still resolve).

- [ ] **Step 3: Commit**

```bash
git add shared/package.json && git commit -m "feat(shared): name shared/ as @retirement/shared package"
```

### Task B2: Move the engine TS source from the Angular repo into the shared package

**Files:**
- Create: `retirement-api/shared/engine/monte-carlo.ts`, `shared/engine/rental-income.ts`, `shared/engine/tax-sources.ts`, `shared/engine/aca-constants.ts`, `shared/engine/historical-returns.ts`, `shared/engine/types.ts`
- Modify: `retirement-api/shared/package.json` (exports already wildcard — no change needed if B1 used `"./*"`)

- [ ] **Step 1: Copy the canonical files (Angular versions, per the A3 verdicts)**

```bash
cd /d/retirement
mkdir -p retirement-api/shared/engine
cp retirement-dashboard-angular/src/app/lib/monte-carlo.ts    retirement-api/shared/engine/
cp retirement-dashboard-angular/src/app/lib/rental-income.ts  retirement-api/shared/engine/
cp retirement-dashboard-angular/src/app/lib/tax-sources.ts    retirement-api/shared/engine/
cp retirement-dashboard-angular/src/app/lib/aca-constants.ts  retirement-api/shared/engine/
cp retirement-dashboard-angular/src/app/data/historical-returns.ts retirement-api/shared/engine/
cp retirement-api/src/lib/engine/types.ts retirement-api/shared/engine/ 2>/dev/null || true
```

- [ ] **Step 2: Fix intra-engine import specifiers for nodenext resolution**

Apply the same rewrites `tools/sync-engine.mjs` documents (read its `REWRITES` array and apply them to the copied files): relative imports gain explicit `.js` extensions, and any `../data/historical-returns` path becomes `./historical-returns.js`. Show your work by diffing against the API's existing generated copy — after rewriting, this diff should be empty except the GENERATED header:

```bash
for f in monte-carlo rental-income tax-sources aca-constants historical-returns; do
  git diff --no-index retirement-api/src/lib/engine/$f.ts retirement-api/shared/engine/$f.ts
done
```

- [ ] **Step 3: Apply every `port-into-canonical` item from `a3-engine-drift.md`**

Each drift item is applied to the `shared/engine/` copy now, as its own commit, quoting the A3 item in the commit message. If A3 found none, skip.

- [ ] **Step 4: Port the engine tests**

```bash
ls /d/retirement/retirement-dashboard-angular/src/app/lib/*.spec.ts
```

Copy any `monte-carlo.spec.ts` / `rental-income.spec.ts` style specs into `retirement-api/shared/__tests__/engine/`, fix their imports to `../engine/monte-carlo.js` style, then:

```bash
cd /d/retirement/retirement-api && npm run test:shared
```

Expected: PASS, with the new engine specs listed in the run.

- [ ] **Step 5: Commit**

```bash
git add shared/engine shared/__tests__/engine && git commit -m "feat(shared): move Monte Carlo engine source into @retirement/shared/engine"
```

### Task B3: Point the API at the package copy; delete the generated copy and the sync script

**Files:**
- Modify: every `retirement-api/src/**` file importing from `lib/engine` (find with the grep in Step 1)
- Delete: `retirement-api/src/lib/engine/` (whole dir), `retirement-api/tools/sync-engine.mjs`
- Modify: `retirement-api/package.json` (remove the `engine:sync` script)

- [ ] **Step 1: Find the import sites**

```bash
cd /d/retirement/retirement-api && grep -rn "lib/engine" src --include="*.ts" | grep -v "src/lib/engine/"
```

- [ ] **Step 2: Rewrite each import**

`from '../lib/engine/monte-carlo.js'` → `from '#shared/engine/monte-carlo.js'` (matching however deep the importing file sits; the `#shared/*` imports map in package.json already resolves the prefix).

- [ ] **Step 3: Delete the generated copy and sync script; drop the npm script**

```bash
git rm -r src/lib/engine tools/sync-engine.mjs
```

Remove the `"engine:sync"` line from `package.json` scripts.

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm test
```

Expected: PASS. If the simulate route has integration tests, they exercise the new import path.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(api): import engine from @retirement/shared, delete generated copy and sync-engine.mjs"
```

### Task B4: Point the Angular dashboard at the package

**Files:**
- Modify: `retirement-dashboard-angular/package.json` (add dependency), `tsconfig.json` (path mapping), every `src/app/**` file importing `@app/lib/monte-carlo` or the moved files
- Delete: `retirement-dashboard-angular/src/app/lib/monte-carlo.ts`, `rental-income.ts`, `tax-sources.ts`, `aca-constants.ts`, `src/app/data/historical-returns.ts`

- [ ] **Step 1: Add the file dependency**

In `retirement-dashboard-angular/package.json` dependencies:

```json
"@retirement/shared": "file:../retirement-api/shared"
```

Then `npm install` in the Angular repo.

- [ ] **Step 2: Rewrite imports**

```bash
cd /d/retirement/retirement-dashboard-angular
grep -rn "@app/lib/monte-carlo\|lib/rental-income\|lib/tax-sources\|lib/aca-constants\|data/historical-returns" src --include="*.ts" -l
```

Each hit: `from '@app/lib/monte-carlo'` → `from '@retirement/shared/engine/monte-carlo'` (and likewise for the other four modules). If the Angular build (`moduleResolution: bundler`) complains about the `.js`-suffixed intra-engine imports, add `"allowImportingTsExtensions"`-free path handling by consuming the package's compiled output instead — compile the engine in shared (`npx tsc shared/engine/*.ts --outDir shared/engine --declaration` from retirement-api) so the package ships `.js` + `.d.ts` beside the `.ts` and bundler resolution picks the JS. Record which route was needed.

- [ ] **Step 3: Delete the now-unowned canonical files and verify**

```bash
git rm src/app/lib/monte-carlo.ts src/app/lib/rental-income.ts src/app/lib/tax-sources.ts src/app/lib/aca-constants.ts src/app/data/historical-returns.ts
npm run build && npm test
```

Expected: build + tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: consume Monte Carlo engine from @retirement/shared instead of local lib copies"
```

### Task B5: Point the MCP at the package

**Files:**
- Modify: `retirement-mcp/package.json`

- [ ] **Step 1: Switch the dependency**

```json
"@retirement/shared": "file:../retirement-api/shared"
```

```bash
cd /d/retirement/retirement-mcp && npm install && npm run build
```

- [ ] **Step 2: Smoke-test the running tools**

Rebuild/restart the MCP (per how A2 found it registered), then from a Claude session call `list_presets` and `run_scenario` with a trivial scenario (portfolio 1_000_000, spend 40_000, 30 years). Expected: results within normal range (success rate 0-100, no import errors in the server log).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json && git commit -m "refactor: depend on @retirement/shared from retirement-api, not the monorepo"
```

---

## Phase C — Remove the React dashboard

**Gate: A4 Step 3 sign-off complete; every `port` row from `a4-parity-gaps.md` implemented in Angular (each as its own commit in the Angular repo, referencing the A4 row).**

### Task C1: Port the React data-validation test suites into retirement-api

These tests (`groceryData`, `housingData`, `localInfoData`, `localInfoLinks`, `personalCareData`, `supplementData`) validate the *canonical data*, not the React UI — they belong beside the data.

**Files:**
- Create: `retirement-api/data/__tests__/` (one file per suite, copied from `retirement-dashboard/src/__tests__/`)
- Modify: `retirement-api/package.json` (add `"test:data": "vitest run data/__tests__"`)

- [ ] **Step 1: Copy and repoint**

```bash
mkdir -p /d/retirement/retirement-api/data/__tests__
cp /d/retirement/retirement-dashboard/src/__tests__/{groceryData,housingData,localInfoData,localInfoLinks,personalCareData,supplementData}.test.ts /d/retirement/retirement-api/data/__tests__/
```

In each copied file, change the data root from the React `public/data/locations` path to `../locations` (relative to the test file), and strip any React/sql.js imports — the suites should read the JSON files directly with `fs`.

- [ ] **Step 2: Run**

```bash
cd /d/retirement/retirement-api && npx vitest run data/__tests__
```

Expected: PASS (they passed against the mirror, and the mirror equals canonical as of 2026-08-21). Any failure is a real data bug — fix the data, not the test.

- [ ] **Step 3: Add the npm script and commit**

```bash
git add data/__tests__ package.json && git commit -m "test(data): adopt data-validation suites from the React dashboard"
```

### Task C2: Verify Angular covers daily use, end to end

- [ ] **Step 1: Boot the full stack**

```bash
cd /d/retirement/retirement-api && docker compose up -d
cd /d/retirement/retirement-dashboard-angular && npm start
```

- [ ] **Step 2: Manual walkthrough with the user**

The user drives their real workflow for a session: location compare, neighborhoods (spot-check the new Guam/Saipan data renders), Monte Carlo run, grocery overrides, accessibility toggles. **User says "good to go" or files gaps.** Gaps go back through the A4 template before continuing.

### Task C3: Archive the React repo

- [ ] **Step 1: Final commit and tag inside the React repo**

```bash
cd /d/retirement/retirement-dashboard
git add -A && git commit -m "chore: final state before archival (superseded by retirement-dashboard-angular)" --allow-empty
git tag archived-2026-08 -m "Archived: superseded by retirement-dashboard-angular. See retirement-api/docs/superpowers/plans/2026-08-21-consolidate-to-angular.md"
git push && git push --tags
```

(If the repo has a GitHub remote, also archive it in GitHub settings — user action, read-only flag.)

- [ ] **Step 2: Move the working copy out of the active tree**

```bash
mkdir -p /d/retirement/_archive
mv /d/retirement/retirement-dashboard /d/retirement/_archive/retirement-dashboard-react
```

- [ ] **Step 3: Confirm nothing broke**

Re-run the A1 consumer sweep commands. Expected: zero live references to the moved path.

### Task C4: Retire the derived artifacts the React app consumed

**Files:**
- Modify: `retirement-api/.gitignore` (add `data/retirement.db`), `retirement-api/CLAUDE.md`
- Keep: `tools/build-db.js` (still useful for ad-hoc SQL analysis in Claude sessions — but its output becomes untracked)

Precondition: A1 found no consumers besides the React app. If A1 found others, repoint them first and re-scope this task.

- [ ] **Step 1: Stop tracking the 8.7MB binary**

```bash
cd /d/retirement/retirement-api
git rm --cached data/retirement.db
printf "\ndata/retirement.db\n" >> .gitignore
```

- [ ] **Step 2: Update CLAUDE.md**

Remove/replace any instruction describing the dashboard mirror step; add one line under Getting started: `tools/build-db.js` builds an *optional, untracked* SQLite snapshot of the canonical data for ad-hoc queries.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: untrack derived retirement.db; document build-db.js as optional snapshot tool"
```

---

## Phase D — Monorepo disposition

**Gate: B5 done (MCP no longer depends on the monorepo) and A2 confirmed the running MCP server does not execute from the monorepo (if it does, re-register it to `retirement-mcp` first and re-verify with the B5 smoke test).**

### Task D1: Divergence check, then archive `commercialRetirementProject`

- [ ] **Step 1: Confirm the monorepo has nothing newer than the standalone repos**

```bash
cd /d/retirement/commercialRetirementProject && git log --oneline -5 --date=short --pretty="%h %ad %s"
diff -qr packages/data /d/retirement/retirement-api/data --exclude=node_modules --exclude=retirement.db | head -20
```

If any monorepo file is *newer and different* in a way that matters (data corrections, engine fixes), port it to the standalone repo first, as its own commit citing the source path.

- [ ] **Step 2: Archive exactly as in C3**

```bash
cd /d/retirement/commercialRetirementProject
git add -A && git commit -m "chore: final state before archival (superseded by standalone repos)" --allow-empty
git tag archived-2026-08 -m "Archived: live development happens in retirement-api / retirement-dashboard-angular / retirement-mcp"
mv /d/retirement/commercialRetirementProject /d/retirement/_archive/commercialRetirementProject
```

- [ ] **Step 3: Verify the MCP still runs**

Repeat the B5 Step 2 smoke test. Expected: unchanged results (its dependency now resolves inside `_archive/` only if npm install was never re-run — which is why B5 must land first; `npm ls @retirement/shared` in retirement-mcp must show the retirement-api path).

---

## Phase E — Documentation and memory cleanup

### Task E1: Update the ecosystem docs to describe the consolidated shape

**Files:**
- Modify: `retirement-api/CLAUDE.md` (add an "Ecosystem" section: canonical data here; Angular dashboard is the client; shared engine lives in `shared/engine`; MCP consumes it)
- Modify: `retirement-dashboard-angular/README.md` or `CLAUDE.md` (state it is *the* dashboard; React archived)
- Modify: Claude memory file `C:\Users\justi\.claude\projects\D--retirement-retirement-api\memory\guam-territory-neighborhoods-fixed.md` (the "mirror to retirement-dashboard\public\data" instruction is obsolete once C3 lands — annotate it)

- [ ] **Step 1: Make the three edits, each stating the new single-path rule: edit canonical JSON → `npm run db:seed` → Angular sees it via the API. No mirror step exists.**

- [ ] **Step 2: Commit each repo's doc change**

```bash
cd /d/retirement/retirement-api && git add CLAUDE.md && git commit -m "docs: describe consolidated ecosystem (single dashboard, single engine, single data path)"
cd /d/retirement/retirement-dashboard-angular && git add . && git commit -m "docs: note this is the sole dashboard; React app archived 2026-08"
```

### Task E2: Side findings to raise with the user (not in scope, do not fix silently)

- [ ] Angular `environment.production` ships a `pk_test_` Clerk publishable key — production should use a `pk_live_` instance (and the API env in lockstep, per the comment in that file).
- [ ] **User decision 2026-08-21:** per-year pet/dependent cost curves (`petCostByYear`/`dependentCostByYear`, dead in the retired React worker) are wanted post-consolidation, populated end-to-end from `/api/me/household` + location pet-cost data. Tracked in the A3 artifact's "User decision" section and as a spawned background task.
- [ ] The n8n biweekly cost-refresh automation: confirm (from A1 Step 2) it writes canonical JSON + reseeds Postgres, and does not depend on the retired mirror.

---

## Execution order and independence

A1–A4 are independent of each other and can run in parallel. B1→B2→B3/B4/B5 (B3, B4, B5 are independent of each other once B2 lands). C gates on A4 sign-off; C4 gates on A1. D gates on B5 + A2. E gates on C and D. Every phase leaves all repos building and tested.
