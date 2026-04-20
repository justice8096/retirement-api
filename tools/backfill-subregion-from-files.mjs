#!/usr/bin/env node
// One-off backfill: read subregion from each data/locations/<id>/location.json
// and update the admin_locations.subregion column + the location_data JSONB.
//
// Ran after FU-001 region normalization + the 117-location subregion
// fill-in. Safe to re-run — idempotent.
//
// Usage: node tools/backfill-subregion-from-files.mjs
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ids = readdirSync(LOC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

let updated = 0;
let skipped = 0;
let missing = 0;

for (const id of ids) {
  const data = JSON.parse(readFileSync(join(LOC_DIR, id, 'location.json'), 'utf8'));
  const subregion = data.subregion ?? null;

  const row = await prisma.adminLocation.findUnique({ where: { id } });
  if (!row) {
    missing++;
    console.log(`  MISSING ${id} (in data/ but not in DB)`);
    continue;
  }

  // Update the denormalized column AND merge subregion into location_data so
  // future reads of the JSONB carry it too. Prevents drift between the
  // column and the JSONB payload.
  const mergedLocationData = { ...(row.locationData ?? {}), subregion };
  await prisma.adminLocation.update({
    where: { id },
    data: { subregion, locationData: mergedLocationData },
  });
  if (!row.subregion || row.subregion !== subregion) {
    updated++;
    console.log(`  ${id.padEnd(32)} subregion="${subregion ?? '(null)'}"`);
  } else {
    skipped++;
  }
}

console.log('');
console.log(`Updated: ${updated}`);
console.log(`Skipped: ${skipped} (already in sync)`);
console.log(`Missing: ${missing} (on disk but not in DB)`);

await prisma.$disconnect();
