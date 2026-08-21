# Per-Year Pet & Dependent Cost Curves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `petCostByYear[]` / `dependentCostByYear[]` real: supported by the canonical Monte Carlo kernel, populated from household data (`/api/me/household`) + per-location pet costs, and surfaced in the Angular Monte Carlo screen.

**Architecture:** Two new sparse per-year arrays on `MonteCarloParams` (annual USD, today's $, × cumInfl at deduction — the established auxiliary-line convention) plus a pure builder module `household-costs.ts` shared by all engine copies. The API grows a stateless pass-through on `/api/simulate` and a server-side populator `GET /api/me/household/cost-curves`; the Angular runner builds curves client-side (move-schedule aware) and excludes the pet categories from flat segment baseCost to avoid double-counting. Spec: `docs/superpowers/specs/2026-08-21-pet-dependent-cost-curves-design.md`.

**Tech Stack:** TypeScript, Fastify 5 + Zod, Prisma, vitest, Angular 22 signals.

**Coordination constraints (read first):**
- The `consolidation` branch (main checkout `D:\retirement\retirement-api`) is mid-flight in ANOTHER session: B1 committed, B2's `shared/engine/` output sitting **untracked** in that checkout. Do not touch that checkout's working tree. This plan's repo work happens in the worktree `D:\retirement-api\objective-dijkstra-60a597` on branch `claude/objective-dijkstra-60a597`, rebased onto `consolidation`, adopting the B2 bytes as its base commit so later merges are supersets.
- The Angular repo checkout (`D:\retirement\retirement-dashboard-angular`, branch `feat/persist-income-assumptions`, dirty) is likewise not ours to mutate — Angular work happens in a fresh git worktree + branch `feat/pet-dependent-cost-curves`.
- Pre-consolidation, production imports come from the Angular lib copy and the API's generated `src/lib/engine/` — so the kernel change is applied to the Angular canonical and regenerated into `src/lib/engine` via `tools/sync-engine.mjs` (gaining a `DASH_ROOT` env override), AND to `shared/engine/` (the post-consolidation canonical). Three copies today; consolidation collapses them.

---

## Task R1: Branch setup — adopt consolidation base + B2 engine bytes

**Files:**
- Modify: branch `claude/objective-dijkstra-60a597` (merge `consolidation`)
- Create: `shared/engine/*.ts` (copied byte-for-byte from the main checkout's untracked B2 output)

- [ ] **Step 1: Merge `consolidation` (fast-forward) into this branch**

```bash
cd /d/retirement-api/objective-dijkstra-60a597 && git merge consolidation
```

Expected: fast-forward to 457fa7d.

- [ ] **Step 2: Copy the B2 engine output from the main checkout and verify it is mechanical-only vs the committed generated copy**

```bash
cp -r /d/retirement/retirement-api/shared/engine shared/
for f in monte-carlo rental-income tax-sources aca-constants historical-returns; do
  diff <(tail -n +8 src/lib/engine/$f.ts) <(cat shared/engine/$f.ts) | head -5
done
```

Expected: empty diffs (the B2 copy equals the generated copy minus the 7-line GENERATED banner + `@ts-nocheck`). If not empty, STOP and reconcile before continuing.

- [ ] **Step 3: Commit engine adoption + the design doc**

```bash
git add shared/engine docs/superpowers/specs/2026-08-21-pet-dependent-cost-curves-design.md docs/superpowers/plans/2026-08-21-pet-dependent-cost-curves.md
git commit -m "feat(shared): adopt B2 engine copy into shared/engine + pet/dependent cost-curve design docs

shared/engine bytes are identical to the in-flight consolidation session's
untracked B2 output (verified mechanical-only vs src/lib/engine), so merging
the two branches later resolves as a superset."
```

## Task R2: `household-costs.ts` builders (TDD)

**Files:**
- Create: `shared/engine/household-costs.ts`
- Test: `shared/__tests__/engine/household-costs.test.ts`

- [ ] **Step 1: Write the failing tests** — `shared/__tests__/engine/household-costs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildPetCostByYear, buildDependentCostByYear,
  SENIOR_PET_UPLIFT, PET_COST_CATEGORY_KEYS,
} from '../../engine/household-costs.js';

const flat = (n: number) => () => n;

describe('buildPetCostByYear', () => {
  it('returns all-zero curve for empty pet list', () => {
    expect(buildPetCostByYear([], { years: 5, simStartYear: 2026, petMonthlyTotalAtYear: flat(640) }))
      .toEqual([0, 0, 0, 0, 0]);
  });

  it('runs a pet share while alive, senior-uplifts the last quarter of lifespan, ends at expected death', () => {
    // Dog born 2018, lifespan 12 → death cal year 2030 → alive sim years 0-3.
    // Senior at age ≥ 9 (0.75×12): y0 age 8 base, y1-y3 ages 9-11 uplifted.
    const curve = buildPetCostByYear(
      [{ type: 'dog', birthYear: 2018, expectedLifespan: 12 }],
      { years: 6, simStartYear: 2026, petMonthlyTotalAtYear: flat(640) },
    );
    expect(curve[0]).toBeCloseTo(640 * 12);
    expect(curve[1]).toBeCloseTo(640 * 12 * SENIOR_PET_UPLIFT);
    expect(curve[3]).toBeCloseTo(640 * 12 * SENIOR_PET_UPLIFT);
    expect(curve[4]).toBe(0);
    expect(curve[5]).toBe(0);
  });

  it('replacePets keeps the base share running after death (no senior uplift)', () => {
    const curve = buildPetCostByYear(
      [{ birthYear: 2018, expectedLifespan: 12 }],
      { years: 6, simStartYear: 2026, petMonthlyTotalAtYear: flat(640), replacePets: true },
    );
    expect(curve[4]).toBeCloseTo(640 * 12);
    expect(curve[5]).toBeCloseTo(640 * 12);
  });

  it('a pet already past its expectancy still gets sim year 0, senior-uplifted', () => {
    const curve = buildPetCostByYear(
      [{ birthYear: 2010, expectedLifespan: 12 }],
      { years: 3, simStartYear: 2026, petMonthlyTotalAtYear: flat(400) },
    );
    expect(curve[0]).toBeCloseTo(400 * 12 * SENIOR_PET_UPLIFT);
    expect(curve[1]).toBe(0);
  });

  it('splits the household total evenly across pets and drops each share independently', () => {
    // Pet A dies after y1 (2018+2→2030... born 2026, lifespan 2 → death 2028 → alive y0,y1);
    // Pet B (born 2026, lifespan 10) alive all 4 years, senior from age 7.5 → not in window.
    const curve = buildPetCostByYear(
      [{ birthYear: 2026, expectedLifespan: 2 }, { birthYear: 2026, expectedLifespan: 10 }],
      { years: 4, simStartYear: 2026, petMonthlyTotalAtYear: flat(600) },
    );
    expect(curve[0]).toBeCloseTo(600 * 12);          // both alive (A age 0/2 → senior at ≥1.5? age 0 base; B base)
    expect(curve[2]).toBeCloseTo(300 * 12);          // only B
    expect(curve[3]).toBeCloseTo(300 * 12);
  });

  it('uses the location active at each year via petMonthlyTotalAtYear', () => {
    const curve = buildPetCostByYear(
      [{ birthYear: 2026, expectedLifespan: 20 }],
      { years: 4, simStartYear: 2026, petMonthlyTotalAtYear: (y) => (y < 2 ? 600 : 250) },
    );
    expect(curve[0]).toBeCloseTo(600 * 12);
    expect(curve[2]).toBeCloseTo(250 * 12);
  });

  it('exports the pet cost category keys used to exclude the flat baseCost inclusion', () => {
    expect(PET_COST_CATEGORY_KEYS).toEqual(['petCare', 'petDaycare', 'petGrooming']);
  });
});

describe('buildDependentCostByYear', () => {
  it('child dependents age out the year they turn childSupportUntilAge', () => {
    // Born 2010, untilAge 22 → supported while age < 22 → sim years 0-5 (ages 16-21).
    const curve = buildDependentCostByYear(
      [{ dependentType: 'child', birthYear: 2010 }],
      { years: 8, simStartYear: 2026, monthlyCostPerDependent: 1000 },
    );
    expect(curve[0]).toBe(12000);
    expect(curve[5]).toBe(12000);
    expect(curve[6]).toBe(0);
  });

  it('adult dependents run the whole horizon; null dependentType is treated as child', () => {
    const curve = buildDependentCostByYear(
      [{ dependentType: 'adult', birthYear: 1990 }, { dependentType: null, birthYear: 2010 }],
      { years: 8, simStartYear: 2026, monthlyCostPerDependent: 500 },
    );
    expect(curve[0]).toBe(12000);  // both
    expect(curve[7]).toBe(6000);   // adult only
  });

  it('returns zeros for no dependents or non-positive rate', () => {
    expect(buildDependentCostByYear([], { years: 2, simStartYear: 2026, monthlyCostPerDependent: 1000 }))
      .toEqual([0, 0]);
    expect(buildDependentCostByYear([{ birthYear: 2010 }], { years: 2, simStartYear: 2026, monthlyCostPerDependent: 0 }))
      .toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd shared && npx vitest run __tests__/engine/household-costs.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `shared/engine/household-costs.ts`** (full module code in the design doc §2 shape):

```ts
/**
 * Per-year household cost curves — pets and dependents.
 *
 * Pure builders that turn household composition (pets with lifespans,
 * dependent members with birth years) plus per-location pet cost data into
 * the sparse per-year arrays consumed by the Monte Carlo kernel
 * (`MonteCarloParams.petCostByYear` / `dependentCostByYear`). All amounts
 * are ANNUAL USD in today's dollars — the kernel applies cumulative
 * inflation at deduction time.
 *
 * Design: docs/superpowers/specs/2026-08-21-pet-dependent-cost-curves-design.md
 */

/** The location.json monthlyCosts categories that describe pet costs.
 *  Callers that enable a pet curve must EXCLUDE these from the flat
 *  segment baseCost — the curve replaces them. */
export const PET_COST_CATEGORY_KEYS = ['petCare', 'petDaycare', 'petGrooming'] as const;

/** Vet/care costs rise for senior pets — applied to a pet's share during
 *  its senior window (the last quarter of expected lifespan). */
export const SENIOR_PET_UPLIFT = 1.25;
export const SENIOR_PET_FRACTION = 0.75;

export const DEFAULT_CHILD_SUPPORT_UNTIL_AGE = 22;
export const DEFAULT_DEPENDENT_MONTHLY_COST = 1000;

export interface PetForCurve {
  /** 'dog' | 'cat' | ... — labeling only in v1; costs are an even split. */
  type?: string | null;
  birthYear: number;
  /** Expected lifespan in years. */
  expectedLifespan: number;
}

export interface DependentForCurve {
  /** 'child' dependents age out at childSupportUntilAge; 'adult'
   *  dependents are supported for the whole horizon. null/undefined is
   *  treated as child. */
  dependentType?: string | null;
  birthYear: number;
}

export interface PetCurveOptions {
  years: number;
  simStartYear: number;
  /** Total household pet monthly cost (sum of PET_COST_CATEGORY_KEYS
   *  `typical` values, today's USD) at the location active in sim year y. */
  petMonthlyTotalAtYear: (y: number) => number;
  /** When true, a pet's base share continues after its expected death —
   *  modeling a successor pet (no senior uplift for the successor). */
  replacePets?: boolean;
}

export interface DependentCurveOptions {
  years: number;
  simStartYear: number;
  monthlyCostPerDependent: number;
  childSupportUntilAge?: number;
}

/** Annual USD pet cost per sim year. Even split of the household total
 *  across the pets supplied; each share runs while its pet is alive,
 *  senior-uplifted in the last quarter of expected lifespan, and ends at
 *  expected death (or continues at base rate with replacePets). A pet
 *  already past its expectancy still gets sim year 0 — it exists. */
export function buildPetCostByYear(pets: PetForCurve[], opts: PetCurveOptions): number[] {
  const { years, simStartYear, petMonthlyTotalAtYear } = opts;
  const curve = new Array<number>(Math.max(0, years)).fill(0);
  if (!pets.length) return curve;
  for (let y = 0; y < years; y++) {
    const share = petMonthlyTotalAtYear(y) / pets.length;
    if (!(share > 0)) continue;
    const calYear = simStartYear + y;
    let total = 0;
    for (const pet of pets) {
      if (calYear < pet.birthYear) continue; // not yet born / acquired
      const lifespan = Math.max(1, pet.expectedLifespan);
      const deathCalYear = Math.max(pet.birthYear + lifespan, simStartYear + 1);
      if (calYear < deathCalYear) {
        const age = calYear - pet.birthYear;
        const senior = age >= SENIOR_PET_FRACTION * lifespan;
        total += share * (senior ? SENIOR_PET_UPLIFT : 1);
      } else if (opts.replacePets) {
        total += share;
      }
    }
    curve[y] = total * 12;
  }
  return curve;
}

/** Annual USD dependent cost per sim year. Children age out the year they
 *  turn childSupportUntilAge; adult dependents run the whole horizon. */
export function buildDependentCostByYear(
  dependents: DependentForCurve[],
  opts: DependentCurveOptions,
): number[] {
  const { years, simStartYear, monthlyCostPerDependent } = opts;
  const untilAge = opts.childSupportUntilAge ?? DEFAULT_CHILD_SUPPORT_UNTIL_AGE;
  const curve = new Array<number>(Math.max(0, years)).fill(0);
  if (!dependents.length || !(monthlyCostPerDependent > 0)) return curve;
  for (let y = 0; y < years; y++) {
    const calYear = simStartYear + y;
    let count = 0;
    for (const dep of dependents) {
      if (calYear < dep.birthYear) continue;
      const isAdult = dep.dependentType === 'adult';
      if (isAdult || calYear - dep.birthYear < untilAge) count++;
    }
    curve[y] = count * monthlyCostPerDependent * 12;
  }
  return curve;
}
```

- [ ] **Step 4: Run tests** — same command → PASS.
- [ ] **Step 5: Commit** — `git add shared/engine/household-costs.ts shared/__tests__/engine/household-costs.test.ts && git commit -m "feat(engine): pet/dependent cost-curve builders (household-costs)"`

## Task R3: Kernel curve support (TDD)

**Files:**
- Modify: `shared/engine/monte-carlo.ts` (interface after `medicareMonthlyByYear` ~line 580; year loop after the mortgage block ~line 1442)
- Test: `shared/__tests__/engine/monte-carlo-household-costs.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
import { describe, it, expect } from 'vitest';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '../../engine/monte-carlo.js';

/** Deterministic base: zero vol / zero return / zero income so balance
 *  arithmetic is exact. */
const base = (over: Partial<MonteCarloParams> = {}): MonteCarloParams => ({
  portfolio: 100_000, monthlyIncome: 0, baseCost: 0, isForeign: false,
  fxDrift: 0, runs: 3, years: 3, meanReturn: 0, volReturn: 0,
  meanInflation: 0, volInflation: 0, currVol: 0, incGrowth: 0,
  seededRandom: mulberry32(42), ...over,
});

describe('kernel pet/dependent cost curves', () => {
  it('absent curves === explicit zero curves (dormant path, seeded identity)', () => {
    const a = runMonteCarlo(base());
    const b = runMonteCarlo(base({ petCostByYear: [0, 0, 0], dependentCostByYear: [] }));
    expect(b.results).toEqual(a.results);
    expect(b.paths).toEqual(a.paths);
  });

  it('deducts pet + dependent annual amounts per year', () => {
    const r = runMonteCarlo(base({
      petCostByYear: [1_200, 0, 600],
      dependentCostByYear: [0, 2_400, 0],
    }));
    expect(r.median).toBeCloseTo(100_000 - 1_200 - 2_400 - 600);
    // Path: [100000, 98800, 96400, 95800]
    expect(r.paths[0]).toEqual([100_000, 98_800, 96_400, 95_800]);
  });

  it('scales deductions by accumulated inflation', () => {
    const r = runMonteCarlo(base({
      meanInflation: 0.10,
      petCostByYear: [1_000, 1_000, 1_000],
    }));
    // cumInfl at deduction: y0 ×1, y1 ×1.1, y2 ×1.21 → 3310 total
    expect(r.median).toBeCloseTo(100_000 - 3_310, 6);
  });

  it('ignores negative entries and years beyond the array', () => {
    const r = runMonteCarlo(base({ petCostByYear: [-500], dependentCostByYear: [0, -1] }));
    expect(r.median).toBeCloseTo(100_000);
  });
});
```

- [ ] **Step 2: Run** — `cd shared && npx vitest run __tests__/engine/monte-carlo-household-costs.test.ts` → FAIL (deduction tests; identity test passes trivially).
- [ ] **Step 3: Implement.** Interface fields (after `medicareMonthlyByYear?: (number | undefined)[];`):

```ts
  /**
   * Per-year household pet cost — annual USD in today's dollars, index =
   * sim year. Sparse: missing / undefined / non-positive entries deduct
   * nothing. Inflated by accumulated inflation (cumInfl) at deduction
   * time — USD baseline with NO per-trial FX, same convention as
   * ltcCostPerYearUSD and rental cash flows. Built by `buildPetCostByYear`
   * (household-costs.ts) from household pets (birth year + expected
   * lifespan) and the active location's petCare/petDaycare/petGrooming
   * monthly costs.
   *
   * IMPORTANT: when supplying this, the caller must EXCLUDE the pet cost
   * categories from segment baseCost — the curve replaces the flat
   * inclusion (otherwise pets double-count). Absent → no code path
   * executes (byte-identical legacy behavior).
   */
  petCostByYear?: number[];

  /**
   * Per-year dependent (children / adult dependents) cost — annual USD in
   * today's dollars. Purely additive: the flat baseCost never included
   * dependent-specific costs. Same sparse + cumInfl semantics as
   * petCostByYear. Built by `buildDependentCostByYear`.
   */
  dependentCostByYear?: number[];
```

Year-loop deduction, immediately after the mortgage `if` block and before the late-pass dispatch comment:

```ts
      // Per-year pet / dependent cost curves — annual USD in today's
      // dollars scaled by cumInfl. USD baseline, no per-trial FX (same
      // convention as the LTC / rental lines). Sparse: missing or
      // non-positive entries deduct nothing, so legacy callers (both
      // fields absent) never enter this branch.
      const householdExtraAnnual =
        Math.max(0, p.petCostByYear?.[y] ?? 0) +
        Math.max(0, p.dependentCostByYear?.[y] ?? 0);
      if (householdExtraAnnual > 0) bal -= householdExtraAnnual * cumInfl;
```

- [ ] **Step 4: Run** — engine tests + full `npm run test:shared` → PASS.
- [ ] **Step 5: Commit** — `feat(engine): per-year pet/dependent cost-curve support in the Monte Carlo kernel`

## Task R4: Propagate to the Angular canonical + regenerate `src/lib/engine`

**Files:**
- Create: Angular worktree `D:\retirement\retirement-dashboard-angular\pet-cost-curves-wt` (branch `feat/pet-dependent-cost-curves`)
- Create (Angular wt): `src/app/lib/household-costs.ts` (identical bytes to shared/engine copy — it has no imports to rewrite)
- Modify (Angular wt): `src/app/lib/monte-carlo.ts` (same two hunks as R3)
- Modify (API): `tools/sync-engine.mjs` (DASH_ROOT env override + household-costs FILES entry)
- Regenerate (API): `src/lib/engine/monte-carlo.ts`, create `src/lib/engine/household-costs.ts`

- [ ] **Step 1: Create the Angular worktree**

```bash
cd /d/retirement/retirement-dashboard-angular
git worktree add pet-cost-curves-wt -b feat/pet-dependent-cost-curves
```

- [ ] **Step 2: Copy `household-costs.ts` and apply the two monte-carlo.ts hunks** (identical content; the kernel hunks touch no import lines so no specifier rewrites are involved).
- [ ] **Step 3: sync-engine.mjs** — change `const DASH_ROOT = resolve(API_ROOT, '..', 'retirement-dashboard-angular');` to

```js
const DASH_ROOT = process.env.DASH_ROOT
  ? resolve(process.env.DASH_ROOT)
  : resolve(API_ROOT, '..', 'retirement-dashboard-angular');
```

and add to `FILES`: `[join(SRC_LIB, 'household-costs.ts'), 'household-costs.ts'],`

- [ ] **Step 4: Regenerate and verify**

```bash
cd /d/retirement-api/objective-dijkstra-60a597
DASH_ROOT=/d/retirement/retirement-dashboard-angular/pet-cost-curves-wt node tools/sync-engine.mjs
git diff --stat src/lib/engine
```

Expected: `monte-carlo.ts` gains exactly the two hunks; new `household-costs.ts`; all other files byte-identical. Then `npm run typecheck && npm test` → PASS.

- [ ] **Step 5: Commit (API)** — `feat(api): sync engine with pet/dependent cost curves; DASH_ROOT override for sync-engine`

## Task R5: `/api/simulate` curve pass-through (TDD)

**Files:**
- Modify: `src/routes/simulate.ts`
- Test: `src/__tests__/simulate.test.ts` (append describe block)

- [ ] **Step 1: Failing tests** (follow the file's existing style — check its helpers when appending):

```ts
describe('pet/dependent cost curves', () => {
  it('applies supplied curves to the simulation', async () => {
    const basePayload = {
      portfolio: 100_000, annualSpending: 0, years: 3, runs: 3,
      meanReturn: 0, volReturn: 0, meanInflation: 0, volInflation: 0, seed: 42,
    };
    const without = JSON.parse((await inject(app, 'POST', '/api/simulate', basePayload)).payload);
    const withCurves = JSON.parse((await inject(app, 'POST', '/api/simulate', {
      ...basePayload, petCostByYear: [1200, 0, 600], dependentCostByYear: [0, 2400, 0],
    })).payload);
    expect(without.median).toBe(100_000);
    expect(withCurves.median).toBe(100_000 - 4_200);
    expect(withCurves.inputs.petCurveYears).toBe(3);
    expect(withCurves.inputs.dependentCurveYears).toBe(3);
  });

  it('rejects negative entries and over-long arrays', async () => {
    const bad1 = await inject(app, 'POST', '/api/simulate', {
      portfolio: 1, annualSpending: 1, years: 1, petCostByYear: [-5],
    });
    expect(bad1.statusCode).toBe(400);
    const bad2 = await inject(app, 'POST', '/api/simulate', {
      portfolio: 1, annualSpending: 1, years: 1, petCostByYear: new Array(101).fill(0),
    });
    expect(bad2.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run** → FAIL (unknown key rejected by `.strict()`).
- [ ] **Step 3: Implement.** Schema additions (after `historicalStartYear`):

```ts
    // Per-year household cost curves (annual USD, today's $; index = sim
    // year; sparse — shorter than `years` is fine). Build via
    // GET /api/me/household/cost-curves or lib/engine/household-costs.ts.
    petCostByYear: z.array(num.min(0).max(10_000_000)).max(100).optional(),
    dependentCostByYear: z.array(num.min(0).max(10_000_000)).max(100).optional(),
```

Params: `petCostByYear: i.petCostByYear, dependentCostByYear: i.dependentCostByYear,`. Inputs echo: `petCurveYears: i.petCostByYear?.length ?? 0, dependentCurveYears: i.dependentCostByYear?.length ?? 0,`.

- [ ] **Step 4: Run** `npx vitest run src/__tests__/simulate.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(api): accept pet/dependent cost curves on POST /api/simulate`

## Task R6: `GET /api/me/household/cost-curves` (TDD)

**Files:**
- Modify: `src/routes/household.ts` (new GET, imports), `src/lib/validation.ts` (labels)
- Test: `src/__tests__/routes-household-cost-curves.test.ts`

- [ ] **Step 1: Failing tests** (mock pattern from `routes-financial.test.ts`; mock `prisma.householdProfile.findUnique`, `prisma.adminLocation.findUnique`):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    householdProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    householdMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    householdPet: { deleteMany: vi.fn(), createMany: vi.fn() },
    adminLocation: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'free' };
  }),
}));
vi.mock('../middleware/encryption.js', () => ({
  encryptField: vi.fn((v) => v == null ? null : `ENC:${v}`),
  decryptField: vi.fn((v) => v),
}));

import prisma from '../db/prisma.js';
import householdRoutes from '../routes/household.js';

const household = {
  id: 'hh-1', userId: 'test-user-id', planningStartYear: 2026, planningYears: 10,
  members: [
    { role: 'primary', dependentType: null, birthYear: 1975 },
    { role: 'dependent', dependentType: 'child', birthYear: 2010 },
  ],
  pets: [{ type: 'dog', birthYear: 2018, expectedLifespan: 12 }],
  targetAnnualIncome: null,
};
const location = {
  id: 'us-upper-darby-pa',
  locationData: { monthlyCosts: {
    petCare: { typical: 160 }, petDaycare: { typical: 370 }, petGrooming: { typical: 110 },
    groceries: { typical: 500 },
  } },
};

describe('GET /api/me/household/cost-curves', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(householdRoutes, { prefix: '/api/me/household' });
  });
  afterEach(async () => { await app.close(); vi.restoreAllMocks(); });

  it('builds both curves from household + location data', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(household);
    prisma.adminLocation.findUnique.mockResolvedValue(location);
    const res = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves?locationId=us-upper-darby-pa' });
    const body = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(body.petMonthlyTotal).toBe(640);
    expect(body.years).toBe(10);
    expect(body.simStartYear).toBe(2026);
    expect(body.petCostByYear).toHaveLength(10);
    expect(body.petCostByYear[0]).toBeCloseTo(640 * 12);      // dog age 8, base rate
    expect(body.petCostByYear[1]).toBeCloseTo(640 * 12 * 1.25); // senior
    expect(body.petCostByYear[4]).toBe(0);                     // after expected death (2030)
    expect(body.dependentCostByYear[0]).toBe(12000);           // child age 16
    expect(body.dependentCostByYear[6]).toBe(0);               // child turned 22
    expect(body._units['petCostByYear[]']).toEqual({ encoding: 'amount', currency: 'USD', periodicity: 'year' });
    expect(body._labels.petCostByYear).toBeTruthy();
  });

  it('404s on missing household or unknown location', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(null);
    const r1 = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves?locationId=x' });
    expect(r1.statusCode).toBe(404);
    prisma.householdProfile.findUnique.mockResolvedValue(household);
    prisma.adminLocation.findUnique.mockResolvedValue(null);
    const r2 = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves?locationId=x' });
    expect(r2.statusCode).toBe(404);
  });

  it('400s without locationId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves' });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run** → FAIL (route missing).
