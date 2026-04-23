#!/usr/bin/env node
/**
 * Migrate every location.json's `cons: string[]` to `cons: {text, sources?}[]`,
 * and attach vault-derived sources where confident keyword matches exist.
 *
 * Only cons whose text clearly relates to a vault note's topic get sources
 * attached — avoids misleading citations for unrelated claims.
 *
 * Topic matching (case-insensitive substring on con text):
 *   crime/safety/theft/pickpocket/burglary/violence  -> crime note
 *   cost/expensive/rent/price/housing                -> cost note
 *   tax/taxes/taxation                               -> taxes note
 *   visa/residency/permit                            -> visa note
 *   ev/electric/car/transport                        -> transport note
 *   dog/pet                                          -> pets note
 *
 * Usage:
 *   node scripts/migrate-cons-to-sourced-shape.mjs
 *   node scripts/migrate-cons-to-sourced-shape.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const CATALOG_PATH = 'audits/vault-source-catalog.json';
const TODAY = new Date().toISOString().slice(0, 10);
const DRY_RUN = process.argv.includes('--dry-run');

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const byLoc = {};
for (const note of catalog.catalog) {
  for (const loc of note.locations) {
    (byLoc[loc] ||= []).push(note);
  }
}

const TOPIC_KEYWORDS = {
  crime: ['crime', 'safety', 'theft', 'pickpocket', 'burglary', 'violent', 'violence', 'unsafe', 'hate'],
  cost: ['cost', 'expensive', 'pricey', 'rent', 'price', 'housing', 'afford', 'hous'],
  taxes: ['tax', 'taxes', 'taxation', 'taxed'],
  visa: ['visa', 'residency', 'permit', 'immigrat'],
  transport: ['ev', 'electric', 'car', 'transport', 'parking'],
  pets: ['dog', 'pet'],
  climate: ['weather', 'winter', 'rain', 'humid', 'cold', 'hot', 'storm', 'flood'],
  health: ['healthcare', 'health', 'medical'],
  housing: ['hous', 'rent', 'property', 'apartment'],
};

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url.slice(0, 50); }
}

function matchTopic(conText) {
  const lc = conText.toLowerCase();
  const matched = [];
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some(kw => lc.includes(kw))) matched.push(topic);
  }
  return matched;
}

const BLOCKED_HOSTS = new Set(['perplexity.ai', 'www.perplexity.ai']);

function sourcesForCon(locId, conText) {
  const notes = byLoc[locId];
  if (!notes) return [];
  const conTopics = matchTopic(conText);
  if (!conTopics.length) return [];
  const match = notes.find(n => n.topics.some(t => conTopics.includes(t)));
  if (!match) return [];
  const seenHosts = new Set();
  const sources = [];
  for (const url of match.sourceUrls) {
    const h = hostname(url);
    if (BLOCKED_HOSTS.has(h) || seenHosts.has(h)) continue;
    seenHosts.add(h);
    sources.push({ title: h, url, accessed: TODAY });
    if (sources.length >= 3) break;
  }
  return sources;
}

let migrated = 0, withSources = 0, skipped = 0;
for (const loc of readdirSync(DATA_DIR)) {
  const p = join(DATA_DIR, loc, 'location.json');
  if (!existsSync(p)) continue;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  const cons = data.cons;
  if (!Array.isArray(cons) || !cons.length) { skipped++; continue; }
  // If already migrated (first entry is an object), skip.
  if (typeof cons[0] === 'object' && cons[0] !== null) { skipped++; continue; }

  const newCons = cons.map(text => {
    const sources = sourcesForCon(loc, text);
    if (sources.length) withSources++;
    const entry = { text };
    if (sources.length) entry.sources = sources;
    return entry;
  });

  data.cons = newCons;
  if (!DRY_RUN) writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  migrated++;
}

console.log(`Migrated: ${migrated} locations`);
console.log(`Cons with vault sources attached: ${withSources}`);
console.log(`Skipped (no cons or already object-shaped): ${skipped}`);
if (DRY_RUN) console.log('(dry-run — no files written)');
