# Per-year pet & dependent cost curves — design

Date: 2026-08-21. Status: approved direction per user decision recorded in
`docs/superpowers/plans/artifacts/a3-engine-drift.md` ("User decision"
section) and the consolidation plan's Phase E side-findings. This session
was spawned specifically to implement it; the design below fills in the
mechanics the decision left open.

## Problem

The retired React worker declared `petCostByYear[]` / `dependentCostByYear[]`
and read them in its sim loop, but no caller ever populated them — dead code.
The user wants the capability real: per-year pet and dependent cost curves in
the canonical Monte Carlo engine, **populated end-to-end from real data**
(household pets/members via `/api/me/household`, per-location pet costs in
`location.json` `monthlyCosts.petCare/petDaycare/petGrooming`), surfaced in
the Angular dashboard's Monte Carlo screen.

Why curves instead of today's behavior: the flat `baseCost` already includes
the location's three pet categories and silently assumes those costs run at
full rate **forever** — a 12-year-old dog is billed for 40 sim years. And
dependents aren't modeled at all — a child who leaves the household at 22
costs the same as one who never does (i.e. $0 explicit either way). Curves
make both time-bounded and age-aware.

## Consolidation coordination (context, not design)

Another session is mid-flight on `docs/superpowers/plans/2026-08-21-consolidate-to-angular.md`:
branch `consolidation` at B1; B2's engine copy exists as **untracked** files
in the main checkout. This work:

- lives on `claude/objective-dijkstra-60a597` (this worktree), based on
  `consolidation`, with a first commit that adopts the B2 output
  byte-for-byte so a later merge of the two branches is a superset resolve;
- touches the Angular repo only in a dedicated worktree/branch
  (`feat/pet-dependent-cost-curves`), never the main checkout;
- ALSO applies the engine change to the Angular canonical
  (`src/app/lib/monte-carlo.ts`) and the API's generated copy
  (`src/lib/engine/`, via `tools/sync-engine.mjs`) because pre-B3/B4 those
  are the copies production code actually imports. Post-consolidation the
  feature survives in `shared/engine` regardless of merge order.

## Design

### 1. Kernel (`monte-carlo.ts`, all copies)

Two new optional params, following the existing sparse per-year array
convention (`medicareMonthlyByYear`, `inheritanceTaxByYear`):

```ts
/** Per-year household pet cost, annual USD in today's dollars, index = sim
 *  year. Sparse: missing/undefined/0 entries deduct nothing. Inflated by
 *  cumInfl at deduction time (same convention as LTC / rental / one-time
 *  expenses — USD baseline, NO per-trial FX). When set, the caller is
 *  responsible for EXCLUDING the location's petCare/petDaycare/petGrooming
 *  categories from segment baseCost — the curve replaces them. */
petCostByYear?: number[];
/** Per-year dependent (children / adult dependents) cost, annual USD in
 *  today's dollars. Purely additive — the flat baseCost never included
 *  dependent-specific costs. Same sparse + cumInfl semantics. */
dependentCostByYear?: number[];
```

Deduction: one sibling line in the year loop, immediately after the
mortgage block (after the main income/cost mutation, before the late-pass
event dispatch):

```ts
const householdExtraAnnual = Math.max(0, petCostByYear?.[y] ?? 0)
                           + Math.max(0, dependentCostByYear?.[y] ?? 0);
if (householdExtraAnnual > 0) bal -= householdExtraAnnual * cumInfl;
```

Both absent → no code path executes → byte-identical results for every
legacy caller (verified by a seeded-RNG identity test).

Not applied: per-trial FX/`costShockMult`. Pet costs abroad are arguably
local-currency, but the established precedent for auxiliary lines
(`ltcCostPerYearUSD`, rental, one-time expenses) is USD + cumInfl only.
Documented as a v1 simplification.

### 2. Curve builders (new engine module `household-costs.ts`)

Pure functions, no framework imports, usable by the Angular runner, the API,
and tests. Same file in Angular `src/app/lib/`, API `src/lib/engine/`
(generated), and `shared/engine/`.

```ts
export interface PetForCurve {
  type?: string;              // 'dog' | 'cat' | ... (labeling only in v1)
  birthYear: number;
  expectedLifespan: number;   // years
}
export interface DependentForCurve {
  dependentType?: 'adult' | 'child' | null;
  birthYear: number;
}

export const SENIOR_PET_UPLIFT = 1.25;      // vet costs rise in senior years
export const SENIOR_PET_FRACTION = 0.75;    // senior = last 25% of lifespan
export const DEFAULT_CHILD_SUPPORT_UNTIL_AGE = 22;

export function buildPetCostByYear(pets, opts: {
  years: number;
  simStartYear: number;
  /** Total household pet monthly cost (petCare+petDaycare+petGrooming,
   *  today's USD) for the location active at sim year y. Callers with a
   *  move schedule pass a year-aware lookup; flat callers pass () => T. */
  petMonthlyTotalAtYear: (y: number) => number;
  replacePets?: boolean;      // default false — costs end at expected death
}): number[]

export function buildDependentCostByYear(dependents, opts: {
  years: number;
  simStartYear: number;
  monthlyCostPerDependent: number;   // today's USD
  childSupportUntilAge?: number;     // default 22
}): number[]
```

