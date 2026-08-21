/**
 * firecrawl-source.js — Firecrawl-backed source fetcher for the cost-of-living agents.
 *
 * Scrapes real price sources (Numbeo, ISP / utility / streaming pages, …) via the self-hosted
 * Firecrawl on rogue, so agents ground their estimates in CURRENT scraped data instead of the
 * LLM's stale training knowledge. Two modes:
 *   - scrapeMarkdown(url)        → clean markdown to inject into an agent's context block
 *   - extractStructured(url, p)  → structured JSON via Firecrawl /extract (HF Pro gpt-oss-120b)
 *
 * Env: FIRECRAWL_URL (default http://192.168.68.77:3002, the rogue self-host).
 *
 * Integration (context-builder.js): for each in-scope location, resolve its city, call
 * numbeoCostOfLiving(city) (or numbeoPrices(city)), and add the result to the prompt context as
 * a {{SCRAPED_SOURCES_BLOCK}} so the agent reads live figures. Best-effort: on scrape failure
 * (site blocked / offline) fall back to the existing LLM-only path — never hard-fail a run.
 */

const FIRECRAWL = process.env.FIRECRAWL_URL || 'http://192.168.68.77:3002';

async function fcPost(path, body, timeoutMs = 130000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(FIRECRAWL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const BLOCK_MARKERS = ['just a moment', 'attention required', 'checking your browser', 'captcha'];

/** Scrape a URL to clean markdown. Returns { source, title, markdown }; throws on failure/block. */
export async function scrapeMarkdown(url, { onlyMainContent = true } = {}) {
  const d = await fcPost('/v1/scrape', { url, formats: ['markdown'], onlyMainContent });
  if (!d?.success) throw new Error(`scrape failed for ${url}: ${d?.error || d?.code}`);
  const md = (d.data?.markdown || '').trim();
  const title = d.data?.metadata?.title || url;
  if (md.length < 60 || BLOCK_MARKERS.some((m) => (title + md).toLowerCase().includes(m))) {
    throw new Error(`scrape blocked/empty for ${url} (bot-challenge or no content)`);
  }
  return { source: url, title, markdown: md };
}

/** Extract structured JSON from a URL via Firecrawl /extract (LLM-backed). Returns object|null. */
export async function extractStructured(url, prompt, { timeout = 150000 } = {}) {
  const d = await fcPost('/v1/scrape', { url, formats: ['json'], jsonOptions: { prompt }, timeout }, timeout + 20000);
  if (!d?.success) throw new Error(`extract failed for ${url}: ${d?.error || d?.code}`);
  return d.data?.json ?? null;
}

/** Numbeo cost-of-living page URL for a city, e.g. "Panama City" → .../in/Panama-City */
export function numbeoUrl(city) {
  return `https://www.numbeo.com/cost-of-living/in/${city.trim().replace(/\s+/g, '-')}`;
}

/** Clean markdown of a city's Numbeo cost-of-living page (for context injection). */
export async function numbeoCostOfLiving(city) {
  return await scrapeMarkdown(numbeoUrl(city));
}

/** Structured cost-of-living snapshot for a city (grocery/rent/utilities/internet/etc.), USD. */
export async function numbeoPrices(city) {
  // Keep the field set lean (~6) — gpt-oss-120b returns null on over-stuffed schemas.
  const prompt =
    'Extract cost-of-living figures from this Numbeo page as JSON, numeric USD (null if unknown): ' +
    'family_of_four_monthly_usd (excluding rent), single_person_monthly_usd (excluding rent), ' +
    'rent_1br_city_center_usd, rent_1br_outside_usd, meal_inexpensive_usd, utilities_basic_monthly_usd, ' +
    'internet_60mbps_monthly_usd.';
  return await extractStructured(numbeoUrl(city), prompt);
}

// --- CLI demo:  node firecrawl-source.js "Panama City" ---
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const city = process.argv[2] || 'Panama City';
  console.error(`[demo] Firecrawl /extract of Numbeo cost-of-living for: ${city} …`);
  numbeoPrices(city)
    .then((j) => console.log(JSON.stringify(j, null, 2)))
    .catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
