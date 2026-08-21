# A2 — What the running `retirement-planner` MCP server actually executes

Date: 2026-08-21. Scope: find the registered command for the `retirement-planner`
MCP server (the one surfaced to Claude sessions as
`mcp__retirement-planner__{list_locations,get_location,list_presets,run_scenario,compare_scenarios}`),
read its actual entry point, and trace where its data comes from. Read-only
audit — no MCP code or config was modified.

## Step 1 — Finding the registration

`grep -n "retirement" "$USERPROFILE/.claude.json" | grep -i "command\|args\|planner"`
found exactly one match, in the top-level `mcpServers` block:

`C:\Users\justi\.claude.json:1190-1195`
```json
"retirement-planner": {
  "command": "C:\\Users\\justi\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python312\\Scripts\\uv.exe",
  "args": [
    "run",
    "D:\\retirement-planner-mcp\\server.py"
  ]
}
```

No `cwd` and no `env` key on this entry (contrast with the neighboring
`homelab`/`obsidian` entries in the same file, which do carry `env`) — so it
runs with whatever default `RETIREMENT_API_BASE` the script itself falls back
to (see Fact (b)).

Checked and came up empty, as instructed:
- `~/.claude/settings.json`, `~/.claude/settings.local.json` — no
  `retirement-planner` hits.
- `.mcp.json` anywhere under `/d/retirement/*` or `/d/retirement-api/*`
  (`find ... -iname ".mcp.json"`) — none exist. This server is registered only
  in the user-level `~/.claude.json`, not project-scoped.

**This registration does not point at `retirement-mcp` (the TypeScript repo)
or at anything inside `commercialRetirementProject` at all.** It points at a
third, previously-unmentioned location: `D:\retirement-planner-mcp\server.py`,
a standalone Python script, launched via `uv run`.

## Step 2 — Reading the entry point

`D:\retirement-planner-mcp\server.py` (283 lines total, read in full) is a
`uv` single-file script (PEP 723 inline metadata block, lines 1-4:
`dependencies = ["mcp>=2,<3", "httpx>=0.27"]`). Its own module docstring
(lines 5-26) states the design plainly:

> "This is a THIN client. The actual Monte Carlo engine runs server-side on
> the deployed API (POST /api/simulate) ... Location cost-of-living data
> comes from the same API's public endpoints."

Concretely:
- `server.py:38-41` — `API_BASE` defaults to
  `"https://retirement-dashboard.tailceab8.ts.net/api"`, overridable via the
  `RETIREMENT_API_BASE` env var (not set for this server — see Step 1).
- `server.py:81-92` — `_post()`/`_get()` are plain `httpx.AsyncClient` calls
  against `f"{API_BASE}{path}"`. No local imports of any `@retirement/*`
  package, no filesystem reads of location JSON, no SQLite, no bundled data.
- `server.py:228-243` (`list_locations`) → `GET {API_BASE}/locations`.
- `server.py:246-274` (`get_location`) → `GET {API_BASE}/locations/{location_id}`.
- `server.py:159-187` (`run_scenario`) and `server.py:190-224`
  (`compare_scenarios`) → `POST {API_BASE}/simulate`.
- `server.py:148-156` (`list_presets`) is the only tool with no network call —
  it just serializes the hardcoded `PRESETS` list (lines 47-77), which
  includes a "panama-couple-65" preset.

`D:\retirement-planner-mcp\` has no `node_modules`, no `.venv` checked in
(only `__pycache__` and a `.bak` copy of a prior version) — confirmed with
`find /d/retirement-planner-mcp -maxdepth 3 -iname node_modules -o -iname "*.venv*"`,
which returned nothing. There is no `@retirement/shared` dependency of any
kind here; this server is pure Python with two PyPI dependencies (`mcp`,
`httpx`).

## Step 3 — Tracing the HTTP target

`https://retirement-dashboard.tailceab8.ts.net` is not some other team's
service — it is **retirement-api's own Tailscale funnel**, confirmed two ways:

1. `retirement-api/docker-compose.yml:130-141` defines a `tailscale-dashboard`
   sidecar service with `hostname: retirement-dashboard` (line 132) and
   `TS_HOSTNAME: retirement-dashboard` (line 135), tagged
   `tag:funnel-dashboard` (comment at line 127-129), fronting the `api`
   service that's published on `${API_PORT:-3000}:3000`
   (`docker-compose.yml:45,54`).
2. `retirement-api/docs/PENTEST.md:68` and `retirement-api/pentest/*`
   (`docker-compose.pentest.yml:26,36,45,55,66`,
   `pentest/shodan/check-hostname.py:27`) all target
   `retirement-dashboard.tailceab8.ts.net` explicitly as *this* repo's own
   funnel-exposed pentest surface.

No other repo on disk claims that hostname: `commercialRetirementProject`'s
`docker-compose.yml` / `docker-compose.prod.yml` have no `tailscale`/`funnel`/
`TS_HOSTNAME` service at all (one unrelated comment in
`docker-compose.prod.yml:72` about generating a tailscale cert, no sidecar
container). So the deployed API answering `/api/locations` and
`/api/simulate` for the MCP's HTTP calls is **retirement-api's own server**,
not `commercialRetirementProject`'s.

