# A3 — Engine drift audit across the four Monte Carlo engine copies

Date: 2026-08-21. Scope: diff every copy of the Monte Carlo engine (and its
supporting files) against the Angular canonical, classify each difference as
mechanical (produced by `tools/sync-engine.mjs`) or real drift, and produce
B2's work queue. Read-only audit — no engine code was modified.

## Summary table

| Copy | Files compared | Mechanical-only? | Real drift items |
|---|---|---|---|
| (2) `retirement-api/src/lib/engine/*` (generated) | `monte-carlo.ts`, `rental-income.ts`, `tax-sources.ts`, `aca-constants.ts`, `historical-returns.ts` | **Yes** — every hunk matches `sync-engine.mjs`'s `REWRITES` array exactly | 0 |
| (3) monorepo `commercialRetirementProject/packages/shared` vs `retirement-api/shared` | file-list + `diff -qr` | N/A — monorepo side is **empty** | 0 (nothing to port; nothing to lose) |
| (4) React worker `retirement-dashboard/src/workers/montecarlo.worker.ts` | embedded standalone kernel vs Angular `lib/monte-carlo.ts` | No — not a generated copy at all, a hand-rolled reimplementation | 1 real gap (`port-into-canonical`), 4 items confirmed non-issues (dead code / superseded) |

**Bottom line: copies (2) and (3) are clean — Task B2 Step 3 has a no-op for
those two.** Copy (4), the React worker, contributes exactly one actionable
item — see the single-item work queue at the end.

---

## Step 1 — Angular canonical vs `retirement-api/src/lib/engine` (generated copy)

Read `retirement-api/tools/sync-engine.mjs` first. Its `REWRITES` array
(lines 40-46) defines the *only* mechanical transformations expected:

```js
[/(['"])\.\.\/data\/historical-returns\1/g, "'./historical-returns.js'"],
[/(['"])\.\/rental-income\1/g, "'./rental-income.js'"],
[/(['"])\.\/tax-sources\1/g, "'./tax-sources.js'"],
[/(['"])\.\/aca-constants\1/g, "'./aca-constants.js'"],
[/(['"])@models\/api\.model\1/g, "'./types.js'"],
```

Plus a `GENERATED FILE — DO NOT EDIT` banner + `// @ts-nocheck` prepended to
every output file (script lines 52-59). `types.ts` is not diffed — it's not
copied from the dashboard at all; it's a small locally-authored shim
(`Source`/`TaxBracket` interfaces, script lines 62-76) standing in for
`@models/api.model`.

Ran `git diff --no-index --stat` for all five files, then the full
(non-`--stat`) diff for each since every pair showed a nonzero stat:

| File | Diff | Verdict |
|---|---|---|
| `monte-carlo.ts` | +11/-4: GENERATED header + `@ts-nocheck`, 4 import rewrites (`../data/historical-returns` → `./historical-returns.js`, `./rental-income` → `./rental-income.js`, `./tax-sources` → `./tax-sources.js`, `./aca-constants` → `./aca-constants.js`) | **canonical-wins** (mechanical only) |
| `rental-income.ts` | +8/-1: header + 1 import rewrite (`./tax-sources` → `./tax-sources.js`) | **canonical-wins** (mechanical only) |
| `tax-sources.ts` | +8/-1: header + `@models/api.model` → `./types.js` | **canonical-wins** (mechanical only) |
| `aca-constants.ts` | +8/-1: header + `@models/api.model` → `./types.js` | **canonical-wins** (mechanical only) |
| `historical-returns.ts` | +7/-0: header only, no import rewrites needed (no relative imports in this file) | **canonical-wins** (mechanical only) |

Every hunk in all five diffs is accounted for by the `REWRITES` array and the
`HEADER`/`@ts-nocheck` stamp. **No real drift.** The generated copy is exactly
what `sync-engine.mjs` promises to produce, byte-for-byte apart from the
documented mechanical transform. Re-running `npm run engine:sync` today would
be a no-op (no diff).

## Step 1b — monorepo `packages/shared` vs `retirement-api/shared`

`commercialRetirementProject/packages/shared` is **completely empty** — `ls
-la` and `find ... -type f` both return zero entries, zero subdirectories.
There is nothing in it to diff, nothing newer, nothing unique. The `diff -qr`
run for the task's Step 1 command produced 27 "Only in retirement-api/shared"
lines (every file `retirement-api/shared` has, since the monorepo side has
none) and, correspondingly, an empty listing on the "Only in
commercialRetirementProject/packages/shared" side (there are no such files to
list).

