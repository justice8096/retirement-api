/**
 * Seed script for 118 new retirement locations (Tier 1 + Tier 2).
 * (5 locations overlap with originals and were removed from seed files.)
 *
 * Loads from:
 *   prisma/seed-locations-us.json    (39 US locations)
 *   prisma/seed-locations-eu.json    (39 EU locations)
 *   prisma/seed-locations-latam.json (40 Latin America locations)
 *
 * Usage:
 *   npx tsx prisma/seed-new-locations.ts              # Create new, skip existing
 *   npx tsx prisma/seed-new-locations.ts --dry-run    # Preview without writing
 *   npx tsx prisma/seed-new-locations.ts --force      # Overwrite existing locations
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface LocationSeed {
  id: string;
  name: string;
  country: string;
  region: string;
  currency: string;
  monthlyCosts: Record<string, { typical: number }>;
  [key: string]: unknown;
}

function extractSearchFields(loc: LocationSeed) {
  let monthlyCostTotal = 0;
  if (loc.monthlyCosts) {
    for (const val of Object.values(loc.monthlyCosts)) {
      if (val && typeof val.typical === 'number') {
        monthlyCostTotal += val.typical;
      }
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log(`\n🌍 Retirement Location Seeder (123 new locations)`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no writes)' : force ? 'FORCE (overwrite existing)' : 'Normal (skip existing)'}\n`);

  // Load seed files
  const files = [
    'seed-locations-us.json',
    'seed-locations-eu.json',
    'seed-locations-latam.json',
  ];

  const allLocations: LocationSeed[] = [];
  for (const file of files) {
    const filePath = join(__dirname, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LocationSeed[];
      console.log(`  📄 ${file}: ${data.length} locations`);
      allLocations.push(...data);
    } catch (err) {
      console.error(`  ❌ Failed to read ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n  Total: ${allLocations.length} locations to seed\n`);

  if (dryRun) {
    console.log('  DRY RUN — listing locations:\n');
    const byCountry: Record<string, string[]> = {};
    for (const loc of allLocations) {
      const c = loc.country || 'Unknown';
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push(`${loc.name} (${loc.id})`);
    }
    for (const [country, names] of Object.entries(byCountry).sort()) {
      console.log(`  ${country} (${names.length}):`);
      for (const n of names) console.log(`    - ${n}`);
    }
    console.log(`\n  ✅ Dry run complete. Remove --dry-run to write to database.\n`);
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const loc of allLocations) {
    const searchFields = extractSearchFields(loc);

    try {
      const existing = await prisma.adminLocation.findUnique({ where: { id: loc.id } });

      if (existing && !force) {
        skipped++;
        continue;
      }

      if (existing && force) {
        const newVersion = existing.version + 1;
        await prisma.$transaction(async (tx) => {
          await tx.adminLocation.update({
            where: { id: loc.id },
            data: {
              locationData: loc as unknown as Record<string, unknown>,
              version: newVersion,
              ...searchFields,
            },
          });
          await tx.adminLocationHistory.create({
            data: {
              locationId: loc.id,
              version: newVersion,
              locationData: loc as unknown as Record<string, unknown>,
              changedBy: 'seed-new-locations',
            },
          });
        });
        updated++;
        console.log(`  ↻ ${loc.name}`);
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.adminLocation.create({
            data: {
              id: loc.id,
              locationData: loc as unknown as Record<string, unknown>,
              version: 1,
              ...searchFields,
            },
          });
          await tx.adminLocationHistory.create({
            data: {
              locationId: loc.id,
              version: 1,
              locationData: loc as unknown as Record<string, unknown>,
              changedBy: 'seed-new-locations',
            },
          });
        });
        created++;
        console.log(`  ✓ ${loc.name}`);
      }
    } catch (err) {
      console.error(`  ❌ ${loc.id}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n  📊 Results:`);
  console.log(`     Created: ${created}`);
  console.log(`     Updated: ${updated}`);
  console.log(`     Skipped: ${skipped} (already exist, use --force to overwrite)`);
  if (errors) console.log(`     Errors:  ${errors}`);
  console.log(`\n  ✅ Seed complete.\n`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
