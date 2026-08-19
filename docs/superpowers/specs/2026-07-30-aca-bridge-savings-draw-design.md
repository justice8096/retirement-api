# ACA-bridge savings-draw field — design

**Date:** 2026-07-30
**Status:** Approved (design), pre-implementation
**Branch:** `feat/aca-bridge-savings-draw`

## Problem

Pre-Medicare (under-65) retirees who want the ACA premium-tax-credit subsidy
must keep MAGI at/under the 400%-FPL cliff (reinstated for 2026 after the
enhanced-subsidy regime expired 2025-12-31). Any spending above what the
capped MAGI income nets after tax must be funded from **non-MAGI savings**
(Roth withdrawals, return-of-basis, cash). The planner currently exposes no
figure for that required savings draw.

Add a computed, tax-inclusive, per-month field to every location the planner
serves, surfaced through the retirement-planner MCP.

## What it answers

> For a pre-65 household at this location, how many dollars per month of
> spending must come from non-MAGI savings to hold MAGI at the ACA cliff,
> after paying the tax owed on the MAGI income?

## Formula

```
C            = 400%-FPL ceiling         couple (MFJ) 84,600 / single 62,600  (2026)
applicablePct= 0.0996                   2026 reverted top-band premium cap
tax(C)       = calcTaxesForLocation(loc, ss=0, ira=C, invest=0,
                                     { filingStatus, primaryAge:60, spouseAge:60 }).total
               → federal + MD/county state
netAtCeiling = C - tax(C)
subsidizedACANet_month = min( benchmarkSilverMonthly{2Adult|Single},
                              applicablePct * C / 12 )
baseNonHealthcare_month = Σ monthlyCosts[k].typical
                          for k not in { healthcare, healthcarePreMedicare }
S_annual     = 12 * ( baseNonHealthcare_month + subsidizedACANet_month )
draw_annual  = max(0, S_annual - netAtCeiling)
draw_month   = round( draw_annual / 12 )
```

Notes:
- The stored `monthlyCostTotal` is a naive sum of **all** category typicals,
  so it already contains both `healthcare` (Medicare) and
  `healthcarePreMedicare` (unsubsidized ACA). We therefore rebuild the pre-65
  base from categories, excluding **both** healthcare keys, and add back the
  **subsidized** net premium. `medicalOOP` is retained (applies at any age).
- Ceiling income is modeled as **ordinary** (traditional-IRA) income at age
  60 — the conservative/highest-tax case; no OBBBA senior deduction (age<65).
- `applicablePct` is a documented constant for the 2026 reverted schedule.

## Field shape

Injected at the top level of the `GET /api/locations/:id` response, **outside**
`monthlyCosts` so it is never summed into the cost total:

```jsonc
"acaBridgeSavingsDraw": {
  "applicable": true,              // false for non-US locations
  "couple": 1450,                  // $/month, MFJ, ceiling 84,600
  "single": 1980,                  // $/month, single, ceiling 62,600
  "_units": {
    "couple": { "encoding": "amount", "currency": "USD", "periodicity": "month" },
    "single": { "encoding": "amount", "currency": "USD", "periodicity": "month" }
  },
  "_meta": {
    "ceilingCouple": 84600,
    "ceilingSingle": 62600,
    "applicablePct": 0.0996,
    "taxIncluded": true,
    "regime": "2026-post-IRA-cliff",
    "singleBasis": "location household cost basis with single premium + ceiling (what-if)"
  }
}
```

Non-US or missing ACA data → `{ "applicable": false, "couple": 0, "single": 0 }`
(consistent with the existing `healthcare.acaApplicable === false` convention).

## Components / files

1. **`shared/aca-bridge.js`** (new, pure JS, matches `shared/` convention)
   - `US_FPL_400_2026 = { couple: 84600, single: 62600 }`
   - `ACA_APPLICABLE_PCT_2026 = 0.0996`
   - `computeAcaBridgeSavingsDraw(loc, { calcTaxesForLocation })` → field object.
     Dependency-injects the tax fn to keep the module pure and unit-testable.
   - US-gate: returns the non-applicable zero object unless
     `loc.country === 'United States'` **and** `loc.healthcare.acaMarketplace`
     exists.
2. **`shared/__tests__/aca-bridge.test.js`** (new) — unit tests:
   - Glen Burnie golden numbers (couple & single) with a stubbed tax fn.
   - Non-US → `applicable:false`, zeros.
   - US location missing `acaMarketplace` → non-applicable.
   - `benchmark < cap` path (cheap-premium location) uses the benchmark.
   - `draw` floored at 0 when netAtCeiling ≥ S.
3. **`src/routes/locations.ts`** — in the `GET /:id` handler, after the
   existing `acaMarketplace` injection, call the shared fn (importing
   `calcTaxesForLocation` from `shared/taxes.js`) and attach
   `acaBridgeSavingsDraw` to the response object. Additive only.
4. **`retirement-planner-mcp/server.py`** — add `acaBridgeSavingsDraw` to the
   dict returned by `get_location` so it is surfaced through the MCP. Also add
   a one-line mention in the tool docstring.

## Testing

- `npm run test:shared` — new `aca-bridge.test.js` passes.
- `npm test` — a route test asserting the field is present + applicable for
  a US location (e.g. `us-glen-burnie-md`) and `applicable:false` for a
  non-US one (e.g. a Panama id).
- `npm run typecheck` — clean.

## Deployment

- Rebuild + redeploy the API container on rogue (Docker). No DB reseed needed
  — the field is computed in the handler, not stored.
- MCP `server.py` change is picked up on the next MCP host (Claude) restart.

## Out of scope (follow-ups)

- **Stale `premiumCapPctOfIncome: 0.085`** in the seed data encodes the
  expired enhanced-subsidy regime. Flagged for a separate data-correction
  task; this change does not read that field (it uses the documented 2026
  constant instead).
- Re-costing a genuine single-person household budget (this change uses the
  location's couple-oriented cost basis for the single what-if, per approved
  simplification #1).
- Inflation-indexing the FPL ceiling across the bridge horizon.

## Approved simplifications

1. Single figure uses the location's (couple-oriented) cost basis, swapping in
   the single premium and $62,600 ceiling — a "single filer at this cost
   profile" what-if.
2. Ceiling income modeled as ordinary IRA income, age 60 (highest-tax case).
3. `applicablePct` hardcoded to the 2026 reverted ~9.96% constant; stored
   `0.085` treated as stale and left for a follow-up.
