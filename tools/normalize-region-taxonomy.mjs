#!/usr/bin/env node
// Normalize region taxonomy across all location.json files (FU-001).
//
// Problem:
//   The `region` field currently mixes macro regions ("Southern Europe",
//   "US Southeast") with subregions ("Virginia", "Occitanie",
//   "Chiriquí"). 34 distinct strings for 158 locations; filters and
//   compare-by-region UIs group inconsistently.
//
// Fix:
//   - `region` = macro (continent / area / US-region)
//   - `subregion` = optional state / province / department (new field)
//
// Only locations whose current `region` is clearly a subregion get
// remapped — locations already on a macro stay unchanged (subregion
// remains absent, because retrofitting a Lisbon → "Lisboa" or Abruzzo →
// "Abruzzo" split requires local geography knowledge best contributed
// per-location rather than bulk-mapped here).
//
// Idempotent: re-running on an already-normalized tree is a no-op.
//
// Usage: node tools/normalize-region-taxonomy.mjs [--dry-run]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');

/** current-value → { region, subregion } — mapping only the strings
 *  that are NOT already macro. Strings absent from this map are left
 *  unchanged (region stays, no subregion added). */
const REMAP = {
  // US states moved into their macro region
  'Virginia':                 { region: 'US Mid-Atlantic',  subregion: 'Virginia' },
  'Maryland':                 { region: 'US Mid-Atlantic',  subregion: 'Maryland' },
  'Georgia':                  { region: 'US Southeast',     subregion: 'Georgia' },
  'Florida':                  { region: 'US Southeast',     subregion: 'Florida' },
  'North Carolina':           { region: 'US Southeast',     subregion: 'North Carolina' },
  'South Carolina':           { region: 'US Southeast',     subregion: 'South Carolina' },
  'New Jersey':               { region: 'US Northeast',     subregion: 'New Jersey' },
  'New York':                 { region: 'US Northeast',     subregion: 'New York' },
  'Pennsylvania':             { region: 'US Northeast',     subregion: 'Pennsylvania' },
  'Texas':                    { region: 'US South Central', subregion: 'Texas' },

  // US territories collapsed under a new "US Territories" macro
  'Puerto Rico':              { region: 'US Territories', subregion: 'Puerto Rico' },
  'US Virgin Islands':        { region: 'US Territories', subregion: 'US Virgin Islands' },
  'Guam':                     { region: 'US Territories', subregion: 'Guam' },
  'American Samoa':           { region: 'US Territories', subregion: 'American Samoa' },
  'Northern Mariana Islands': { region: 'US Territories', subregion: 'Northern Mariana Islands' },

  // France subregions → Western Europe
  'Occitanie':                { region: 'Western Europe', subregion: 'Occitanie' },
  'Brittany':                 { region: 'Western Europe', subregion: 'Brittany' },
  'Auvergne-Rhone-Alpes':     { region: 'Western Europe', subregion: 'Auvergne-Rhône-Alpes' },

  // Ireland → Western Europe
  'Munster':                  { region: 'Western Europe', subregion: 'Munster' },

  // Panama subregions → Central America
  'Chiriqui':                 { region: 'Central America', subregion: 'Chiriquí' },
  'Panama Province':          { region: 'Central America', subregion: 'Panama Province' },

  // Iberian subregions → Southern Europe
  'Lisboa / Algarve':         { region: 'Southern Europe', subregion: 'Lisboa / Algarve' },
  'Valencia':                 { region: 'Southern Europe', subregion: 'Valencia' },
};

/** Macro regions after normalization — anything already here is left
 *  alone. Expanding the set requires a corresponding UI review to
 *  ensure filters/compare views handle the new value. */
const VALID_MACRO = new Set([
  'US Northeast', 'US Mid-Atlantic', 'US Southeast', 'US Midwest',
  'US South Central', 'US Southwest', 'US Mountain West', 'US West Coast',
  'US Territories',
  'Western Europe', 'Southern Europe', 'Northern Europe', 'Eastern Europe',
  'Central America', 'South America',
  'East Asia', 'South Asia', 'Southeast Asia', 'Middle East',
  'Africa', 'Oceania',
]);

const ids = readdirSync(LOC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

let changed = 0;
let alreadyMacro = 0;
let unmapped = 0;
const unmappedList = [];

for (const id of ids) {
  const path = join(LOC_DIR, id, 'location.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const current = data.region;
  if (!current) continue;

  if (REMAP[current]) {
    const { region, subregion } = REMAP[current];
    if (data.region === region && data.subregion === subregion) continue; // idempotent
    data.region = region;
    data.subregion = subregion;
    changed++;
    console.log(`  ${id.padEnd(28)} "${current}" → region="${region}" subregion="${subregion}"`);
    if (!dryRun) writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    continue;
  }

  if (VALID_MACRO.has(current)) {
    alreadyMacro++;
    continue;
  }

  unmapped++;
  unmappedList.push({ id, region: current });
}

console.log('');
console.log(`Remapped:      ${changed}`);
console.log(`Already macro: ${alreadyMacro}`);
console.log(`Unmapped:      ${unmapped}`);
if (unmappedList.length) {
  console.log('\nUnmapped regions (left untouched — add to REMAP or VALID_MACRO):');
  for (const u of unmappedList) {
    console.log(`  ${u.id.padEnd(28)} "${u.region}"`);
  }
}
if (dryRun) console.log('\n[dry-run — no files written]');
