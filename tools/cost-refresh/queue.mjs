#!/usr/bin/env node
/**
 * cost-refresh/queue.mjs - pick the next locations for a cost refresh and
 * bundle their current data for the research agents.
 *
 * Usage: node tools/cost-refresh/queue.mjs [--since YYYY-MM-DD] [--limit N] [--out FILE]
 *
 * Reads data/cost-refresh-log.json (written by apply.mjs). Order:
 *   1. locations not attempted since --since
 *   2. then locations attempted once with fewer than 6 verified categories
 * Locations attempted twice, or with 6+ verified, are done for this campaign.
 * Prints chosen ids (one per line; "QUEUE EMPTY" on stderr when nothing is
 * left) and writes {id: {name, country, currency, exchangeRate, monthlyCosts}} to --out.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SINCE = opt('--since', '2026-11-01');
const LIMIT = Number(opt('--limit', '15'));
const OUT = opt('--out', join(ROOT, '.refresh', 'inputs.json'));

const idx = JSON.parse(readFileSync(join(ROOT, 'data', 'index.json'), 'utf8'));
const logPath = join(ROOT, 'data', 'cost-refresh-log.json');
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : {};
const fresh = [], retry = [];
for (const { id } of idx.locations) {
  const e = log[id];
  if (!e || e.lastAttempt < SINCE) fresh.push(id);
  else if ((e.verifiedCategories ?? 0) < 6 && (e.attempts ?? 1) < 2) retry.push(id);
}
const pick = [...fresh.sort(), ...retry.sort()].slice(0, LIMIT);
const bundle = {};
for (const id of pick) {
  const loc = JSON.parse(readFileSync(join(ROOT, 'data', 'locations', id, 'location.json'), 'utf8'));
  bundle[id] = { name: loc.name, country: loc.country, currency: loc.currency, exchangeRate: loc.exchangeRate, monthlyCosts: loc.monthlyCosts };
}
writeFileSync(OUT, JSON.stringify(bundle));
console.error(`${fresh.length} not yet attempted, ${retry.length} queued for retry; picked ${pick.length}`);
if (!pick.length) console.error('QUEUE EMPTY');
for (const id of pick) console.log(id);