- [ ] **Step 3: Implement.** In `src/routes/household.ts` add imports:

```ts
import {
  buildPetCostByYear, buildDependentCostByYear,
  PET_COST_CATEGORY_KEYS, DEFAULT_CHILD_SUPPORT_UNTIL_AGE, DEFAULT_DEPENDENT_MONTHLY_COST,
} from '../lib/engine/household-costs.js';
```

Query schema + handler (registered BEFORE the `app.get('/')` root route for clarity, same preHandler covers it):

```ts
const costCurvesQuerySchema = z.object({
  locationId: z.string().min(1),
  years: z.coerce.number().int().min(1).max(100).optional(),
  simStartYear: z.coerce.number().int().min(2024).max(2100).optional(),
  monthlyCostPerDependent: z.coerce.number().min(0).max(100_000).default(DEFAULT_DEPENDENT_MONTHLY_COST),
  childSupportUntilAge: z.coerce.number().int().min(16).max(30).default(DEFAULT_CHILD_SUPPORT_UNTIL_AGE),
  replacePets: z.coerce.boolean().default(false),
}).strict();

// GET /api/me/household/cost-curves — per-year pet/dependent cost curves
// for the Monte Carlo engine, built server-side from the household's pets
// and dependents plus the named location's pet cost categories. Feed the
// result straight into POST /api/simulate (petCostByYear /
// dependentCostByYear) — and exclude the pet categories from any flat
// spending figure you pass, since the curve replaces them.
app.get('/cost-curves', async (request, reply) => {
  const parsed = costCurvesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(toValidationErrorPayload(parsed.error));
  }
  const q = parsed.data;

  const household = await prisma.householdProfile.findUnique({
    where: { userId: request.userId },
    include: {
      members: { orderBy: { sortOrder: 'asc' } },
      pets: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!household) return reply.code(404).send({ error: 'No household profile yet' });

  const loc = await prisma.adminLocation.findUnique({ where: { id: q.locationId } });
  if (!loc) return reply.code(404).send({ error: 'Location not found' });

  const monthlyCosts = (loc.locationData as {
    monthlyCosts?: Record<string, { typical?: number }>;
  }).monthlyCosts ?? {};
  const petMonthlyTotal = PET_COST_CATEGORY_KEYS
    .reduce((sum, key) => sum + (monthlyCosts[key]?.typical ?? 0), 0);

  const years = q.years ?? household.planningYears;
  const simStartYear = q.simStartYear ?? household.planningStartYear;

  const petCostByYear = buildPetCostByYear(household.pets, {
    years, simStartYear,
    petMonthlyTotalAtYear: () => petMonthlyTotal, // single-location v1
    replacePets: q.replacePets,
  });
  const dependentCostByYear = buildDependentCostByYear(
    household.members.filter((m) => m.role === 'dependent'),
    { years, simStartYear, monthlyCostPerDependent: q.monthlyCostPerDependent, childSupportUntilAge: q.childSupportUntilAge },
  );

  reply.header('Cache-Control', 'private, no-store');
  return {
    locationId: q.locationId,
    years,
    simStartYear,
    petMonthlyTotal,
    petCostByYear,
    dependentCostByYear,
    assumptions: {
      monthlyCostPerDependent: q.monthlyCostPerDependent,
      childSupportUntilAge: q.childSupportUntilAge,
      replacePets: q.replacePets,
      petCostCategories: [...PET_COST_CATEGORY_KEYS],
    },
    _units: {
      'petCostByYear[]': { encoding: 'amount', currency: 'USD', periodicity: 'year' },
      'dependentCostByYear[]': { encoding: 'amount', currency: 'USD', periodicity: 'year' },
      petMonthlyTotal: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
      'assumptions.monthlyCostPerDependent': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
    },
    _labels: getLabelsFor(['petCostByYear', 'dependentCostByYear', 'petMonthlyTotal']),
  };
});
```