Confirmed the routes exist server-side, in `retirement-api`:
- `retirement-api/src/server.ts:323` — `await app.register(locationRoutes, { prefix: '/api/locations' })`.
- `retirement-api/src/server.ts:341` — `await app.register(simulateRoutes, { prefix: '/api/simulate' })`.
- `retirement-api/src/routes/simulate.ts:1-17` — doc comment: "the SAME engine
  the dashboard runs client-side ... so remote callers — **notably the
  retirement MCP on a thin client** — get results identical to the app
  without reimplementing the kernel." This confirms retirement-api's own
  authors already designed `/api/simulate` with this exact MCP client in mind.

## The three facts

**(a) Which repo + file the running server executes:**
Neither `retirement-mcp` nor `commercialRetirementProject`. The registered
command (`C:\Users\justi\.claude.json:1190-1195`) runs
`D:\retirement-planner-mcp\server.py` via `uv run` — a standalone,
single-file Python script in a repo/folder not mentioned anywhere in the
consolidation plan's "Facts this plan is built on" section.

**(b) Where its location/scenario tools get their data:**
Neither a local JSON dir, nor bundled data, nor SQLite. All five tools except
`list_presets` make live HTTPS calls (`server.py:81-92`) to
`https://retirement-dashboard.tailceab8.ts.net/api` (default, overridable by
`RETIREMENT_API_BASE`, unset here) — which is **retirement-api's own**
deployed instance, exposed via the `tailscale-dashboard` sidecar in
`retirement-api/docker-compose.yml:130-141`, answering through
`retirement-api/src/server.ts:323` (`/api/locations`) and `:341`
(`/api/simulate`). `list_presets` (`server.py:148-156`) returns a hardcoded
in-script list (`server.py:47-77`) with no network call.

**(c) Which copy of `@retirement/shared` it loads at runtime:**
None. `D:\retirement-planner-mcp` has no `node_modules` and is not a Node
project at all (`find ... -iname node_modules` returned nothing); its only
dependencies are the PyPI packages `mcp` and `httpx` declared in the PEP 723
header (`server.py:1-4`). The Monte Carlo math it reports comes from whatever
build of `@retirement/shared`/`monte-carlo.ts` is compiled into the
**running retirement-api container** behind the funnel — not from any file
this MCP process loads itself. This audit did not additionally verify which
source `@retirement/shared` copy the *deployed retirement-api container's
image* was built from (that's a retirement-api build/deploy question, not an
MCP-registration question) — flagged as an open item below.

## Consequences for the plan

**Task B5** (switching `retirement-mcp`'s `@retirement/shared` dependency
from `file:../commercialRetirementProject/packages/shared` to
`file:../retirement-api/shared`) **will have zero effect on the server the
user's Claude sessions actually talk to.** `retirement-mcp` is not registered
anywhere (`~/.claude.json`, `~/.claude/settings*.json`, and every `.mcp.json`
searched all came up empty for it) and the running `retirement-planner`
server is a separate Python process that never imports `retirement-mcp` or
any Node package. B5 may still be worth doing for its own sake (correctness
of an unused-but-present repo, or in case `retirement-mcp` gets registered
later), but it is **not a prerequisite for, and does not touch, the tools the
user is actually calling today.**

**Task D1** (archiving `commercialRetirementProject`) **will not break the
running `retirement-planner` server, based on everything checked here.** The
server's only external dependency is the HTTP API at
`retirement-dashboard.tailceab8.ts.net`, which is demonstrably
`retirement-api`'s own funnel (Step 3), not anything served out of
`commercialRetirementProject`. Archiving (renaming, not deleting, per the
plan's stated approach) `commercialRetirementProject` does not stop
`retirement-api`'s Docker Compose stack or its Tailscale funnel, so the MCP's
HTTP calls keep resolving the same way after D1 lands.

**Caveat / open item for whoever runs D1:** this audit confirms the *routing*
(which repo answers the funnel hostname) but did not independently verify,
from a live shell on the machine hosting the funnel, that the
`tailscale-dashboard` container is actually currently up and that no manual,
undocumented process ever pointed that same hostname at a
`commercialRetirementProject`-built container in the past. The static
evidence (docker-compose service definitions, pentest docs, route
registrations, and the simulate.ts doc comment naming this exact MCP client)
all agree the hostname belongs to `retirement-api`, but a live
`docker compose ps` / `tailscale status` check before archiving
`commercialRetirementProject` would remove the last bit of doubt. This is a
"verify before you delete anything" caution, not a reason to block D1 on this
artifact.

**Unrelated finding worth surfacing to the user (not a plan blocker):** the
plan's "Facts" section lists `retirement-mcp`'s dependency on
`commercialRetirementProject/packages/shared` as if `retirement-mcp` were a
live, connected server. Based on everything found in this audit,
`retirement-mcp` is not currently registered as an MCP server anywhere on
this machine — the actually-connected server (`retirement-planner`) is the
unrelated `D:\retirement-planner-mcp\server.py` thin client described above.
Whether `retirement-mcp` is used by some other, non-Claude-Code consumer, or
is simply a not-yet-wired-up successor, is outside this audit's scope.
