#!/usr/bin/env node
/**
 * Second-pass YouTube curation: try broader / alternate query templates
 * for locations whose youtubeChannels[0] is still a (search) placeholder.
 *
 * Tries each query in order until one returns >=1 channel candidate. Uses
 * the same relevance/subscriber scoring as curate-youtube-via-api.mjs, but
 * widens the candidate pool by trying multiple phrasings and city-name
 * variants (including location.json's `cities[]` array for broad regions).
 *
 * Query templates tried (first hit wins):
 *   1. "<city> <country> expat retirement" (original template)
 *   2. "<city> <country> travel"
 *   3. "living in <city> <country>"
 *   4. "<city>" (bare — last resort)
 * For broad regions, also tries each entry in location.json's `cities[]`
 * using the same template set.
 *
 * Usage: YOUTUBE_API_KEY=<key> node scripts/curate-youtube-fallback-queries.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const TODAY = new Date().toISOString().slice(0, 10);
const API_KEY = process.env.YOUTUBE_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!API_KEY) {
  console.error('YOUTUBE_API_KEY env var is required');
  process.exit(1);
}

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function shortCity(locName) {
  return stripDiacritics(locName.split(/[,(]/)[0].trim());
}

async function searchChannels(query) {
  const params = new URLSearchParams({
    part: 'snippet', type: 'channel', q: query, maxResults: '10', key: API_KEY,
  });
  const res = await fetch(`${SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`search.list ${res.status}`);
  const json = await res.json();
  return json.items || [];
}

async function getChannelDetails(ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: 'snippet,statistics', id: ids.join(','), key: API_KEY,
  });
  const res = await fetch(`${CHANNELS_URL}?${params}`);
  if (!res.ok) throw new Error(`channels.list ${res.status}`);
  const json = await res.json();
  return json.items || [];
}

function pickBest(candidates, cityName) {
  const lcCity = cityName.toLowerCase();
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

function channelUrl(c) {
  if (c.customUrl) return `https://www.youtube.com/${c.customUrl.startsWith('@') ? c.customUrl : '@' + c.customUrl}`;
  return `https://www.youtube.com/channel/${c.channelId}`;
}

function queryTemplatesFor(city, country) {
  const isUs = country === 'United States';
  const base = [];
  if (isUs) {
    base.push(`living in ${city}`);
    base.push(`${city} travel guide`);
    base.push(`${city} ${country}`);
    base.push(city);
  } else {
    base.push(`${city} ${country} expat retirement`);
    base.push(`${city} ${country} travel`);
    base.push(`living in ${city} ${country}`);
    base.push(city);
  }
  return base;
}

async function pickForQuery(query, cityForScoring) {
  const results = await searchChannels(query);
  if (!results.length) return null;
  const channelIds = results.map(r => r.snippet?.channelId || r.id?.channelId).filter(Boolean);
  const details = await getChannelDetails(channelIds);
  const byId = Object.fromEntries(details.map(d => [d.id, d]));
  const candidates = results.map(r => {
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
  }).filter(Boolean);
  if (!candidates.length) return null;
  return pickBest(candidates, cityForScoring);
}

// Build work list.
const work = [];
for (const loc of readdirSync(DATA_DIR)) {
  const liPath = join(DATA_DIR, loc, 'local-info.json');
  if (!existsSync(liPath)) continue;
  const li = JSON.parse(readFileSync(liPath, 'utf-8'));
  const yt = li.youtubeChannels?.[0];
  if (!yt || yt.name?.includes('(search)')) {
    const locJson = JSON.parse(readFileSync(join(DATA_DIR, loc, 'location.json'), 'utf-8'));
    const primaryCity = shortCity(locJson.name || loc);
    const country = locJson.country || '';
    const citiesArr = Array.isArray(locJson.cities) ? locJson.cities.map(c => stripDiacritics(c)) : [];
    work.push({ id: loc, primaryCity, country, citiesArr });
  }
}
console.log(`To curate (fallback pass): ${work.length} locations`);

let ok = 0, stillMissing = 0;
for (const w of work) {
  const cityCandidates = [w.primaryCity, ...w.citiesArr.filter(c => c !== w.primaryCity)];
  let best = null;
  let matchedQuery = '';
  outer:
  for (const city of cityCandidates) {
    for (const q of queryTemplatesFor(city, w.country)) {
      try {
        const candidate = await pickForQuery(q, city);
        if (candidate && candidate.score > -40) {
          best = candidate;
          matchedQuery = `"${q}"`;
          break outer;
        }
      } catch (err) {
        if (String(err.message).includes('403')) {
          console.error('Quota likely exhausted — stopping.');
          process.exit(0);
        }
      }
    }
  }

  if (!best) {
    console.log(`- ${w.id}: no candidates across ${cityCandidates.length} cit${cityCandidates.length === 1 ? 'y' : 'ies'} × 4 templates`);
    stillMissing++;
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

  console.log(`✓ ${w.id}: ${best.title} (${best.subs} subs, score=${best.score.toFixed(1)}, q=${matchedQuery})`);
  ok++;
}

console.log(`\n=== SUMMARY ===\nOK: ${ok}\nStill missing: ${stillMissing}\nTotal in pass: ${work.length}`);
if (DRY_RUN) console.log('(dry-run — no files written)');
