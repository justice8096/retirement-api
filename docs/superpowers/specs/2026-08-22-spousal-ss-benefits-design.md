# Spousal Social Security benefits — design

**Date:** 2026-08-22
**Status:** Draft — awaiting review
**Scope:** retirement-api (shared helpers + one new endpoint + glossary). Dashboard wiring is a
follow-up in `retirement-dashboard-angular` (noted in Consumers, not specced here).

## Problem

Projections understate household income for couples. The household model stores each
member's Social Security profile, and `shared/socialSecurity.js` implements both the
own-benefit claim-age adjustment (`calcSSBenefit`) and the spousal top-up
(`calcSpousalBenefit`) — but **nothing calls either function**. The Assumptions screen's
`ssAnnual` is a hand-typed number, so unless the user manually folds in the spousal
portion (up to 50% of the higher earner's PIA), every simulation and MAGI/ACA calc runs
on a low Social Security figure.

## Current state (verified 2026-08-22)

| Piece | State |
|---|---|
| `HouseholdMember.ssPia/ssFra/ssClaimAge/ssClaimAgeMonths` | Exists per member (roles `primary`/`spouse`), `ssPia` encrypted, validated in `src/routes/household.ts` |
| `calcSSBenefit(pia, fra, claimAge)` | Correct early-reduction/delayed-credit math; **year precision only** — ignores `ssClaimAgeMonths` |
| `calcSpousalBenefit(spousePIA, ownPIA, ownFRA, claimAge)` | Excess-over-own model is right; **reduction formula wrong past 36 months** (see Fix 1) |
| Callers of either function | None (tests + barrel export only) — in api, engine, and dashboard alike |
| `UserFinancialSettings.ssAnnual` | Raw user-typed encrypted amount (Assumptions screen, `feat/persist-income-assumptions`) |
| Engine (`shared/engine/monte-carlo.ts`) | Takes aggregate `monthlyIncome`; no SS awareness except user-supplied survivor overrides |
| Glossary | No entries for PIA, full retirement age, or spousal benefit |

## Decision: where the computation lives

**Chosen — A: server-side steady-state computation endpoint.** A new authenticated
endpoint computes each member's own benefit and spousal top-up from the household
members' stored SS profiles and returns a labeled, unit-annotated breakdown. Clients
(Assumptions screen, MCP) use it to fill `ssAnnual` instead of hand-typing.

Alternatives considered:

- **B: engine timing curves** (`ssIncomeByYear` analogous to `petCostByYear`, so SS
  starts in the right sim year per member). Most accurate, but it changes engine
  params consumed by three clients and belongs with a broader "income timing" pass.
  Deferred; this spec's endpoint is the data source that curve would be built from.
- **C: dashboard-only computation** via `@retirement/shared` imports. No API change,
  but MCP/API callers get nothing, and it violates the project rule that this server
  is the upstream source of every number the user sees.

## Fix 1 — `calcSpousalBenefit` reduction formula (shared/socialSecurity.js)

SSA reduces the spousal excess by **25/36 of 1% per month for the first 36 months**
before FRA and **5/12 of 1% per month beyond that** (35% total at 62 with FRA 67).
Current code applies the 25/36 rate to all months and caps at 30% — wrong for claims
more than 36 months early. Replace the cap with the two-tier formula (mirroring the
structure `calcSSBenefit` already uses for own benefits).

## Fix 2 — month-precision claim ages

Both helpers accept `claimAge` in years; the schema stores `ssClaimAge` +
`ssClaimAgeMonths` (0–11). The math already works for fractional years
(`monthsEarly = (fra - claimAge) * 12`; delayed credits at 8%/yr = 2/3%/mo), so no
signature change: **callers pass `ssClaimAge + ssClaimAgeMonths / 12`** and the JSDoc +
`.d.ts` comments document that fractional years are supported. Add tests pinning a
months-precision case (e.g. 67y4m).

## New endpoint — `GET /api/me/household/ss-benefits`

Auth: JWT (same as the rest of `/api/me/household`). Lives in `src/routes/household.ts`
next to the cost-curves route it patterns after. Read-only; no schema change and no
migration — all inputs already exist.

Semantics:

- Considers members with role `primary` or `spouse` that have `ssPia` and `ssFra` set
  (dependents never accrue spousal benefits here). Missing `ssClaimAge` defaults to FRA.
- Per member: `ownMonthly = calcSSBenefit(pia, fra, claimAgeFractional)`.
- Spousal top-up (only when both members qualify):
  `spousalTopUpMonthly = calcSpousalBenefit(otherPia, ownPia, ownFra, claimAgeFractional)`
  — computed for each member against the other; by construction at most one side is
  non-zero. PIAs (not adjusted benefits) feed the 50% comparison, per SSA rules.
- Steady state, today's dollars: amounts assume both members have reached their claim
  ages. No COLA, no trust-fund cut (`ssCutEnabled`/`ssCutYear`/`ssCola` stay
  scenario-level downstream knobs), no timing curve. Documented in the response notes.

Response shape (worked example, all names final):

```jsonc
{
  "members": [
    {
      "id": "…", "name": "Pat", "role": "primary",
      "ownMonthly": 2400, "spousalTopUpMonthly": 0, "totalMonthly": 2400,
      "claimAge": { "years": 67, "months": 0 }
    },
    {
      "id": "…", "name": "Sam", "role": "spouse",
      "ownMonthly": 760, "spousalTopUpMonthly": 440, "totalMonthly": 1200,
      "claimAge": { "years": 67, "months": 0 }
    }
  ],
  "household": { "totalMonthly": 3600, "totalAnnual": 43200 },
  "plainSummary": "Together your household expects $3,600 per month ($43,200 per year) from Social Security. Sam gets a $440 monthly top-up because half of Pat's benefit is larger than Sam's own.",
  "notes": [
    "Amounts are in today's dollars and assume both of you have started collecting.",
    "The top-up compares each person's basic amount (PIA) before any early or late claiming adjustment."
  ],
  "_units": {
    "members[].ownMonthly":          { "encoding": "amount", "currency": "USD", "periodicity": "month" },
    "members[].spousalTopUpMonthly": { "encoding": "amount", "currency": "USD", "periodicity": "month" },
    "members[].totalMonthly":        { "encoding": "amount", "currency": "USD", "periodicity": "month" },
    "household.totalMonthly":        { "encoding": "amount", "currency": "USD", "periodicity": "month" },
    "household.totalAnnual":         { "encoding": "amount", "currency": "USD", "periodicity": "year" }
  }
}
```

Edge behaviors (all 200s — absence of data is not an error):

- No qualifying members → `members: []`, zeros, `plainSummary` explains what to fill in.
- One qualifying member → own benefit only, `spousalTopUpMonthly: 0`.
- A member with `ssPia` but no `ssFra` is skipped, with a note naming the missing field
  in plain language (mirrors the fieldLabel convention).

`plainSummary` and `notes` are dyscalculia-audit citizens: full sentences, no jargon,
numbers formatted via the request locale (`request.locale` + `Intl.NumberFormat`,
same as existing routes).

## Glossary additions (`src/routes/glossary.ts`)

New terms, each with plain-language definition + worked example:
`primary-insurance-amount` (alias `pia`), `full-retirement-age` (alias `fra`),
`spousal-benefit` (aliases `spousal top-up`, `spouse benefit`), `claim-age`.
`deemed filing` is folded into the spousal-benefit example rather than its own entry.

## Consumers (follow-ups, not in this repo's scope)

- **Dashboard** (`feat/spousal-ss-display`, built 2026-08-22): the Assumptions
  screen's "Use household Social Security" button fills `ssAnnual` with the
  household annual total. Implementation note: the screen computes it locally
  from the **live member draft** via `src/app/lib/ss-benefits.ts` (a mirror of
  `shared/socialSecurity.js` kept in sync by mirrored tests) rather than calling
  the endpoint — so unsaved member edits are included and the button always
  matches the on-screen top-up echoes. The endpoint remains the canonical
  source for non-interactive clients. Manual entry remains possible.
- **retirement-mcp**: can expose the endpoint as a tool with zero extra math.

## Explicitly out of scope

- Survivor benefits (engine `survivorOverrides` stays user-supplied; this endpoint is
  the natural future source for a computed default).
- Ex-spouse (divorced) benefits, the earnings test, restricted applications
  (unavailable to post-1954 births anyway), and WEP/GPO (repealed by the Social
  Security Fairness Act, 2025).
- Engine timing curves (`ssIncomeByYear`) — future work, noted under Decision B.
- Any Prisma schema change or migration — none needed.

## Testing (TDD, red first)

1. `shared/__tests__/socialSecurity.test.js`: failing tests for the two-tier spousal
   reduction (62 vs FRA 67 → 35%), a >36-month intermediate point, and month-precision
   claim ages for both helpers.
2. `src/__tests__/routes-household.test.ts` (or the existing household test file):
   endpoint tests with mocked Prisma + encryption covering the worked example above,
   the three edge behaviors, `_units` envelope shape, and locale-formatted
   `plainSummary`.
3. Glossary test: new terms resolve and the barrel/alias guard passes (pattern from
   `test(cape)` commit `e26876e`).
