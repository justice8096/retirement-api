# Contributing Location Data

**137 of 158 locations** currently ship with only the core `location.json` and
no supplemental data (neighborhoods, livability, local-info). This doc exists
so a contributor can pick any location and fill in the gaps without having to
reverse-engineer the schema from an existing file.

## Quick start

Scaffold empty-but-valid supplement files for one location:

```bash
node tools/scaffold-location-supplements.mjs <location-id>
```

Example: `node tools/scaffold-location-supplements.mjs us-austin`

The scaffolder refuses to overwrite existing files, so it's safe to run on a
location that already has some supplements — it creates only the missing ones.

Then edit the four files described below, commit them, and open a PR.

## The four supplement files

Each location lives at `data/locations/<location-id>/` and may carry up to
four supplement JSONs alongside the required `location.json`:

| File | Purpose | Dashboard screen |
|---|---|---|
| `neighborhoods.json` | Per-area housing / walk scores / character | Community → Neighborhoods |
| `services.json` | Nearby hospitals, pharmacies, groceries, banks, etc. | Community → Local Services |
| `inclusion.json` | Racial / LGBTQ / religious / ability inclusion scores | Community → Livability Index |
| `local-info.json` | Webcams, bloggers, official sites, YouTube channels | Community → Local Info |

The reference exemplar for all four is `data/locations/portugal-lisbon/` —
when in doubt, read how that location expresses a field and follow the
same shape.

## Data-quality conventions

- **Every claim needs a source.** Add a `sources[]` array with `{title,
  url, type?}` next to any factual claim (rent, walk score, legal
  protection, inclusion rating). Sources should be official, research, or
  reputable journalism — not user-generated content alone.
- **Prefer conservative estimates.** This project advises retirement
  decisions with six-figure consequences. Round down for "typical rent",
  pick the lower end of walk-score ranges, flag ambiguity in
  `character_notes`.
- **Date-stamp the authorship.** Every file should carry a `"lastUpdated":
  "YYYY-MM-DD"` at the top level — it's how downstream review knows when
  to re-verify prices.
- **Don't over-fit to your visit.** A trip to Cascais in August isn't a
  four-season sample. Reflect that in the summary.

## `neighborhoods.json`

```json
{
  "city": "City Name",
  "neighborhoods": [
    {
      "id": "unique-slug",
      "name": "Neighborhood Name",
      "description": "One sentence describing the area geographically.",
      "character": "Historic, quiet, student-heavy — comma-separated adjectives.",
      "housing": {
        "avgRentOneBedroomEUR": 900,
        "avgRentTwoBedroomEUR": 1300,
        "buyPricePerSqmEUR": 5500,
        "predominantType": "Renovated apartments in historic buildings"
      },
      "walkabilityScore": 80,
      "transitScore": 72,
      "safetyRating": "moderate-high",
      "expats": { "communitySize": "moderate", "englishPrevalence": "high" },
      "character_notes": "Tram 28 runs through. Street markets on Saturdays.",
      "sources": [
        { "title": "Numbeo Cost of Living Lisbon", "url": "https://www.numbeo.com/cost-of-living/in/Lisbon" }
      ]
    }
  ]
}
```

- Currency suffix in field names (`avgRentOneBedroomEUR`) — use the
  three-letter code matching the location's `currency` in `location.json`.
  For USD locations, suffix with `USD`.
- `walkabilityScore` / `transitScore`: 0–100 ints. Prefer WalkScore / TransitScore
  data where available, otherwise provide your best estimate with a source note.
- `safetyRating`: one of `low | moderate-low | moderate | moderate-high | high`.
- `expats.communitySize`: one of `very-small | small | moderate | large | very-large`.
- `expats.englishPrevalence`: one of `low | moderate | high`.
- **Minimum useful entry count:** 3–4 neighborhoods. Less than 3 offers
  almost no signal for compare-and-pick workflows.

## `services.json`

```json
{
  "distanceUnit": "km",
  "currency": "EUR",
  "services": [
    {
      "categoryId": "hospital",
      "name": "Hospital de Santa Maria (CHULN)",
      "address": "Avenida Professor Egas Moniz, 1649-035 Lisboa",
      "distanceKm": 4,
      "notes": "Largest hospital in Portugal, university teaching hospital, 24/7 emergency",
      "sources": [
        { "title": "CHULN", "url": "https://www.chln.min-saude.pt/" }
      ]
    }
  ]
}
```

Valid `categoryId` values:

| Category | What belongs here |
|---|---|
| `hospital` | General hospitals, emergency rooms, specialty hospitals |
| `pharmacy` | Pharmacies, chemists, dispensaries |
| `grocery` | Supermarkets, farmers markets with reliable weekly hours |
| `bank` | Banks, credit unions, currency-exchange offices |
| `hardware` | Hardware stores, garden centers |
| `vet` | Veterinary clinics |
| `gym` | Gyms, community pools with open-swim hours |
| `shopping` | Shopping malls, department stores |
| `transit` | Train stations, long-distance bus terminals, airports |

Aim for **2–4 entries per category** that are actually near the primary
residential areas — not necessarily the city center.

## `inclusion.json`

Most complex of the four; requires research into the legal environment
+ lived experience across several protected characteristics. See the
Portugal exemplar for the full shape.

Required keys: `country`, `region`, `overallInclusionScore`,
`lastUpdated`, and `categories` containing at minimum `racial`,
`religious`, `lgbtq`, `ability`, and `ageism` subsections.

Each subsection needs:

- `score`: 1–10 integer
- `summary`: 2–3 paragraph plain-language summary of the local reality
- `legalProtections`: the key law names / commissions / protections
- `positiveFactors`: 4–6 bullets
- `riskFactors`: 4–6 bullets (be honest — users will make life-altering
  decisions from this data)
- `sources[]`: official / research / news sources backing the above

## `local-info.json`

Simplest of the four — four arrays of curated external links:

```json
{
  "climate": {
    "type": "Temperate oceanic",
    "avgTemp": { "low": 50, "high": 78 }
  },
  "webcams":        [ { "name": "...", "url": "..." } ],
  "bloggers":       [ { "name": "...", "url": "..." } ],
  "officialSites":  [ { "name": "...", "url": "...", "type": "government" | "tourism" | "expat" } ],
  "youtubeChannels":[ { "name": "...", "url": "..." } ]
}
```

Climate is optional — when omitted, the dashboard falls back to
`location.json.climate` (which is always populated). Include it in
`local-info.json` only when you want to add a prose description (`type`)
that `location.json` doesn't carry.

## PR checklist

- [ ] JSON files validate (`node -e 'JSON.parse(require("fs").readFileSync("path", "utf8"))'`)
- [ ] Every factual claim has at least one entry in `sources[]`
- [ ] `lastUpdated` is set on `inclusion.json` (and any other file where you
      add `lastUpdated`)
- [ ] Committed under one location at a time — a bulk 50-location PR is
      hard to review; prefer separate PRs or separate commits per location
- [ ] No `_meta.status: "stub"` left in — the scaffolder emits this on
      every new file; real PRs remove it when real data lands

## Current gaps

See `audits/location-data-gaps-<date>.md` for the authoritative list. At
the time of this doc's writing:

- **137 of 158 locations** missing `neighborhoods.json`
- **137 of 158** missing `inclusion.json`
- **137 of 158** missing `local-info.json`
- **21 of 158** missing `services.json`

Re-run `node tools/audit-location-data-completeness.mjs` any time to
regenerate the report.
