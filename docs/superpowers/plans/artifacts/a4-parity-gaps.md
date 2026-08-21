# A4 — React → Angular feature-parity audit

Date: 2026-08-21. Scope: every React tab (`retirement-dashboard/src/tabs/*.tsx`,
40 files) against the Angular screen surface
(`retirement-dashboard-angular/src/app/components/screens/*`, 42 folders), plus
the four explicitly-required deep checks (Neighborhoods map, Monte Carlo
worker pattern, grocery overrides, accessibility parity). Read-only audit —
no code changed. Verdicts are based on reading both sides' source, not file
names alone; where a row says "spot-checked" it means keyword/line-count
comparison plus a partial read, not a full line-by-line diff.

**Excluded by instruction:** `annualAccountFees` (React worker's flat-dollar
Monte Carlo fee deduction). Already queued in Task B2 per `a3-engine-drift.md`
— not re-listed here to avoid double-counting.

## Summary

| Verdict | Count |
|---|---|
| exists | 28 |
| partial | 10 |
| missing | 2 |
| **Total React tabs** | **40** |

(Counts are per individual React tab file. Two table rows below each cover a
pair of React tabs that map to one Angular screen — Roth Conversion +
Roth Planner → `roth-screen`, and Withdrawal + Withdrawal Strategy →
`withdrawal-screen` — so both tabs in each pair carry that row's verdict.)

---

## Parity table

| React tab | Angular screen | Status | Recommend |
|---|---|---|---|
| AssumptionsTab | assumptions-screen | exists | |
| BrochureTab | brochure-screen | exists — both use `window.print()` / `body onload` print-to-PDF, same pattern | |
| CashFlowSankeyTab | sankey-screen | exists (spot-checked) | |
| CellPhonesTab | cellphones-screen (generic `cost-detail` view) | exists | |
| ClimateComparisonTab | climate-screen | exists (spot-checked) | |
| CompareTab | location-compare | exists (spot-checked) | |
| DataExportTab | report-screen | **partial**: React exports raw CSV (`location-costs.csv`, `tax-comparison.csv`, `scenario-projection-*.csv`) via `downloadCSV()`. Angular's `report-screen.component.ts` only builds Markdown narrative text (`downloadText()`, `Blob([...], 'text/markdown')`) explicitly intended "to feed back into video / voiceover generation — not for spreadsheet export" (its own template comment). No CSV/spreadsheet export exists anywhere in Angular. | **port** — CSV export (esp. `location-costs.csv` and `tax-comparison.csv`, which are pure data grids) is low-effort to add and is a real workflow the user may rely on (e.g., feeding a spreadsheet or a financial advisor). |
| EntertainmentTab | entertainment-screen (generic `cost-detail`) | exists | |
| EstatePlanningTab | estate-screen | exists (spot-checked) | |
| FIRECalculatorTab | fire-calc-screen | exists (spot-checked) | |
| FIRESetupTab | fire-setup-screen | exists (spot-checked) | |
| GroceriesTab | groceries-screen (generic `cost-detail`) | **missing** — see "Grocery-override UI" deep check below | **port** (see below) |
| HealthcareComparisonTab | healthcare-compare-screen | exists — read in full; ranks all locations by quality/value/cost, matches React's comparison logic | |
| HousingTab | housing-screen (generic `cost-detail`) | **partial**: React lets the user override the displayed rent figure in place (`setBaseOverride(locId, {...})` in `useAppStore`, `HousingTab.tsx:36-46`), which then feeds every other calculation for that location. Angular's `cost-detail.component.ts` is read-only — no input, no override call, no equivalent to `setBaseOverride` found in `LocationService`. | **port** — small feature (one editable field + a store write), but it changes downstream numbers project-wide, so silently dropping it means a user who previously corrected a location's rent loses that correction after migration. |
| InclusionTab | inclusion-screen | exists (spot-checked) | |
| LocalInfoTab | localinfo-screen | exists (spot-checked) | |
| LocationMapTab | map-screen | exists (spot-checked) | |
| ManageLocationsTab | *(none found)* | **missing** — React's admin location CRUD (`AdminPanel`, `LocationForm`, `BulkOperationsPanel`) drives `/api/admin/locations` (create/update/delete + `/history` version log + `/reindex`). `grep -rn "admin"` and `"customLocation"` over `retirement-dashboard-angular/src/app` and `api.service.ts` returned zero matches — the route isn't called from Angular at all. | **port** — the user is the sole maintainer of the 138+ location dataset (see recent commits like "Recalibrate statewide-anchored ACA records to local rating areas"). Without this screen, editing location data after the React app is archived means either a raw DB/API tool or reverting to the archived app just for data maintenance — worth porting before Phase C archives React. |
| MedicareIRMAATab | medicare-irmaa-screen | exists — read in full; same feature and same tier-lookup mechanics (editable `projectedMAGI`/`filingStatus`, bracket-indexed surcharge lookup), but the **data differs**: React's table (`MedicareIRMAATab.tsx:34-49`) uses stale 2025 figures mislabeled as 2026 — tier-1 threshold $106,000 (single), base Part B premium $185, tier-1 surcharges $74.0/$13.7. Angular's table (`lib/irmaa.ts:24-43`) has the actual 2026 CMS figures (finalized Nov 14, 2025) — threshold $109,000, base Part B $202.90, tier-1 surcharges $81.2/$14.5, with a source citation in the file comment. This is a point in Angular's favor, not a parity gap — no row/recommendation needed. | |
| MedicineTab | medicine-screen | exists (spot-checked) | |
| MonteCarloTab | montecarlo-screen | **partial** — see "Monte Carlo worker pattern" deep check below | **port** (see below) |
| NeighborhoodsTab | neighborhoods-screen | **partial** — see "Neighborhoods map" deep check below | **port** (see below) |
| OverviewTab | location-overview | exists (spot-checked) | |
| PersonalCareTab | personalcare-screen (generic `cost-detail`) | exists | |
| ProjectionsTab | projections-screen | exists (spot-checked) | |
| QualityOfLifeTab | qol-screen | exists (spot-checked) | |
| RothConversionTab + RothPlannerTab | roth-screen | **partial** — React has two features: (1) `RothConversionTab` applies real progressive federal brackets (`FEDERAL_TAX_BRACKETS` 10/12/22/24%) to compute marginal tax on a conversion; (2) `RothPlannerTab` produces a year-by-year table (`ConversionYear[]`: traditionalStart/conversionAmount/taxOnConversion/traditionalEnd) showing the traditional balance draining over time. Angular's single `roth-screen.component.ts` uses one flat user-entered `taxRate` signal and `totalConverted = conversionAmount × yearsToConvert` — no bracket-aware marginal computation, no year-by-year balance table. (Angular's roth-screen does add an LTCG-harvesting advisor that has no React equivalent — a net-new feature, not a gap.) | **port** — the flat-rate simplification understates/overstates tax at bracket boundaries, which matters for a Roth-conversion decision; the year-by-year depletion view is also the main way to sanity-check "will conversions finish before RMDs start." |
| ScenariosTab | scenarios-screen | exists (spot-checked) | |
| ServicesTab | services-screen | exists (spot-checked) | |
| SettingsTab | settings-screen | **partial**: React's `SettingsTab` includes a badges/contributions/tier gamification UI (`BadgeDisplay`, `ContributionList`, `AdminContributions`, `useTier()` → tier/featureUnlocks/isFoundingMember). Angular's `ApiService` already has the client methods wired (`getMyBadges`, `getBadgeCatalog`, `getMyContributions`, `getContributionProgress`, `submitContribution` — `api.service.ts:162-190`), but `grep -rln` for those method names across the whole Angular app (outside `api.service.ts`) returns zero call sites — no screen renders them. | **drop** — this is a single-user retiree-planning tool now, not a multi-tenant SaaS product; the founding-member/contribution/badge gamification layer was aimed at other users. Recommend dropping unless the user still wants their own badge/tier status visible. |
| SpendingGuardrailsTab | guardrails-screen | exists — read in full; both implement real Guyton-Klinger floor/ceiling math (Angular's is arguably more complete: dual floor semantics — static 3% vs. essential-spending dollar floor, take-the-larger) | |
| SSBenefitsTab | ss-screen | **partial**: React lets the user drag independent claim-age sliders per spouse (`hClaimAge`/`wClaimAge` `useState`) and see benefits recomputed live for 62/FRA/70 side-by-side, exploring "what if I claim earlier/later." Angular's `ss-screen.component.ts` only *displays* the benefit computed from whatever `ssClaimAge` is already stored on the household member (set elsewhere, in Assumptions) — no in-screen slider, no side-by-side comparison. The underlying reduction/credit formula is present and consistent in both. | **port** — the interactive "what if" comparison is the main planning value of this tab; a read-only echo of a value set on another screen is a materially smaller tool. |
| TaxesTab | taxes-screen | exists (spot-checked) | |
| TransportationTab | transport-screen (generic `cost-detail`) | exists | |
| VideoTab | video-screen | exists (spot-checked, both small) | |
| VisaResidencyTab | visa-screen | exists (spot-checked) | |
| VisionDentalTab | vision-screen (generic `cost-detail`) | exists | |
| WithdrawalStrategyTab + WithdrawalTab | withdrawal-screen | **partial**: both React tabs are self-contained, editable "what-if" calculators (fed from `useAssumptionsStore`, not the server) — `WithdrawalTab` compares 7 methods (`calcFixedPercentageWithdrawal`, `calcConstantPercentageWithdrawal`, `calcGuardrailsWithdrawal`, `calcVPWWithdrawal`, `calcBucketWithdrawal`, `calcFloorCeilingWithdrawal`, `calcCAPEWithdrawal`) side by side with charts; `WithdrawalStrategyTab` renders a year-by-year strategy-row projection table. Angular's `withdrawal-screen.component.ts` (180 lines) only calls `api.getWithdrawal()` and displays the single persisted strategy's settings — no calculation, no comparison across methods, no editable projection. | **port** — per `a3-engine-drift.md`, the authoritative implementations of all these strategies (including a working `vpw`, plus `bucket`/`floor-ceiling` that the old React worker never even had) already live in `retirement-api/shared/withdrawalStrategies.js`. This is UI work (an interactive comparison screen wired to the existing `calcWithdrawal` dispatcher), not new math — recommend porting rather than dropping given it's the tool the user would reach for before locking in a strategy. |

*(40 React tabs; `test.txt` in the tabs folder is not a component and is excluded from that count.)*

---

## The four required deep checks

### 1. Neighborhoods — Google Maps links + per-neighborhood map pins

**React** (`NeighborhoodsTab.tsx` + `components/neighborhoods/NeighborhoodMap.tsx`):
- Renders a Leaflet map with one pin **per neighborhood** at its own `nh.lat`/`nh.lng`, plus colored region-boundary circles when boundary data is available (`RegionCircle`, `REGION_COLORS`, `CIRCLE_RADIUS_M`).
- Each pin's popup includes an **"Open in Google Maps" link** built by `getGoogleMapsUrl(nh, locId)` (`NeighborhoodMap.tsx:242-247`): prefers an explicit `nh.mapUrl`, falls back to a `google.com/maps/search` query built from `lat,lng`, falls back again to a name+city text query.
- `MapViewController` flies/fits the view to the selection or to all neighborhood points.

**Angular** (`neighborhoods-screen.component.ts`): also uses Leaflet (`import * as L from 'leaflet'`), but `updateMapMarkers()` (lines 135-162) only plots **one marker per selected comparison city**, using `getCityCenter(l.id)` — a city-level coordinate lookup, not per-neighborhood coordinates. There is no per-neighborhood pin, no region-boundary circle, and `grep -n "google"` / `"Maps"` over both the `.ts` and `.html` template returned **zero matches** — no "Open in Google Maps" link anywhere in the neighborhoods screen.

**Verdict: partial.** The city-comparison map exists and works, but the neighborhood-level pin-plotting and the Google Maps deep-link — the two things this check was specifically asked about — are both absent.
**Recommend: port.** Coordinates already exist per-neighborhood in the `NeighborhoodsSupplement` data (React reads `nh.lat`/`nh.lng` from the same API payload Angular already fetches via `getLocationSupplement(locId, 'neighborhoods')`), so this is UI work, not a data gap.

### 2. Monte Carlo — worker vs. main-thread responsiveness pattern

**React**: `useMonteCarloWorker.ts` spawns a real dedicated Web Worker — `new Worker(new URL('../workers/montecarlo.worker.js', import.meta.url), { type: 'module' })` — and the simulation loop runs entirely off the main thread; `onmessage` delivers results back and the worker is `.terminate()`d when done or cancelled.

**Angular**: `monte-carlo-runner.service.ts`'s `run()` method calls `runMonteCarlo(...)` synchronously inside a `setTimeout(() => { ... }, 30)` — the 30ms delay only lets the "Running…" label paint *before* the loop starts; the simulation itself still executes on the main thread and will block the UI (and any other main-thread work, including other browser tabs sharing the event loop only in the same-page sense) for its full duration. There is no `Worker`, `postMessage`, or `.worker.ts` file anywhere under `retirement-dashboard-angular/src/app`.

**Verdict: partial.** Angular gets a working simulation with a correct-looking "Running..." UI cue, but not the actual responsiveness guarantee — a large `runs`/`years` configuration (the canonical kernel is considerably richer than the old worker: life events, LTC, rental income, mortgage, spouse-death/survivor modeling, regime-switching returns) will freeze input, scrolling, and animations for the run's duration, which the React version never did.
**Recommend: port.** Move `runMonteCarlo` invocation into a real Web Worker (Angular supports this natively via the CLI's `ng generate web-worker` scaffolding). This is worth prioritizing precisely because the Angular kernel does more per trial than the old React worker did, making the main-thread freeze worse, not better, than the parity gap suggests at first glance.

### 3. Grocery-override UI

**React** (`GroceriesTab.tsx`): full editable override system — per-item `enabled` toggle, per-item `monthlyCost` override, per-item `quantity` override (`toggleItem`/`setItemCost`/`setItemQty` → `persistOverrides`), a `resetDefaults()` control, and named **saved shopping lists** (`savedLists`, save/load/delete). Overrides sync to the server via `useGrocerySync()` (`/api/me/groceries`, matching the CLAUDE.md route table) with `localStorage` as an offline mirror.

**Angular** (`groceries-screen.component.ts`): 11 lines — `<app-cost-detail costKey="groceries" />`, the same generic read-only category viewer used for cellphones/entertainment/housing/personal-care/transport/vision. `cost-detail.component.ts` (219 lines, read in full) has no input controls, no override state, no save/list mechanism. `grep -n "groceries" retirement-dashboard-angular/src/app/services/api.service.ts` returns **zero matches** — the Angular API client doesn't even have a method for `/api/me/groceries`.

**Verdict: missing.** Not a UI simplification of an existing feature — the entire override/customization capability, including the server sync path, is absent from Angular.
**Recommend: port.** This looked like the single clearest port candidate in the whole audit: the API route already exists and is documented in `retirement-api`'s own CLAUDE.md route table, so Angular is missing only the client-side screen and the `ApiService` methods, not any backend work.

### 4. Accessibility (dyslexia / dyscalculia parity)

The React app's own dyslexia/dyscalculia audits live in `retirement-dashboard/audits/` (not `retirement-api/audits/*-2026-04-16.md` as the plan's Task A4 description assumed — no `2026-04-16`-dated file exists in `retirement-api/audits`; the closest matches there are `2026-04-19`/`2026-04-20`/`2026-05-05` and those cover the **API's** own compliance, a separate surface from the frontend). The relevant frontend-vs-frontend comparison is:

| | React (`retirement-dashboard/audits/`) | Angular (`retirement-dashboard-angular/audits/`) |
|---|---|---|
| Dyslexia | `Dyslexia-Compliance-Audit-...-2026-04-06-REAUDIT.md`: **62%** compliance ("Assistive Tech (TTS): 0% — CRITICAL GAP") | `Dyslexia-Compliance-Audit-...-2026-05-09.md`: **89/100 (B+)**, down from a high of 93 (2026-04-20) as new screens outpaced accommodation coverage |
| Dyscalculia | `Dyscalculia-Compliance-Audit-...-2026-04-06.md`: **45.3% (D+)** | `Dyscalculia-Compliance-Audit-...-2026-05-09.md`: **95/100 (A)** |
| Latest audit date | 2026-04-06 (no further re-audits on record) | 2026-05-09 (4th re-audit, actively maintained) |

Angular's `dyslexia.service.ts` / `dyscalculia.service.ts` plus `components/{accessibility-panel, dyslexia-settings, dyscalculia-settings, read-aloud-button, shortcut-cheatsheet}` implement, and **exceed**, what React shipped — notably Web-Speech-API text-to-speech (read-aloud), which React's own audit flagged as a 0%/critical gap it never closed. Angular's own audit trail documents real remaining gaps (bionic-text dead code, TTS has no pause/resume, some 9px sub-component text, italics on body copy in 19 files) — but these are gaps against Angular's *own* standard, not gaps against React, since React never had these accommodations to begin with.

**Verdict: exists — Angular meets or exceeds React's accessibility coverage.** No row/recommendation needed; this is not a porting gap. (Flagging for the record: the plan's CLAUDE.md pointer to `retirement-api/audits/*-2026-04-16.md` is stale/mis-scoped — worth a correction if that CLAUDE.md line gets touched again, but out of scope for this audit.)

---

## Notes / concerns

- **React's Medicare IRMAA data is stale and mislabeled.** `MedicareIRMAATab.tsx` labels its bracket table "2026 IRMAA brackets" but the figures ($106,000 tier-1 threshold, $185 base Part B, $74.0/$13.7 tier-1 surcharges) are the 2025 numbers — Angular's `lib/irmaa.ts` has the correct, sourced 2026 CMS figures ($109,000 / $202.90 / $81.2 / $14.5). This doesn't affect the parity verdict (both sides implement the same feature), but it's supporting evidence for retiring React sooner rather than later: it is currently serving the user a mislabeled, out-of-date Medicare premium estimate.

## Decisions needed

Mark each row **port** or **drop**. My recommendation is listed; it is input for you to weigh, not a decision already made.

| # | Item | My recommendation | Your call |
|---|---|---|---|
| 1 | Neighborhoods: per-neighborhood map pins + "Open in Google Maps" links | port | ☐ port ☐ drop |
| 2 | Monte Carlo: run simulation in a real Web Worker instead of main-thread `setTimeout` | port | ☐ port ☐ drop |
| 3 | Groceries: per-item override UI (enabled/cost/quantity) + saved shopping lists + `/api/me/groceries` client | port | ☐ port ☐ drop |
| 4 | Data Export: CSV export (location-costs.csv, tax-comparison.csv, scenario-projection.csv) | port | ☐ port ☐ drop |
| 5 | Housing: editable rent override that feeds downstream calculations (`setBaseOverride`) | port | ☐ port ☐ drop |
| 6 | Manage Locations: admin location CRUD + version history + reindex (`/api/admin/locations`) | port | ☐ port ☐ drop |
| 7 | Roth: progressive-bracket marginal tax calc + year-by-year traditional-balance depletion table | port | ☐ port ☐ drop |
| 8 | Settings: badges / contributions / tier gamification UI | drop | ☐ port ☐ drop |
| 9 | Social Security: interactive per-spouse claim-age sliders with live 62/FRA/70 comparison | port | ☐ port ☐ drop |
| 10 | Withdrawal: interactive multi-strategy (fixed/VPW/bucket/floor-ceiling/CAPE/guardrails) comparison calculator + year-by-year projection table | port | ☐ port ☐ drop |

(`annualAccountFees` deliberately excluded — already queued in Task B2 per `a3-engine-drift.md`.)
