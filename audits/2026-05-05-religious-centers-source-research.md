# Religious-centers data source research (Todo #14)

**Date**: 2026-05-05
**Author**: Justice (with Claude Opus 4.7 pair-programming)
**Scope**: Evaluate authoritative / comprehensive sources to upgrade `religious_mosque` and `religious_synagogue` placeholders beyond OSM's patchy coverage.

---

## Audit (current state)

Of 158 locations in the dataset:

| Category | Curated | Placeholder | Total |
|---|---|---|---|
| `religious_mosque` | 105 | 53 | 158 |
| `religious_synagogue` | 93 | 65 | 158 |

The 105 + 93 curated entries were populated by the 2026-04-23 OSM Overpass enrichment. The 53 + 65 = **118 placeholders** are locations where OSM's `amenity=place_of_worship` query returned no results within ~30 mi, OR where OSM had results but lacked the specific `religion` tag.

## Source evaluations

### 1. Wikidata SPARQL — REJECTED

Tested via `query.wikidata.org/sparql`:

- Query: all instances/subclasses of `Q32815` (mosque) located in `Q96` (Mexico) → **1 result** (Suraya Mosque)
- Query: all synagogues (`Q34627`) located in `Q750` (Bolivia) → **0 results**

Wikidata coverage is dramatically sparser than OSM for religious buildings outside major historical sites. Not viable as a primary source for this dataset's gap set.

### 2. Salatomatic — REJECTED

Salatomatic ([salatomatic.com](https://salatomatic.com/)) is a global mosque directory with user-submitted entries. Coverage is strong (especially for mosques OSM misses), BUT:

- **No public API.** Only HTML scraping is possible.
- A community Python scraper exists ([SySyAli/mosqueswebscraping](https://github.com/SySyAli/mosqueswebscraping)) for US masjid data, indicating ToS-questionable usage.
- ToS forbids automated scraping; relying on this would create a fragile pipeline + legal exposure.

Could be used for **manual** lookups by a human user, but not as an automated-fill source.

### 3. SynagogueConnect — REJECTED

[SynagogueConnect](https://www.synagogueconnect.org/) is purpose-built for connecting US Jewish college students with synagogue communities for High Holiday services. Not a comprehensive global directory; coverage is US-centric and college-relevant only.

### 4. Domain-specific directories — partial

- **Orthodox Union Synagogue Finder** ([ou.org/synagogue-finder/](https://www.ou.org/synagogue-finder/)) — Orthodox synagogues, US + select international. Sect-specific.
- **Reconstructing Judaism directory** ([reconstructingjudaism.org/directory/](https://www.reconstructingjudaism.org/directory/)) — Reconstructionist congregations only. Sect-specific.
- **USCJ Network** ([uscj.org/network/](https://uscj.org/network/)) — Conservative Judaism congregations. Sect-specific.
- **Find a Church / GCatholic / HinduTemples.net / BuddhaNet** — sect/religion-specific directories.

**Problem**: each is sect-specific. A neutral "is there a synagogue in this city?" lookup that doesn't bias toward any movement requires checking multiple directories. Not practical for automated bulk-fill.

### 5. Yelp Fusion API — partial

The OSM enrichment script already wires Yelp categories (`religiousorgs`, `mosques`, `synagogues`, etc.) when `YELP_API_KEY` is set. Coverage is best for US/UK; weak elsewhere. Yelp could be a useful supplementary source for the US gap subset, but won't help with most foreign locations in this dataset.

### 6. WebSearch / Google Maps top-rated — RECOMMENDED

Per-location Google search returns the most prominent mosque or synagogue with reviews. Same pattern that worked for restaurant curation in [retirement-api PR #112](https://github.com/justice8096/retirement-api/pull/112) (Todo #18).

**Strengths**:
- Works globally
- Top results are typically the most-reviewed = most-prominent buildings
- Can distinguish "no result within radius" cleanly (honest no-match)

**Weaknesses**:
- One search per location-cuisine pair → ~118 search calls for full sweep
- **Cannot reliably classify denomination/sect** — the todo's stated risk (mis-labeling Sufi-as-Sunni or Reform-as-Orthodox)

## Mitigation: denomination verification disclaimer

The todo's stated risk model — "mis-labeling a Sufi mosque as Sunni or a Reform temple as Orthodox is worse than having no entry" — is real. The mitigation that lets us ship something useful without risking that error:

> **Don't classify the sect/denomination.** Pick the most prominent named religious center per location, populate `name` + `sources` from the verified search result, and add a note in `notes` explicitly directing the user to verify denomination/sect for personal religious practice.

Sample template for curated entries:

```json
{
  "categoryId": "religious_mosque",
  "name": "Mezquita As-Salam (Mérida)",
  "distanceMi": 30,
  "notes": "Most prominent named mosque within ~30 mi. Sourced from [SOURCE]. Verify denomination/sect (Sunni / Shia / Sufi / Ahmadi etc.) for personal religious requirements before relying on it.",
  "sources": [{ "title": "...", "url": "...", "accessed": "2026-05-05" }]
}
```

For locations with no mosque/synagogue within 30 mi (rural Panama, small Pacific territories, etc.), keep the original Google Maps search-link source and update `notes` to be honest about the absence (mirrors #18 pattern).

## Confidence flags (deferred)

The todo proposed adding a `confidence` flag to each entry. Rather than introduce a new schema field, the **disclaimer text in `notes`** serves the same function: any reader of the data is alerted that denomination is not verified.

If a future refactor wants structured confidence:

```typescript
interface Service {
  // existing fields...
  confidence?: 'verified' | 'unverified-denomination' | 'closest-only';
}
```

But that's out of scope for #14's primary deliverable.

## Recommendation

1. **Ship**: WebSearch-based curation for the 118 placeholders, similar pattern to [#18 / api PR #112](https://github.com/justice8096/retirement-api/pull/112).
2. **Disclaimer**: every curated entry's `notes` directs the user to verify denomination/sect before relying on it.
3. **Honest no-match**: locations where no mosque/synagogue exists within ~30 mi keep the Google Maps fallback source with updated `notes` (no Wikidata or Salatomatic auto-fill).
4. **Defer**: structured `confidence` field, sect-specific directory cross-referencing, Yelp augmentation for US subset.

## Open follow-ups (future work)

- **Yelp augmentation for US locations**: when `YELP_API_KEY` is set, run `religiousorgs` + `mosques` + `synagogues` category queries against the US gap subset for cross-reference.
- **Manual user-verification flow**: a UI affordance for retirees to confirm the denomination of their preferred religious center, persisted to user preferences. Out of scope for the seed dataset.
