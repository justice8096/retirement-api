#!/usr/bin/env node
/**
 * Adds discovery-link placeholders (webcams / YouTube / blogs) for every
 * location whose local-info.json is missing one of those three groups.
 *
 * Each added entry is a single "search" pointer — the user gets an
 * actionable URL that lists candidates. Matches the same "graceful
 * fallback" pattern used for religious/cuisine service categories.
 *
 * Idempotent: skips any group that already has >=1 entry.
 *
 * Usage:
 *   node scripts/augment-local-info-discovery-placeholders.mjs
 *   node scripts/augment-local-info-discovery-placeholders.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const TODAY = new Date().toISOString().slice(0, 10);
const DRY_RUN = process.argv.includes('--dry-run');

function shortCityName(locName) {
  // "Bogotá (Chapinero, Usaquén), Colombia" -> "Bogotá"
  // "Austin, Texas" -> "Austin"
  const first = locName.split(/[,(]/)[0].trim();
  return first || locName;
}

function webcamsPlaceholder(cityName) {
  const q = encodeURIComponent(`${cityName} webcam`);
  return {
    name: `${cityName} webcams (search)`,
    url: `https://www.windy.com/-Webcams/webcams?${q}`,
    description: `Live webcams near ${cityName} — Windy directory, rating-sorted. Replace with a specific camera once a reliable feed is identified.`,
  };
}

function youtubePlaceholder(cityName) {
  const q = encodeURIComponent(`${cityName} retirement expat living`);
  return {
    name: `${cityName} on YouTube (search)`,
    url: `https://www.youtube.com/results?search_query=${q}`,
    description: `YouTube search for channels covering retirement and expat life in ${cityName}. Replace with a specific channel once identified.`,
  };
}

function blogsPlaceholder(cityName) {
  const q = encodeURIComponent(`${cityName} expat retirement blog`);
  return {
    name: `${cityName} expat blogs (search)`,
    url: `https://www.google.com/search?q=${q}`,
    description: `Google search for English-language expat and retirement blogs about ${cityName}. Replace with a specific blog once identified.`,
  };
}

const touched = [];
let filled = 0;

for (const dir of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const liPath = join(DATA_DIR, dir.name, 'local-info.json');
  if (!existsSync(liPath)) continue;

  // Read name from location.json for a clean city label.
  const locPath = join(DATA_DIR, dir.name, 'location.json');
  const locData = existsSync(locPath) ? JSON.parse(readFileSync(locPath, 'utf-8')) : { name: dir.name };
  const cityName = shortCityName(locData.name || dir.name);

  const li = JSON.parse(readFileSync(liPath, 'utf-8'));
  let changed = false;

  if (!(li.webcams?.length > 0)) {
    li.webcams = [{ ...webcamsPlaceholder(cityName), accessed: TODAY }];
    changed = true;
    filled++;
  }
  if (!(li.youtubeChannels?.length > 0)) {
    li.youtubeChannels = [{ ...youtubePlaceholder(cityName), accessed: TODAY }];
    changed = true;
    filled++;
  }
  if (!(li.bloggers?.length > 0)) {
    li.bloggers = [{ ...blogsPlaceholder(cityName), accessed: TODAY }];
    changed = true;
    filled++;
  }

  if (changed) {
    touched.push(dir.name);
    if (!DRY_RUN) writeFileSync(liPath, JSON.stringify(li, null, 2) + '\n', 'utf-8');
  }
}

console.log(`Locations touched: ${touched.length}`);
console.log(`Placeholders added: ${filled}`);
if (DRY_RUN) console.log('(dry-run — no files written)');