**Verdict: canonical-wins / non-issue.** Nothing needs porting from the
monorepo shared package — there is no content to lose when it's archived.
This also confirms `retirement-api/shared` (`@retirement/shared`) is
self-sufficient as the one taxes/RMD/FIRE/withdrawal helper library; it did
not originate from, and has no unmerged sibling in, the monorepo copy.

---

## Step 2 — React worker (`retirement-dashboard/src/workers/montecarlo.worker.ts`)

`grep -n "import|from"` on the worker returned **zero matches** — confirmed
by reading the full 219-line file. **The worker embeds its own standalone
math; it does not import any `lib/` copy.** It is not one of `sync-engine.mjs`'s
outputs and never was — it's an independent, hand-rolled reimplementation
that predates the segment/life-events model in the Angular canonical
(`retirement-dashboard-angular/src/app/lib/monte-carlo.ts`, 1827 lines vs the
worker's 219).

Because the worker is not a generated copy, "mechanical vs real" doesn't
apply the same way — instead I compared feature-by-feature against the
canonical kernel and, critically, checked whether the React app's UI (the
worker's only caller) actually *exercises* each worker-only field before
calling it real drift. Two type definitions matter here and they disagree
with each other:

- The worker's own `MonteCarloInput`/`MonteCarloOutput` interfaces
  (`montecarlo.worker.ts:4-57`) declare the full field set below.
- The calling code's interfaces, `useMonteCarloWorker.ts:3-35`, are
  **narrower** — this is the type that actually gates what
  `MonteCarloTab.tsx` can send/read via `worker.postMessage`/`onmessage`.

Grepped every worker-only field across `retirement-dashboard/src` to find
which UI tabs reference it, then checked whether those tabs actually call
`useMonteCarloWorker` or do independent math.

### Confirmed non-issues (no porting needed)

1. **`withdrawalStrategy` / `withdrawalRate` / `guardrailCeiling` /
   `guardrailFloor` / `guardrailAdjustment` / `spendingModel` /
   `spendingDeclineRate` / `annualSavings` / `savingsYears`** — declared in
   the worker's own `MonteCarloInput` (worker lines 24-39) but **absent from
   `useMonteCarloWorker.ts`'s `MonteCarloInput`** (lines 3-24), which is the
   type the only production call site (`MonteCarloTab.tsx`) actually
   satisfies. Confirmed dead by tracing the tabs that mention these terms:
   `WithdrawalTab.tsx` and `SpendingGuardrailsTab.tsx` both import
   `applySpendingModel` from `@retirement/shared/spendingModels` directly and
   never call `useMonteCarloWorker` — they do their own client-side math,
   bypassing the worker entirely. `FIRECalculatorTab.tsx` similarly computes
   FIRE numbers with closed-form future-value formulas
   (`FIRECalculatorTab.tsx:42-99`), never touching the worker. **The worker's
   `'vpw'` string in its `withdrawalStrategy` union type isn't even handled in
   its own switch statement** (falls through to the `else` / spend-need
   branch) — so this whole cluster of fields is vestigial code inside a file
   that's already dead weight. Nothing to port; the actually-current
   implementation of these withdrawal strategies (including a **working**
   `vpw` case) lives in `retirement-api/shared/withdrawalStrategies.js`
   (`calcWithdrawal` dispatcher, lines 331-363), which is more complete than
   the worker's broken version ever was (also has `bucket` and
   `floor-ceiling` strategies the worker never had).
2. **`shortTermRate` / `annualSurplusToShortTerm` / `annualSurplusToPortfolio`**
   — declared and actually passed through by `useMonteCarloWorker.ts`
   (confirmed live via `SurplusAllocationCard.tsx` reading
   `useAssumptionsStore` for `shortTermBalance`/`shortTermRate`), but **inside
   the worker's own loop, only `shortTermBalance` is read** (worker line 100:
   `let stBal = shortTermBalance ?? 0`) — it's added once and never
   grown by `shortTermRate`, and `annualSurplusToShortTerm` /
   `annualSurplusToPortfolio` are destructured (worker line 89) and then
   **never referenced again in the function body**. This is a bug in the
   worker itself (accepts three params that do nothing), not a feature to
   port — porting it would mean porting a no-op.
3. **`avgEffectiveRate` / `incomeVolatility` / `worstYearIncome` /
   `avgIncome`** — computed by the worker (lines 191-206) and put on its
   output (lines 208-211), but `useMonteCarloWorker.ts`'s `MonteCarloOutput`
   (lines 26-35) doesn't declare them, and a repo-wide grep for all four
   names outside the worker file found no reader (the one `avgIncome` hit,
   in `VisaResidencyTab.tsx:50`, is an unrelated local variable in a
   visa-requirements calculator, not this output). Dead output; nothing
   consumes it. **`fireSuccessRate` is a separate, narrower case**: it's
   declared on the worker's own `MonteCarloOutput` interface (worker line
   56) but is never computed anywhere in the function body and never
   appears in the output object literal at lines 208-211 — it's a type-level
   field with no producing code at all, not merely an unread one.
