#!/usr/bin/env node
/**
 * Curate a YouTube channel for every location whose youtubeChannels[0]
 * is still a search placeholder. Uses YouTube Data API v3 search.list
 * (type=channel) — costs 100 quota units per location.
 *
 * Usage:
 *   YOUTUBE_API_KEY=<key> node scripts/curate-youtube-via-api.mjs
 *   YOUTUBE_API_KEY=<key> node scripts/curate-youtube-via-api.mjs --dry-run
 *   YOUTUBE_API_KEY=<key> node scripts/curate-youtube-via-api.mjs --limit 50
 *
 * Ranks candidates:
 *   1. Highest subscriberCount (via channels.list, 1 unit/page — cheap)
 *   2. Prefer channels whose title/description mentions the city name
 *
 * Quota budget:
 *   * search.list: 100 units/call -> 1 call per location (discovery)
 *   * channels.list: 1 unit/call -> 1 call per location (sub counts)
 *   * Total: 101 units per location. 10K/day free tier = ~99 locations/day.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const TODAY = new Date().toISOString().slice(0, 10);
const API_KEY = process.env.YOUTUBE_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

if (!API_KEY) {
  console.error('YOUTUBE_API_KEY env var is required');
  process.exit(1);
}

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

async function searchChannels(query) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: '10',
    key: API_KEY,
  });
  const res = await fetch(`${SEARCH_URL}?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`search.list ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.items || [];
}

async function getChannelDetails(channelIds) {
  if (!channelIds.length) return [];
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    id: channelIds.join(','),
    key: API_KEY,
  });
  const res = await fetch(`${CHANNELS_URL}?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`channels.list ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.items || [];
}

function pickBest(candidates, cityName) {
  // Candidates: [{channelId, title, description, subscriberCount, customUrl}]
  const lcCity = cityName.toLowerCase();
  // Score: +10 if title mentions city, +5 if description mentions city,
  // +log10(subs) to favour established channels, -50 if subs < 100 (zombie).
  const scored = candidates.map(c => {
    let score = 0;
    const subs = parseInt(c.subscriberCount || '0', 10);
    if (c.title?.toLowerCase().includes(lcCity)) score += 10;
    if (c.description?.toLowerCase().includes(lcCity)) score += 5;
    if (subs >= 100) score += Math.log10(Math.max(1, subs));
    else score -= 50;
    return { ...c, score, subs };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function buildQuery(city, country) {
  // Non-US keeps "expat"; US substitutes "living in" because "expat"
  // implies outside-US.
  const isUs = country === 'United States';
  return isUs
    ? `living in ${city} ${country}`
    : `${city} ${country} retirement expat living`;
}

function channelUrl(c) {
  if (c.customUrl) return `https://www.youtube.com/${c.customUrl.startsWith('@') ? c.customUrl : '@' + c.customUrl}`;
  return `https://www.youtube.com/channel/${c.channelId}`;
}

// Build work list.
const work = [];
for (const loc of readdirSync(DATA_DIR)) {
  const liPath = join(DATA_DIR, loc, 'local-info.json');
  if (!existsSync(liPath)) continue;
  const li = JSON.parse(readFileSync(liPath, 'utf-8'));
  const yt = li.youtubeChannels?.[0];
  if (!yt || yt.name?.includes('(search)')) {
    const locPath = join(DATA_DIR, loc, 'location.json');
    const locJson = existsSync(locPath) ? JSON.parse(readFileSync(locPath, 'utf-8')) : { name: loc };
    const city = (locJson.name || loc).split(/[,(]/)[0].trim();
    work.push({ id: loc, city, country: locJson.country || '' });
  }
}
console.log(`To curate: ${work.length} locations (limit=${LIMIT === Infinity ? 'none' : LIMIT})`);

let ok = 0, fail = 0, skipped = 0;
for (const w of work.slice(0, LIMIT)) {
  const query = buildQuery(w.city, w.country);
  try {
    const searchResults = await searchChannels(query);
    if (!searchResults.length) {
      console.log(`- ${w.id}: no results for "${query}"`);
      skipped++;
      continue;
    }

    const channelIds = searchResults.map(r => r.snippet?.channelId || r.id?.channelId).filter(Boolean);
    const details = await getChannelDetails(channelIds);
    const byId = Object.fromEntries(details.map(d => [d.id, d]));

    const candidates = searchResults
      .map(r => {
        const id = r.snippet?.channelId || r.id?.channelId;
        const d = byId[id];
        if (!d) return null;
        return {
          channelId: id,
          title: d.snippet?.title || '',
          description: d.snippet?.description || '',
          customUrl: d.snippet?.customUrl || '',
          subscriberCount: d.statistics?.subscriberCount || '0',
        };
      })
      .filter(Boolean);

    const best = pickBest(candidates, w.city);
    if (!best) {
      console.log(`- ${w.id}: no candidates after filter`);
      skipped++;
      continue;
    }

    const entry = {
      name: best.title,
      url: channelUrl(best),
      accessed: TODAY,
    };
    if (best.description) entry.description = best.description.slice(0, 200).replace(/\s+/g, ' ').trim();

    if (!DRY_RUN) {
      const liPath = join(DATA_DIR, w.id, 'local-info.json');
      const li = JSON.parse(readFileSync(liPath, 'utf-8'));
      li.youtubeChannels = [entry];
      writeFileSync(liPath, JSON.stringify(li, null, 2) + '\n', 'utf-8');
    }

    console.log(`✓ ${w.id}: ${best.title} (${best.subs} subs, score=${best.score.toFixed(1)})`);
    ok++;
  } catch (err) {
    console.error(`✗ ${w.id}: ${err.message}`);
    fail++;
    if (String(err.message).includes('quotaExceeded')) {
      console.error('Quota exceeded — stopping. Re-run tomorrow for remaining.');
      break;
    }
  }
}

console.log(`\n=== SUMMARY ===\nOK: ${ok}\nSkipped: ${skipped}\nFailed: ${fail}`);
if (DRY_RUN) console.log('(dry-run — no files written)');
