# ADR 0002 — ACA subsidy regime: enhanced (flat 8.5% MAGI cap, no cliff)

**Status:** Accepted — 2026-04-15. Superseded in dashboard UI per user memory
`aca-subsidy-regime.md` (2026-04-19) — dashboard toggles cliff/enhanced; API
models both via `premiumCapPctOfIncome: 0 | 0.085`.
**Decision owner:** @justice8096

## Context
The ACA marketplace has two possible subsidy regimes in the modelling window:
- **Cliff** — pre-2021, returning for 2026: sliding 2.07–9.83% contribution
  rate up to 400% FPL; hard cliff with no subsidy above 400%.
- **Enhanced (ARPA/IRA)** — 2021–2025: flat 8.5% MAGI cap, no cliff.

The seed data ships fixed values for `premiumCapPctOfIncome` per location.
The API cannot represent both regimes in a single scalar field.

## Decision
The **seed value** is always the regime's "characteristic" cap:
- `0.085` — enhanced regime applies (50 states + DC).
- `0` — ACA does not apply (US territories).

The **dashboard UI** lets the user toggle between cliff and enhanced rules
at render time. The API stores only the seed-characteristic value; the
dashboard's `HealthcareService` computes the actual MAGI-based contribution
given the toggled regime.

## Consequences
- Seed-data integrity test (`seed-data-integrity.test.ts:323-326`) enforces
  `premiumCapPctOfIncome ∈ {0, 0.085}` — catches accidental edits.
- The `_units` block injected by `locations.ts` on `acaMarketplace`
  documents `encoding: 'fraction'` + `regime: 'aca_enhanced_post_2021'` so
  dyscalculic consumers don't guess.
- Non-US locations carry `healthcare.acaApplicable: false` (Dyscalculia F-208).
- Future: if Congress extends enhanced rules past 2025 permanently, no API
  change is required — only the user-memory note flips. If the cliff regime
  becomes the single model, update `DECISION` to track the sliding cap as a
  computed function of MAGI rather than a seed scalar.

## References
- User memory: `aca-subsidy-regime.md`.
- `src/__tests__/seed-data-integrity.test.ts:323-326`.
- `src/routes/locations.ts` `_units` injection.
