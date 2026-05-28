#!/usr/bin/env node
/**
 * Refresh prisma/seed-locations-{us,eu,latam}.json from canonical
 * data/locations/<id>/location.json.
 *
 * For every snapshot entry whose id exists in canonical, replace it with the
 * canonical object (in place: array order, length, and file EOL preserved).
 * Entries with no canonical match are left untouched and reported as seedOnly.
 *
 * Why: the seed-*.json files are import snapshots consumed only by
 * prisma/seed-new-locations.ts (--force) and the integrity test (which dedups
 * them behind canonical). They drift whenever canonical changes; keeping them
 * in sync prevents a --force reseed from writing stale data. Entry counts are
 * preserved so the seed-count assertions stay valid.
 *
 * Usage:
 *   node scripts/sync-seed-snapshots-from-canonical.mjs --dry-run
 *   node scripts/sync-seed-snapshots-from-canonical.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const dryRun = process.argv.includes('--dry-run');
const LOCS = 'data/locations';
const SNAPS = [
  'prisma/seed-locations-us.json',
  'prisma/seed-locations-eu.json',
  'prisma/seed-locations-latam.json',
];

const canon = new Map();
for (const dir of readdirSync(LOCS)) {
  const p = join(LOCS, dir, 'location.json');
  if (existsSync(p)) canon.set(dir, JSON.parse(readFileSync(p, 'utf-8')));
}
console.log(`Canonical locations loaded: ${canon.size}\n`);

for (const snap of SNAPS) {
  const raw = readFileSync(snap, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const arr = JSON.parse(raw);
  let refreshed = 0;
  const seedOnly = [];
  const out = arr.map((e) => {
    if (canon.has(e.id)) { refreshed++; return canon.get(e.id); }
    seedOnly.push(e.id);
    return e;
  });
  console.log(`${snap}: ${arr.length} entries — ${refreshed} refreshed, ${seedOnly.length} seedOnly`);
  if (seedOnly.length) console.log(`   seedOnly (no canonical, left as-is): ${seedOnly.join(', ')}`);
  if (!dryRun) {
    let text = JSON.stringify(out, null, 2) + '\n';
    if (eol === '\r\n') text = text.replace(/\n/g, '\r\n');
    writeFileSync(snap, text, 'utf-8');
  }
}
console.log(dryRun ? '\n[dry-run] no files written' : '\nSnapshots synced from canonical.');
