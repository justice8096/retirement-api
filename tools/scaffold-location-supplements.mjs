#!/usr/bin/env node
// Scaffold empty-but-valid supplement JSON files for a location.
//
// Usage:   node tools/scaffold-location-supplements.mjs <location-id> [--force]
// Example: node tools/scaffold-location-supplements.mjs us-austin
//
// Creates whichever of these files don't yet exist:
//   neighborhoods.json, services.json, inclusion.json, local-info.json
//
// Every new file carries `_meta.status = "stub"` so reviewers can tell at
// a glance which locations are placeholders awaiting contribution. Real
// PRs should remove the _meta block when real data lands.
//
// See docs/CONTRIBUTING-LOCATION-DATA.md for field-by-field guidance.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');
const TODAY = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const force = args.includes('--force');
const locationId = args.find(a => !a.startsWith('--'));

if (!locationId) {
  console.error('Usage: node tools/scaffold-location-supplements.mjs <location-id> [--force]');
  console.error('');
  console.error('Available locations:');
  const ids = readdirSync(LOC_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  // Print in a compact grid.
  const width = Math.max(...ids.map(id => id.length)) + 2;
  const cols = Math.max(1, Math.floor(100 / width));
  for (let i = 0; i < ids.length; i += cols) {
    console.error('  ' + ids.slice(i, i + cols).map(id => id.padEnd(width)).join(''));
  }
  process.exit(1);
}

const locDir = join(LOC_DIR, locationId);
if (!existsSync(locDir)) {
  console.error(`No such location: ${locationId}`);
  console.error(`Expected directory: ${locDir}`);
  process.exit(1);
}

const baseJson = JSON.parse(readFileSync(join(locDir, 'location.json'), 'utf8'));
const locName = baseJson.name ?? locationId;
const primaryCity = Array.isArray(baseJson.cities) ? baseJson.cities[0] : locName;
const currency = baseJson.currency ?? 'USD';

// ─── Templates ────────────────────────────────────────────────────────────
// Each template is a function so we can weave in data we already know
// (currency code, primary city, climate) to save contributors time.

const TEMPLATES = {
  'neighborhoods.json': () => ({
    _meta: {
      status: 'stub',
      generated: TODAY,
      instructions:
        'Replace this stub. Add 3–4 neighborhood entries with housing, ' +
        'walk/transit scores, safety, expat community signals, and sources. ' +
        'See docs/CONTRIBUTING-LOCATION-DATA.md.',
    },
    city: primaryCity,
    neighborhoods: [],
  }),

  'services.json': () => ({
    _meta: {
      status: 'stub',
      generated: TODAY,
      instructions:
        'Replace this stub. Add 2–4 entries per category (hospital, pharmacy, ' +
        'grocery, bank, hardware, vet, gym, shopping, transit) with address, ' +
        'distance, and sources. See docs/CONTRIBUTING-LOCATION-DATA.md.',
    },
    distanceUnit: 'km',
    currency,
    services: [],
  }),

  'inclusion.json': () => ({
    _meta: {
      status: 'stub',
      generated: TODAY,
      instructions:
        'Replace this stub. Research racial / religious / LGBTQ / ability / ' +
        'ageism inclusion for this location. Every subsection needs score, ' +
        'summary, legal protections, positive factors, risk factors, and ' +
        'sources. See docs/CONTRIBUTING-LOCATION-DATA.md for the required ' +
        'shape — Portugal is the reference exemplar.',
    },
    country: baseJson.country ?? '',
    region: baseJson.region ?? '',
    overallInclusionScore: null,
    lastUpdated: TODAY,
    categories: {},
  }),

  'local-info.json': () => ({
    _meta: {
      status: 'stub',
      generated: TODAY,
      instructions:
        'Replace this stub. Add webcams, bloggers, official sites, and YouTube ' +
        'channels for the location. Climate is optional here — if omitted, the ' +
        'dashboard falls back to location.json.climate.',
    },
    webcams: [],
    bloggers: [],
    officialSites: [],
    youtubeChannels: [],
  }),
};

let createdCount = 0;
let skippedCount = 0;

for (const [filename, builder] of Object.entries(TEMPLATES)) {
  const target = join(locDir, filename);
  if (existsSync(target) && !force) {
    console.log(`  skip    ${filename} (already exists; pass --force to overwrite)`);
    skippedCount++;
    continue;
  }
  const payload = builder();
  writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
  console.log(`  created ${filename}`);
  createdCount++;
}

console.log('');
console.log(`${locationId}: ${createdCount} created, ${skippedCount} skipped`);
if (createdCount > 0) {
  console.log('Next steps:');
  console.log(`  1. Edit data/locations/${locationId}/*.json`);
  console.log('  2. Remove the _meta.status block when real data lands');
  console.log('  3. Open a PR — see docs/CONTRIBUTING-LOCATION-DATA.md');
}
