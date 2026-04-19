# Methodology

How the data and projections behind the Retirement API were produced. Targets
the developer, researcher, or dyscalculic reader who wants to understand *why*
a number is what it is before trusting it.

---

## 1. Location seed data

### Scope
88 seed locations under `data/locations/*/location.json`:
- 70 US cities (all 50 states + 10 US territories + 7 Mid-Atlantic suburbs)
- 18 international (France, Spain, Portugal, Costa Rica, Thailand, etc.)

### Cost-of-living numbers (`monthlyCosts.*`)
For each cost category we store `{ min, typical, max, annualInflation }`.

- **`typical`** — median-ish monthly expenditure for a 2-person household
  retiring on a modest-to-comfortable budget. Anchored to one of:
  - Bureau of Labor Statistics CEX (Consumer Expenditure Survey), 65+ quintiles
    for US locations.
  - Numbeo + EU Eurostat + OECD country-level series for international.
  - For specific US metros, cross-checked against the MIT Living Wage
    Calculator and the local Cost-of-Living Index (Council for Community
    and Economic Research).
- **`min` / `max`** — **intentional 1.4–1.7× spread** around `typical` for most
  categories (rent, groceries, transport). Represents the realistic budget
  window a retiree might actually hit, not extreme outliers.
- **Exception: `medicine`** — `max` intentionally runs well above 2× `typical`
  because specialty-drug retail prices are long-tailed. The
  `seed-data-integrity.test.ts` ratio test (`max ≤ 3 × typical`) exempts
  `medicine` explicitly (Dyscalculia F-206). Downstream UIs should render the
  medicine max as "outlier ceiling, not typical range."
- **`annualInflation`** — forward-looking per-category inflation factor,
  bounded `[0, 0.15]`. Healthcare typically 0.05–0.06; housing 0.03–0.035;
  groceries 0.02–0.03; transportation 0.03.

### Tax blocks (`taxes.*`)
US federal brackets are reproduced annually from IRS Revenue Procedures.
State blocks come from each state's Department of Revenue publications.
International brackets come from the source-country tax authority's English
summary plus PwC/Deloitte international tax guides.

### ACA healthcare (`healthcare.acaMarketplace`)
- `benchmarkSilverMonthly2Adult` — pre-subsidy monthly premium for a 60-year-old
  couple at the silver benchmark in the rating area. Sourced from the
  healthcare.gov "see-plans" tool, sampled during the open-enrolment window,
  cross-verified against KFF Marketplace Calculator.
- `premiumCapPctOfIncome` — currently fixed at `0.085` for all US locations
  reflecting the 2026 ACA enhanced regime's 8.5% MAGI cap. US territories
  where the ACA marketplace does not apply carry `0`.
  See ADR 0002 for the regime-selection rationale.
- **County-level estimation** — every US ACA number is a county-level estimate,
  documented in each location's `acaMarketplace.notes` and acknowledged in the
  `disclaimer` field. Accuracy envelope ~±15% vs a real healthcare.gov quote.

### Mid-Atlantic abbreviations
Free-text `notes` / `pros` / `cons` in the 7 Mid-Atlantic locations were
passed through `tools/expand-abbreviations.mjs` to expand regional jargon
(NOVA, VRE, MARC, PG County, BWI, UMBC, UM BWMC, JHU, HOA, Interstate numbers)
on first use (Dyslexia F-012).

### Freshness
No automatic refresh. Data is refreshed manually as `DataRelease` rows with
a semantic version; clients paying for a release get access via the
`UserReleasePurchase` table.

---

## 2. Financial projections (shared/)

### Safe withdrawal rate
Default 4% (the "4% rule" / Trinity study, Cooley-Hubbard-Walz 1998).
Exposed as a decimal fraction on the wire when `Accept-Version: 2` is set,
and as a whole-number percentage under the legacy v1 contract (Dyscalculia
F-202).

### Monte Carlo
`shared/monte-carlo.js` simulates portfolio evolution under:
- Normal-distribution returns (single-regime).
- Two-state bull / bear Markov regime (default since 2026-04-16).

Assumptions:
- Returns: log-normal, mean/volatility user-parameterised.
- Inflation: AR(1) process anchored to the user's `expectedInflation`.
- Withdrawal: static 4% / VPW / guardrails / bucket — user-selected.
- Sequence-of-returns risk is captured natively by the path-level simulation.

Results are stored as a `monte_carlo_v1` sub-schema on `UserScenario.scenarioData`
with required `percentiles`, `successRate`, and optional plain-language
`anchor` / `naturalFrequency` fields (Dyscalculia F-205 synthesises the latter
two on GET when missing).

### CAGR / sequence risk
Defined in `/api/glossary` with both a plain-language and a technical entry
so dyscalculic readers can anchor the concept before reading the formula.

---

## 3. Fairness / bias posture

- **Location coverage bias** — US-heavy (70 of 88), reflecting the primary
  audience. The top 10 international countries by retiree popularity are
  covered; regions like Sub-Saharan Africa are not.
- **Household shape assumptions** — cost-of-living numbers are anchored to a
  2-adult household. Single-retiree and multi-generational households will see
  less accurate totals; the per-cost-category structure still lets a UI scale.
- **Gender in mortality modelling** — the Monte Carlo engine does not
  gender-assume longevity. If longevity curves are introduced later, they
  will be selectable (unisex / actuarial unisex / sex-specific).
- **Accessibility as a first-class data class** — `accessibility.dyslexia`
  and `accessibility.dyscalculia` sub-schemas are reserved on `UserPreferences`
  so every client rendering the API's numbers can honor the user's cognitive
  needs from the first request.

---

## 4. Known limitations

- No automated data-freshness check on seed locations.
- No currency-to-currency drift modelling beyond a flat annual `fxDriftAnnualRate`.
- No state pension / international social-insurance benefit modelling.
- ACA modelling is US-only. Medicare is modelled at the age-65 transition only.

---

## 5. Update cadence

- Tax brackets: January each year, with a migration script per jurisdiction.
- ACA benchmarks: November–December (open enrolment).
- Cost-of-living: quarterly spot-check; major refresh yearly.
- Glossary terms: as new financial terms are introduced to the UI.

---

## 6. References

- Cooley-Hubbard-Walz (1998), *Sustainable Withdrawal Rates From Your
  Retirement Portfolio.* Trinity University.
- Waring & Siegel (2015), *The Only Spending Rule Article You Will Ever Need.*
- U.S. BLS Consumer Expenditure Survey, 65+ age bands.
- KFF Marketplace Calculator (healthcare).
- U.S. Treasury inflation-indexed data for long-run real-return assumptions.
- IRS Revenue Procedures for current-year federal tax brackets.
