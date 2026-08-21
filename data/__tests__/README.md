# data/__tests__/

Data-validation suites adopted from the retirement-dashboard React repo
(now archived) as part of consolidation task C1. They validate the shape
and completeness of the canonical location data in `data/locations/` —
not application code — so they live next to the data they check rather
than in `src/__tests__/`.

## This is an audit, not a gate

These suites are **not** part of the default `npm test` run. They're
wired into `npm run test:data` (structural checks) and
`npm run test:data:links` (live link probe) instead — see
`vitest.data.config.ts` at the repo root, which is a separate Vitest
config from the root `vitest.config.ts` that `npm test` uses.

Why: pointing the ported suites at canonical data (rather than the React
repo's `public/data/locations` mirror they were written against) surfaces
real, pre-existing content-authoring gaps across `data/locations/`. Fixing
them means writing real grocery/vision-dental/personal-care content for
dozens of locations — work nobody has scheduled yet. Making that backlog
fail CI on every unrelated PR would block the whole team, so these run
on demand as an audit instead.

## Suites

| File | Checks |
|------|--------|
| `groceryData.test.ts` | Every location has all 9 grocery categories, each with named items and a numeric `monthlyCost`. |
| `housingData.test.ts` | Every location has a well-formed `housing` block (propertyType, budget, breakdown). |
| `localInfoData.test.ts` | Where `local-info.json` exists, its entries are well-formed (coverage itself is optional). |
| `localInfoLinks.test.ts` | Live-fetches every URL in every `local-info.json`; fails only on confirmed HTTP 404s. Slow (~3 min, hits the network) — run separately via `test:data:links`. |
| `personalCareData.test.ts` | Every location's `personalCare` block has at least one valid category (US or LatAm/international schema). |
| `supplementData.test.ts` | Every location's `detailed-costs.json` has all 10 required top-level sections. |

## Known gaps (as of the C1 audit, 2026-08-21)

Run once against canonical data and verified identical against the React
repo's mirror, i.e. pre-existing rather than introduced by this port:

- **Grocery categories** — ~140/162 locations are missing 4 of the 9
  required categories (grains/snacks/frozen/supplements); 42 of those are
  also missing proteins. Needs real item/price content, not a mechanical
  fix.
- **`visionDental` section missing** on 25 locations (includes
  `us-upper-darby-pa`). Same — needs real provider/pricing content.
- **Three location.json-only stubs** — `us-chester-pa`, `us-norristown-pa`,
  `panama-dolega` have no `detailed-costs.json`/`local-info.json`/etc. at
  all. Full-file authoring, out of scope for a data-integrity pass.
- **35 confirmed dead (404) links** across ~28 locations' `local-info.json`
  files. See the overlap note below before touching these.

None of the above were fixed as part of adopting these suites — they're
tracked here so the next content pass has a starting list instead of
having to re-run the audit cold.

## Overlap with `scripts/probe-local-info-sites.mjs`

Many `local-info.json` entries already carry `linkStatus` /
`linkHttpStatus` / `linkCheckedAt` metadata written by
`scripts/probe-local-info-sites.mjs` — a soft, non-blocking link-health
annotation pipeline that already exists in this repo. `localInfoLinks.test.ts`
duplicates that check as a hard test failure instead. Before spending time
reconciling the 404 list above, decide whether `localInfoLinks.test.ts`
should defer to the existing `linkStatus` field (and just assert it's kept
fresh) rather than re-probing every run — running both is redundant work
against the same external sites.
