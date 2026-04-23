#!/usr/bin/env node
/**
 * Template-seed 21 locations missing supplement files.
 *
 * For each target location, this copies a geographically-similar
 * template location's `services.json`, `neighborhoods.json`, and
 * `detailed-costs.json`, then performs whole-word substitutions
 * replacing the template city/state strings with the target's.
 *
 * Output is explicitly marked as "starter template" data — each file
 * gets a `_seedOrigin` metadata entry noting the template source and
 * date so a per-location curation pass can flag files still at
 * template quality.
 *
 * Not run at seed time; invoke manually:
 *   node scripts/seed-missing-location-files.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const ACCESSED = new Date().toISOString().slice(0, 10);

/** Location name + state mapping (from location.json or hardcoded). */
const TARGET_META = {
  // MD suburbs — template: baltimore-md
  'us-annapolis-md':   { name: 'Annapolis', state: 'Maryland', template: 'us-baltimore-md', origName: 'Baltimore', origState: 'Maryland' },
  'us-bowie-md':       { name: 'Bowie',      state: 'Maryland', template: 'us-baltimore-md', origName: 'Baltimore', origState: 'Maryland' },
  'us-catonsville-md': { name: 'Catonsville',state: 'Maryland', template: 'us-baltimore-md', origName: 'Baltimore', origState: 'Maryland' },
  'us-elkridge-md':    { name: 'Elkridge',   state: 'Maryland', template: 'us-baltimore-md', origName: 'Baltimore', origState: 'Maryland' },
  'us-glen-burnie-md': { name: 'Glen Burnie',state: 'Maryland', template: 'us-baltimore-md', origName: 'Baltimore', origState: 'Maryland' },
  // VA suburbs — template: virginia-beach-va
  'us-annandale-va':   { name: 'Annandale',  state: 'Virginia', template: 'us-virginia-beach-va', origName: 'Virginia Beach', origState: 'Virginia' },
  'us-gainesville-va': { name: 'Gainesville',state: 'Virginia', template: 'us-virginia-beach-va', origName: 'Virginia Beach', origState: 'Virginia' },
  'us-lorton-va':      { name: 'Lorton',     state: 'Virginia', template: 'us-virginia-beach-va', origName: 'Virginia Beach', origState: 'Virginia' },
  'us-manassas-va':    { name: 'Manassas',   state: 'Virginia', template: 'us-virginia-beach-va', origName: 'Virginia Beach', origState: 'Virginia' },
  // NJ — template: philadelphia (same metro)
  'us-camden-nj':      { name: 'Camden',     state: 'New Jersey', template: 'us-philadelphia', origName: 'Philadelphia', origState: 'Pennsylvania' },
  // NYC — template: philadelphia (neighbor metro)
  'us-new-york-city':  { name: 'New York City', state: 'New York', template: 'us-philadelphia', origName: 'Philadelphia', origState: 'Pennsylvania' },
  // USVI — template: miami-fl (tropical US territory)
  'us-charlotte-amalie-vi': { name: 'Charlotte Amalie', state: 'U.S. Virgin Islands', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  'us-christiansted-vi':     { name: 'Christiansted',   state: 'U.S. Virgin Islands', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  // Guam
  'us-dededo-gu':  { name: 'Dededo',  state: 'Guam', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  'us-hagatna-gu': { name: 'Hagåtña', state: 'Guam', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  // American Samoa
  'us-pago-pago-as': { name: 'Pago Pago', state: 'American Samoa', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  'us-tafuna-as':    { name: 'Tafuna',    state: 'American Samoa', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  // Puerto Rico
  'us-ponce-pr':    { name: 'Ponce',    state: 'Puerto Rico', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  'us-san-juan-pr': { name: 'San Juan', state: 'Puerto Rico', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  // Northern Mariana Islands
  'us-saipan-mp': { name: 'Saipan', state: 'Northern Mariana Islands', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
  'us-tinian-mp': { name: 'Tinian', state: 'Northern Mariana Islands', template: 'us-miami-fl', origName: 'Miami', origState: 'Florida' },
};

const FILES = ['services.json', 'neighborhoods.json', 'detailed-costs.json'];

let created = 0;
let skipped = 0;

for (const [target, meta] of Object.entries(TARGET_META)) {
  const targetDir = join(DATA_DIR, target);
  if (!existsSync(targetDir)) { mkdirSync(targetDir, { recursive: true }); }

  for (const fname of FILES) {
    const out = join(targetDir, fname);
    if (existsSync(out)) { skipped++; continue; }

    const tplPath = join(DATA_DIR, meta.template, fname);
    if (!existsSync(tplPath)) { skipped++; continue; }

    let content = readFileSync(tplPath, 'utf-8');

    // Whole-word substitutions (case-sensitive).
    // City name: "Philadelphia" → "New York City"
    content = content.split(meta.origName).join(meta.name);
    // State (only if different)
    if (meta.origState !== meta.state) {
      content = content.split(meta.origState).join(meta.state);
    }

    // Inject _seedOrigin into the top-level object for downstream auditing.
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsed._seedOrigin = {
          kind: 'starter-template',
          from: meta.template,
          generatedAt: ACCESSED,
          note: 'Template-derived content — prices and names adapted from the template city. Needs per-location review.',
        };
        content = JSON.stringify(parsed, null, 2) + '\n';
      }
    } catch { /* leave raw content if not valid JSON for some reason */ }

    writeFileSync(out, content, 'utf-8');
    created++;
  }
}

console.log(`created: ${created}`);
console.log(`skipped: ${skipped}`);
