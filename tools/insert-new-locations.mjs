/**
 * Upsert specific location JSON files into AdminLocation.
 * Usage: node tools/insert-new-locations.mjs us-gainesville-va us-annapolis-md
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('Usage: node insert-new-locations.mjs <id> [<id>...]');
  process.exit(1);
}

// Category keys that are alternates — only one of them counts toward the
// rollup total. `healthcarePreMedicare` swaps in for `healthcare` at runtime
// based on household age; summing both would double-count.
const ALTERNATE_KEYS = new Set(['healthcarePreMedicare']);

function extractSearchFields(loc) {
  let monthlyCostTotal = 0;
  if (loc.monthlyCosts) {
    for (const [key, val] of Object.entries(loc.monthlyCosts)) {
      if (ALTERNATE_KEYS.has(key)) continue;
      if (val && typeof val.typical === 'number') monthlyCostTotal += val.typical;
    }
  }
  return {
    name: loc.name || '',
    country: loc.country || '',
    region: loc.region || '',
    currency: loc.currency || 'USD',
    monthlyCostTotal: Math.round(monthlyCostTotal),
  };
}

let created = 0, updated = 0;
for (const id of ids) {
  const path = join(__dirname, '..', 'data', 'locations', id, 'location.json');
  const loc = JSON.parse(readFileSync(path, 'utf-8'));
  const search = extractSearchFields(loc);
  const existing = await prisma.adminLocation.findUnique({ where: { id: loc.id } });
  if (existing) {
    const newVersion = existing.version + 1;
    await prisma.$transaction(async (tx) => {
      await tx.adminLocation.update({
        where: { id: loc.id },
        data: { locationData: loc, version: newVersion, ...search },
      });
      await tx.adminLocationHistory.create({
        data: { locationId: loc.id, version: newVersion, locationData: loc, changedBy: 'insert-new-locations' },
      });
    });
    updated++;
    console.log(`  ↻ updated ${loc.name}  (${search.monthlyCostTotal}/mo)`);
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.adminLocation.create({
        data: { id: loc.id, version: 1, locationData: loc, ...search },
      });
      await tx.adminLocationHistory.create({
        data: { locationId: loc.id, version: 1, locationData: loc, changedBy: 'insert-new-locations' },
      });
    });
    created++;
    console.log(`  + created ${loc.name}  (${search.monthlyCostTotal}/mo)`);
  }
}
console.log(`\nDone: ${created} created, ${updated} updated.`);
await prisma.$disconnect();