Add to the label map in `src/lib/validation.ts` (find `FIELD_LABELS`/equivalent used by `getLabelsFor`):
`petCostByYear: 'Pet costs by year'`, `dependentCostByYear: 'Dependent costs by year'`, `petMonthlyTotal: 'Monthly pet costs at this location'`.

- [ ] **Step 4: Run** new test file + `npx vitest run src/__tests__` → PASS.
- [ ] **Step 5: Commit** — `feat(api): GET /api/me/household/cost-curves — server-side pet/dependent curve builder`

## Task R7: Glossary entries

**Files:**
- Modify: `src/routes/glossary.ts` (follow its existing term-entry shape; verify structure before editing)

- [ ] **Step 1:** Add two terms (adapting exactly to the file's entry shape): **Pet cost curve** — "A year-by-year estimate of what your pets will cost. It follows each pet's age: costs rise in a pet's senior years and stop at the end of its expected lifespan, instead of pretending pet costs run forever." **Dependent cost curve** — "A year-by-year estimate of what your dependents (children or supported adults) will cost. A child's costs stop at the age you choose (usually 22); a supported adult's costs continue."
- [ ] **Step 2:** Run glossary tests if present (`npx vitest run src/__tests__ -t glossary` or full suite) → PASS. Commit — `feat(glossary): pet/dependent cost-curve definitions`

## Task A1: Angular lib specs (worktree from R4)

**Files (all in `pet-cost-curves-wt`):**
- Already present from R4: `src/app/lib/household-costs.ts`, modified `src/app/lib/monte-carlo.ts`
- Test: `src/app/lib/household-costs.spec.ts`, `src/app/lib/monte-carlo-household-costs.spec.ts`

- [ ] **Step 1:** `npm ci` in the worktree. Port the R2 test file as `household-costs.spec.ts` (imports `./household-costs` — bundler resolution, no `.js`) and the R3 kernel test as `monte-carlo-household-costs.spec.ts` (imports `./monte-carlo`), matching the style of `monte-carlo-bootstrap-seed.spec.ts`.
- [ ] **Step 2:** `npx vitest run src/app/lib/household-costs.spec.ts src/app/lib/monte-carlo-household-costs.spec.ts` → PASS.
- [ ] **Step 3:** Commit — `feat(engine): per-year pet/dependent cost curves (kernel + household-costs builders)`

## Task A2: LocationService helper + MC state signals

**Files:**
- Modify: `src/app/services/location.service.ts` (add `petMonthlyTotal`), `src/app/services/monte-carlo-state.service.ts` (signals + `dependents` computed + baseCost exclusion + dirty-effect reads)

- [ ] **Step 1:** `LocationService.petMonthlyTotal` next to `nonHealthcareBaseMonthly`:

```ts
  /** Total monthly pet cost categories (petCare + petDaycare + petGrooming)
   *  for a location, today's USD. Used to exclude pets from the flat
   *  baseCost when the per-year pet cost curve replaces them. */
  petMonthlyTotal(loc: LocationFull): number {
    const costs = loc.monthlyCosts ?? {};
    return PET_COST_CATEGORY_KEYS.reduce((sum, key) => sum + (costs[key]?.typical ?? 0), 0);
  }
```

(import `PET_COST_CATEGORY_KEYS` from `@app/lib/household-costs`; adjust the `costs` index typing to the file's existing pattern.)

- [ ] **Step 2:** State service — new signals near the other scenario toggles, a `dependents` computed next to `adults`, pet exclusion in the `baseCost` computed, and reads added to the dirty effect:

```ts
  /** Dependent members (children / supported adults), in sort order. */
  readonly dependents = computed(() =>
    (this.household()?.members ?? []).filter(m => m.role === 'dependent'));

  // Pets & dependents cost curves (per-year, replaces flat pet categories)
  readonly petCurveEnabled = signal(false);
  readonly replacePets = signal(false);
  readonly dependentCurveEnabled = signal(false);
  readonly dependentMonthlyCost = signal(DEFAULT_DEPENDENT_MONTHLY_COST);
  readonly childSupportUntilAge = signal(DEFAULT_CHILD_SUPPORT_UNTIL_AGE);
```

`baseCost` computed gains `- (this.petCurveEnabled() ? this.loc.petMonthlyTotal(l) : 0)`; dirty effect gains `this.petCurveEnabled(); this.replacePets(); this.dependentCurveEnabled(); this.dependentMonthlyCost(); this.childSupportUntilAge();`.

- [ ] **Step 3:** `npm run build` (or `npx tsc -p tsconfig.json --noEmit` per repo convention) → clean. Commit — `feat(mc): pet/dependent curve state + pet-category exclusion from baseCost`

## Task A3: Runner integration

**Files:**
- Modify: `src/app/services/monte-carlo-runner.service.ts`

- [ ] **Step 1:** Import builders; in `buildSegmentForLocation`, replace the `nonHealthcareBase` line with:

```ts
    // When the pet cost curve is enabled it REPLACES the flat pet
    // categories — exclude them from the segment base so pets aren't
    // double-counted (see household-costs.ts).
    const petExcluded = this.state.petCurveEnabled() ? this.loc.petMonthlyTotal(loc) : 0;
    const nonHealthcareBase = this.loc.nonHealthcareBaseMonthly(loc) - petExcluded;
```

Add a private builder mirroring `buildInheritanceTaxByYear`'s active-location pattern:

```ts
  /** Per-year pet / dependent cost curves (annual USD, today's $) built
   *  from the household profile + the location active at each sim year.
   *  Returns undefined fields when the respective toggle is off or the
   *  household has nothing to model — kernel stays on the dormant path. */
  private buildHouseholdCostCurves(years: number): {
    petCostByYear?: number[]; dependentCostByYear?: number[];
  } {
    const s = this.state;
    const simStartYear = s.household()?.planningStartYear ?? new Date().getFullYear();
    const out: { petCostByYear?: number[]; dependentCostByYear?: number[] } = {};

    if (s.petCurveEnabled()) {
      const pets = s.household()?.pets ?? [];
      const primary = s.selectedLoc();
      if (pets.length && primary) {
        const all = this.loc.fullLocations();
        const moves = s.movesEnabled() ? s.moves() : [];
        const activeAtYear = (y: number): LocationFull => {
          let active: LocationFull = primary;
          for (const m of moves) {
            if (y >= m.fromYear) {
              const loc = all.find(l => l.id === m.locationId);
              if (loc) active = loc;
            }
          }
          return active;
        };
        out.petCostByYear = buildPetCostByYear(pets, {
          years, simStartYear,
          petMonthlyTotalAtYear: (y) => this.loc.petMonthlyTotal(activeAtYear(y)),
          replacePets: s.replacePets(),
        });
      }
    }

    if (s.dependentCurveEnabled()) {
      const dependents = s.dependents();
      if (dependents.length) {
        out.dependentCostByYear = buildDependentCostByYear(dependents, {
          years, simStartYear,
          monthlyCostPerDependent: s.dependentMonthlyCost(),
          childSupportUntilAge: s.childSupportUntilAge(),
        });
      }
    }
    return out;
  }
```

In `run()`, before `runMonteCarlo`: `const householdCurves = this.buildHouseholdCostCurves(s.years());` and in the params object: `petCostByYear: householdCurves.petCostByYear, dependentCostByYear: householdCurves.dependentCostByYear,`.

- [ ] **Step 2:** Build clean; commit — `feat(mc): populate pet/dependent cost curves from household + per-year location data`

## Task A4: Scenarios card UI

**Files:**
- Modify: `src/app/components/screens/montecarlo-screen/mc-scenarios/mc-scenarios.component.html` (new card after the Long-Term Care card), `.ts` (helper computeds), `.scss` only if a new class is needed (reuse `card` / `param` / `death-grid`-style classes)

- [ ] **Step 1:** Card markup following the spouse-death card pattern (`@if` gate, `card-title`, `card-sub` plain-language, toggle + `@if` detail grid). Per-pet plain-language summary lines ("Luna (dog): costs modeled through 2034, senior rates from 2027"). Include hints with units per dyscalculia conventions and `state.dependents()` handling. Concrete markup:

```html
<!-- Pets & dependents cost curves -->
@if ((state.household()?.pets?.length ?? 0) > 0 || state.dependents().length > 0) {
  <div class="card">
    <h3 class="card-title">Pets &amp; Dependents</h3>
    <p class="card-sub">
      Model pet and dependent costs year by year instead of forever. Pet costs
      follow each pet's age — higher in senior years, ending at expected
      lifespan — using this location's pet care, daycare, and grooming costs.
      Dependent costs stop when a child reaches the age you choose.
    </p>

    @if ((state.household()?.pets?.length ?? 0) > 0) {
      <label class="param death-toggle">
        <input type="checkbox" [checked]="state.petCurveEnabled()"
          (change)="state.petCurveEnabled.set(!state.petCurveEnabled())" />
        <span>Model pet costs by age (replaces the flat pet cost line)</span>
      </label>
      @if (state.petCurveEnabled()) {
        <div class="death-grid">
          <label class="param death-toggle">
            <input type="checkbox" [checked]="state.replacePets()"
              (change)="state.replacePets.set(!state.replacePets())" />
            <span>Replace pets when they pass (costs continue)</span>
          </label>
        </div>
        <ul class="param-hint">
          @for (p of petSummaries(); track p.label) { <li>{{ p.label }}</li> }
        </ul>
      }
    }

    @if (state.dependents().length > 0) {
      <label class="param death-toggle">
        <input type="checkbox" [checked]="state.dependentCurveEnabled()"
          (change)="state.dependentCurveEnabled.set(!state.dependentCurveEnabled())" />
        <span>Model dependent costs until they leave the household</span>
      </label>
      @if (state.dependentCurveEnabled()) {
        <div class="death-grid">
          <label class="param">
            <span class="param-label">Cost per Dependent ($/mo)</span>
            <input appNumeric="currency" class="param-input" [class]="dyscalculia.numberSpacingClass()"
              [ngModel]="state.dependentMonthlyCost()" (ngModelChange)="state.dependentMonthlyCost.set($event)" />
            <span class="param-hint">{{ fmt(state.dependentMonthlyCost() * 12, '/yr') }} per dependent</span>
          </label>
          <label class="param">
            <span class="param-label">Support Children Until Age</span>
            <input appNumeric="age" class="param-input" min="16" max="30"
              [ngModel]="state.childSupportUntilAge()" (ngModelChange)="state.childSupportUntilAge.set(+$event)" />
            <span class="param-hint">Adult dependents are supported for the whole plan.</span>
          </label>
        </div>
      }
    }
  </div>
}
```

Component helper:

```ts
  /** Plain-language per-pet summary for the pets card ("Luna (dog): costs
   *  modeled through 2034, senior rates from 2031"). */
  protected readonly petSummaries = computed(() => {
    const start = this.state.household()?.planningStartYear ?? new Date().getFullYear();
    return (this.state.household()?.pets ?? []).map(p => {
      const lifespan = Math.max(1, p.expectedLifespan);
      const death = Math.max(p.birthYear + lifespan, start + 1);
      const seniorFrom = p.birthYear + Math.ceil(SENIOR_PET_FRACTION * lifespan);
      const name = p.name || p.type || 'Pet';
      const senior = seniorFrom < death ? `, senior rates from ${Math.max(seniorFrom, start)}` : '';
      return { label: `${name} (${p.type}): costs modeled through ${death - 1}${senior}` };
    });
  });
```

(import `SENIOR_PET_FRACTION` from `@app/lib/household-costs`; adjust field names to the Angular household model.)

- [ ] **Step 2:** `npm run build` + `npx vitest run` (full Angular suite) → PASS. Commit — `feat(mc): Pets & Dependents scenario card`

## Task F1: Final verification + wrap-up

- [ ] **Step 1:** API worktree: `npm run typecheck && npm test && npm run test:shared` → all PASS.
- [ ] **Step 2:** Angular worktree: `npm run build && npx vitest run` → PASS.
- [ ] **Step 3:** Verification-before-completion pass; update memory (coordination note: two feature branches, merge story vs consolidation); final report to user.