4. **`petCostByYear[y]` / `dependentCostByYear[y]`** — declared on both the
   worker's own `MonteCarloInput` (worker lines 20, 22) and
   `useMonteCarloWorker.ts`'s `MonteCarloInput` (lines 18-19), and read
   inside the worker's loop (worker lines 115-116: `petCostByYear?.[y] ?? 0`
   folded into `annualExpense`). But re-checked the sole call site,
   `MonteCarloTab.tsx`'s `handleRun()` (`run({...})` around lines 86-109) —
   it never sets either field, and a repo-wide grep for `useMonteCarloWorker`
   turns up no other caller. So despite being wired all the way through the
   type chain and into the loop body, **no code path ever populates these
   arrays** — functionally dead, same as items 1-3 above, not a live feature.

### Real drift — needs a verdict

**`annualAccountFees`** (worker line 91: `bal -= acctFees` once per
   sim-year, flat dollar deduction) — **wired and live**: present in both the
   worker's and `useMonteCarloWorker.ts`'s `MonteCarloInput`. Grepped the
   Angular canonical for any equivalent (`annualAccountFees`, `acctFee`,
   `brokerageFee`) — **zero matches** in `monte-carlo.ts` or
   `monte-carlo-runner.service.ts`. Separately, `retirement-api/src/routes/fees.ts`
   and `retirement-dashboard-angular/src/app/models/financial.model.ts` /
   `fees-screen.component.ts` define a **richer** settings model
   (`brokerageFeePct`, `brokerageFeeFlat`, `brokerageAnnualFee`) — but a
   repo-wide grep for those three field names against
   `monte-carlo-runner.service.ts` (the only file that constructs
   `MonteCarloParams` and calls `runMonteCarlo`) found **no hits**. So: the
   canonical persists richer fee settings than the worker ever had, but as
   far as I can trace, **nothing in the current simulation pipeline actually
   applies any brokerage fee to the trial math** — the settings are stored
   but not consumed. The worker's crude flat-fee deduction is the *only*
   place, across all four copies, where a fee actually reduces the simulated
   balance.
   **Verdict: `port-into-canonical`.** Not because the worker's model is
   sophisticated (it isn't — flat annual dollar amount, no distinction
   between percentage-of-AUM and per-trade flat fee), but because the
   canonical kernel currently applies *no* account fee at all despite storing
   fee settings meant to feed exactly this. At minimum, the canonical kernel
   needs a fee-deduction line before this consolidation is complete, using
   the existing `brokerageFeePct`/`brokerageFeeFlat` settings as the input
   shape rather than reintroducing the worker's flatter `annualAccountFees`.

This is the only real-drift item from the worker. `petCostByYear`/
`dependentCostByYear` looked like a second candidate on first pass (wired
through both type interfaces and read inside the loop), but tracing the sole
caller showed it's never actually populated — moved to the confirmed
non-issues bucket above (item 4).

---

## Work queue for B2 Step 3

1. **`port-into-canonical` — account fees.** The canonical Monte Carlo kernel
   (`retirement-dashboard-angular/src/app/lib/monte-carlo.ts`) applies no
   brokerage/account fee to the simulated balance at all, despite
   `retirement-api/src/routes/fees.ts` and the Angular fees-screen already
   persisting `brokerageFeePct` / `brokerageFeeFlat` / `brokerageAnnualFee`
   settings for exactly this purpose. Add a fee-deduction step to the kernel
   (percentage-of-balance and/or flat-dollar, matching the existing settings
   shape) before the four-copy consolidation is considered feature-complete.
   The worker's `annualAccountFees` (flat-only) is not worth porting verbatim
   — build against the richer existing settings model instead.

That is the entire work queue — a single item. Everything else checked in
Step 2 (withdrawal strategies/guardrails/spending models/FIRE savings phase,
the short-term vehicle fields, the income-volatility output metrics
including `fireSuccessRate`, and `petCostByYear`/`dependentCostByYear`) is
dead code in the worker itself — declared and in some cases even read inside
the loop, but never populated or consumed by any current caller — so there
is nothing there to port.

Copies (2) (generated `src/lib/engine`) and (3) (monorepo shared, which is
empty) have **zero real drift** — for those two, Task B2 Step 3 is a no-op.