**Pet semantics.** Each pet's share of the household total is
`petMonthlyTotalAtYear(y) / petCountAtStart` (the location numbers were
curated against the current pet set, so the per-pet share is the total
split evenly). A pet is alive at sim year `y` while
`simStartYear + y < deathCalYear`, where
`deathCalYear = max(birthYear + expectedLifespan, simStartYear + 1)` — a pet
already past its expectancy today still gets at least sim year 0 (it
exists). Age-aware shape: in a pet's senior window (age ≥
`SENIOR_PET_FRACTION × expectedLifespan`) its share is multiplied by
`SENIOR_PET_UPLIFT`. With `replacePets: true`, a pet's base share continues
past death (successor pet) at the non-senior rate. Zero pets → all-zero
curve.

**Dependent semantics.** `dependentType === 'child'` (or null treated as
child): costs run from sim year 0 until the year the child turns
`childSupportUntilAge` (exclusive). `'adult'`: full horizon (v1 — lifelong
support is the conservative default for an adult dependent). Cost is
`monthlyCostPerDependent × 12` per dependent per active year; there is no
per-location dependent category, so the rate is a user-set knob (Angular
default $1,000/mo, in the range of USDA child-cost estimates).

### 3. API

**a. `/api/simulate` (public, stateless):** accepts optional
`petCostByYear` / `dependentCostByYear` (arrays of numbers ≥ 0, length ≤
100, i.e. the `years` cap) and passes them to the kernel. Response `inputs`
echo notes whether curves were supplied.

**b. New authenticated `GET /api/me/household/cost-curves`** — the
server-side populator, so thin clients (the MCP later) get curves without
reimplementing the logic. Query params: `locationId` (required),
`years` (default from household `planningYears`), `simStartYear` (default
household `planningStartYear`), `monthlyCostPerDependent` (default 1000),
`childSupportUntilAge` (default 22), `replacePets` (default false).
Reads household members+pets (Prisma) and the location's `monthlyCosts`
(pet categories), builds both curves via the shared builders, returns

```jsonc
{
  "petCostByYear": [...], "dependentCostByYear": [...],
  "petMonthlyTotal": 640,           // today's $ at that location
  "_units": { ... },                 // per API accessibility conventions
  "_labels": { ... }
}
```

Single-location v1 (no move schedule server-side — the query names one
location; the Angular client builds multi-location curves itself).

**c. Glossary**: add plain-language entries ("Pet cost curve",
"Dependent cost curve") to `/api/glossary` per the project's accessibility
rule that every UI-surfaced term is defined server-side.

### 4. Angular dashboard

- **State** (`MonteCarloStateService`): `petCurveEnabled` (default false),
  `dependentCurveEnabled` (default false), `dependentMonthlyCost` (1000),
  `childSupportUntilAge` (22), `replacePets` (false). All wired into the
  existing `simDirty` tracking. Pets come from the already-loaded
  `household()` profile (GET `/api/me/household` returns `pets`).
- **Runner** (`MonteCarloRunnerService`): when `petCurveEnabled`, build
  `petCostByYear` with a year-aware `petMonthlyTotalAtYear` that resolves
  the active location per sim year from the move schedule (same pattern as
  `buildInheritanceTaxByYear`), and subtract the pet-category total from
  each segment's `nonHealthcareBase`/`baseCost` (new
  `LocationService.petMonthlyTotal(loc)` helper) so the curve replaces the
  flat inclusion. When `dependentCurveEnabled`, build
  `dependentCostByYear` from `household().members` dependents.
- **UI** (`mc-parameters`): a "Pets & dependents" section following the
  existing section pattern — enable toggles, the two dependent knobs, the
  replace-pets toggle, and a plain-language summary line per pet/dependent
  ("Luna (dog, large): costs modeled through 2034") honoring the
  dyslexia/dyscalculia conventions (no bare numbers without units, glossary
  tooltips via the existing help affordances).

### 5. Testing

- **Engine (retirement-api `test:shared`)**: builder unit tests (alive
  windows, senior uplift, replacement, adult vs child dependents, empty
  household); kernel tests — seeded byte-identity when params absent;
  exact deterministic deduction when present (0-return/0-inflation trials);
  inflation scaling; sparse arrays.
- **API (vitest)**: simulate route accepts/validates/applies curves
  (seeded run with vs without curves differs by the expected amount);
  cost-curves route (auth, shapes, defaults, 404 unknown location).
- **Angular**: builder spec (same cases, lib copy); runner spec asserting
  segment baseCost exclusion + curve pass-through; existing suites stay
  green.

## Alternatives considered

- **Model pets/dependents as LifeEvents** (`incomeChange`-style recurring
  deltas): rejected — the kernel's event kinds are point-in-time or
  window-dispatched balance mutations; a per-year cost curve is exactly
  what the sparse-array convention exists for, and the arrays match the
  original React-worker field names the user asked to make real.
- **Per-pet cost lookup by type/weight tier** (e.g. dog-large = $X): the
  data doesn't support it — location pet categories are household totals,
  not per-animal rates. Even-split share is the honest v1.
- **Auto-enable when pets exist**: rejected — silently changing existing
  users' simulation results violates the byte-identity discipline every
  kernel extension here has followed. Opt-in toggle, default off.
