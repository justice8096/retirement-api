#!/usr/bin/env node
/**
 * Sync data/index.json's `locations` array against the directories
 * present in data/locations/. Adds any location with a location.json
 * that isn't already in the index; doesn't remove anything.
 *
 * Index entries are derived from each location's location.json so the
 * metadata stays consistent.
 *
 * Usage:  node scripts/sync-index-from-locations.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data';
const INDEX = join(DATA_DIR, 'index.json');
const LOCS = join(DATA_DIR, 'locations');

const idx = JSON.parse(readFileSync(INDEX, 'utf-8'));
const byId = new Map((idx.locations || []).map(l => [l.id, l]));

function summaryFromLocationJson(locId, locJson) {
  const climate = locJson.climate ?? {};
  const lifestyle = locJson.lifestyle ?? {};
  const healthcare = locJson.healthcare ?? {};
  return {
    id: locId,
    name: locJson.name ?? locId,
    country: locJson.country ?? '',
    region: locJson.region ?? '',
    currency: locJson.currency ?? 'USD',
    exchangeRate: locJson.exchangeRate ?? 1,
    monthlyCostUSD: Math.round(locJson.monthlyCostTotal ?? 0),
    climate: {
      winterLowF: climate.winterLowF ?? null,
      summerHighF: climate.summerHighF ?? null,
      meetsWarmWinterReq: climate.meetsWarmWinterReq ?? false,
    },
    scores: {
      healthcare: healthcare.qualityRating ?? 0,
      dogFriendly: lifestyle.dogFriendly ?? 0,
      expatCommunity: lifestyle.expatCommunity ?? 0,
      safety: lifestyle.safetyRating ?? 0,
      internetSpeed: lifestyle.internetSpeed ?? '',
      englishPrevalence: lifestyle.englishPrevalence ?? 0,
    },
    inclusionScore: null,
    neighborhoodCount: 0,
    hasDetailedCosts: null,
  };
}

let added = 0;
for (const entry of readdirSync(LOCS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (byId.has(entry.name)) continue;
  const locJsonPath = join(LOCS, entry.name, 'location.json');
  if (!existsSync(locJsonPath)) continue;
  const locJson = JSON.parse(readFileSync(locJsonPath, 'utf-8'));
  const summary = summaryFromLocationJson(entry.name, locJson);
  idx.locations.push(summary);
  byId.set(entry.name, summary);
  added++;
  console.log(`added: ${entry.name}`);
}

if (added > 0) {
  // Keep locations sorted by id for stable diffs.
  idx.locations.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n', 'utf-8');
}
console.log(`\ntotal added: ${added}`);
console.log(`total in index: ${idx.locations.length}`);
