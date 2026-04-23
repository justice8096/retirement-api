#!/usr/bin/env node
/**
 * Add missing `visionDental` + `entertainment` sections to locations
 * that have a `detailed-costs.json` but are missing one or both.
 *
 * Template source: italy-puglia/detailed-costs.json.
 *
 * Prices are copied verbatim from Puglia (EUR-denominated) and need
 * per-location currency + cost-of-living adaptation. This script only
 * gets the fields wired in so screens can render; a follow-up curation
 * pass must revise the numbers. Each section is tagged with
 * `_seedOrigin` for auditing.
 *
 * Usage:  node scripts/seed-missing-sections.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const ACCESSED = new Date().toISOString().slice(0, 10);

const tpl = JSON.parse(readFileSync(join(DATA_DIR, 'italy-puglia', 'detailed-costs.json'), 'utf-8'));
const TPL_VISION_DENTAL = tpl.visionDental;
const TPL_ENTERTAINMENT = tpl.entertainment;

const ORIGIN_TAG = {
  _seedOrigin: {
    kind: 'starter-template',
    from: 'italy-puglia',
    generatedAt: ACCESSED,
    note: 'Template-derived section — prices are EUR-denominated from Puglia, Italy. Needs per-location currency + cost-of-living adaptation.',
  },
};

let touched = 0;
let skipped = 0;

for (const d of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const p = join(DATA_DIR, d.name, 'detailed-costs.json');
  if (!existsSync(p)) { skipped++; continue; }
  const data = JSON.parse(readFileSync(p, 'utf-8'));

  let changed = false;
  const hasVd = 'visionDental' in data;
  const hasSplit = 'vision' in data && 'dental' in data;
  if (!hasVd && !hasSplit) {
    data.visionDental = { ...TPL_VISION_DENTAL, ...ORIGIN_TAG };
    changed = true;
  }
  if (!('entertainment' in data)) {
    data.entertainment = { ...TPL_ENTERTAINMENT, ...ORIGIN_TAG };
    changed = true;
  }

  if (changed) {
    writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    touched++;
  } else {
    skipped++;
  }
}

console.log(`touched: ${touched}`);
console.log(`skipped: ${skipped}`);
