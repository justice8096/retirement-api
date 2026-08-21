# Firecrawl source integration (cost-of-living agents)

`firecrawl-source.js` grounds the agents in **real scraped prices** (via the self-hosted Firecrawl
on rogue) instead of the LLM's stale training knowledge. Built + verified 2026-07-08.

## What it gives you
- `scrapeMarkdown(url)` → `{ source, title, markdown }` (clean, main-content). Throws on block/empty.
- `extractStructured(url, prompt)` → structured JSON via Firecrawl `/extract` (HF Pro gpt-oss-120b).
- `numbeoCostOfLiving(city)` → the city's Numbeo cost-of-living page as clean markdown.
- `numbeoPrices(city)` → structured USD snapshot: family/single monthly, rent (city-centre/outside),
  inexpensive meal, basic utilities, 60 Mbps internet. Missing values come back `null` (not hallucinated).

Verified live: Panama City `{family 3017, single 830, rent 1270/913, meal 10, utils 131, internet 47}`;
Boquete `{rent 825/700, meal 6.5, utils 58, internet 42.5, family/single null}`.

**Keep extract prompts lean (~6 fields)** — gpt-oss-120b returns null on over-stuffed schemas.

## CLI
```
node tools/agents/lib/firecrawl-source.js "Panama City"
```
Env: `FIRECRAWL_URL` (default `http://192.168.68.77:3002`, the rogue self-host).

## Wiring into context-builder.js
Make `buildContext` async (or add an async pre-step in the orchestrator), map each in-scope
location to its Numbeo city, and add a scraped block the prompts can interpolate:

```js
import { numbeoCostOfLiving, numbeoPrices } from './firecrawl-source.js';

// locId -> Numbeo city (extend as locations are added)
const NUMBEO_CITY = { 'panama-panamacity': 'Panama City', 'panama-boquete': 'Boquete',
                      'us-virginia': 'Arlington', 'france-lyon': 'Lyon', 'spain-valencia': 'Valencia' };

async function scrapedSourcesBlock(locations) {
  const parts = [];
  for (const loc of locations) {
    const city = NUMBEO_CITY[loc];
    if (!city) continue;
    try {
      const prices = await numbeoPrices(city);            // structured (cheap, ~5 credits)
      parts.push(`### ${loc} — Numbeo (live)\n\`\`\`json\n${JSON.stringify(prices, null, 2)}\n\`\`\``);
      // For agents that want the full page: const { markdown } = await numbeoCostOfLiving(city);
    } catch (e) {
      parts.push(`### ${loc} — (live source unavailable: ${e.message})`); // best-effort, never hard-fail
    }
  }
  return parts.join('\n\n');
}
```
Then add `{{SCRAPED_SOURCES_BLOCK}}` to the prompt templates (groceries.md, housing.md, utilities.md,
entertainment.md, …) under a "## Live Source Data" heading, and set the context var from
`scrapedSourcesBlock(locations)`. The agents then reconcile their estimate against the live figures.

**Best-effort by design:** any scrape failure degrades to the existing LLM-only path — it must never
fail a run. Numbeo scrapes fine today; if a site is Cloudflare-hard, `scrapeMarkdown` throws and you
fall back. See `Infrastructure/Firecrawl-Selfhost.md` in the vault for the deployment/runbook.
