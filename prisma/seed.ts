/**
 * Database seed script — loads location JSON data from the personal project
 * into the admin_locations and admin_location_supplements tables.
 *
 * Usage:
 *   tsx prisma/seed.ts                         # seed from default path
 *   DATA_DIR=./data tsx prisma/seed.ts         # seed from custom path
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';

// Prisma 7 requires the driver adapter pattern (see src/db/prisma.ts).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Default: read from the original project's data directory
const DATA_DIR = process.env.DATA_DIR || path.resolve('../../data');

interface LocationEntry {
  id: string;
  [key: string]: unknown;
}

interface IndexFile {
  locations: LocationEntry[];
}

async function main(): Promise<void> {
  console.log(`Seeding from: ${DATA_DIR}`);

  // 1. Load index.json
  const indexPath = path.join(DATA_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`index.json not found at ${indexPath}`);
    console.error('Set DATA_DIR env var or copy data/ directory');
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as IndexFile;

  // 2. Seed each location
  const supplementTypes = ['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info'];

  for (const entry of index.locations) {
    const locDir = path.join(DATA_DIR, 'locations', entry.id);
    const locPath = path.join(locDir, 'location.json');

    if (!fs.existsSync(locPath)) {
      console.warn(`  Skipping ${entry.id}: location.json not found`);
      continue;
    }

    const locationData = JSON.parse(fs.readFileSync(locPath, 'utf-8'));

    // Extract denormalized search fields
    const searchFields = {
      name: typeof locationData.name === 'string' ? locationData.name : '',
      country: typeof locationData.country === 'string' ? locationData.country : '',
      region: typeof locationData.region === 'string' ? locationData.region : '',
      currency: typeof locationData.currency === 'string' ? locationData.currency : 'USD',
      monthlyCostTotal: 0,
    };
    if (locationData.monthlyCosts && typeof locationData.monthlyCosts === 'object') {
      for (const val of Object.values(locationData.monthlyCosts as Record<string, { typical?: number }>)) {
        if (val && typeof val.typical === 'number') searchFields.monthlyCostTotal += val.typical;
      }
      searchFields.monthlyCostTotal = Math.round(searchFields.monthlyCostTotal);
    }

    // Upsert location
    await prisma.adminLocation.upsert({
      where: { id: entry.id },
      create: { id: entry.id, version: 1, locationData, ...searchFields },
      update: { locationData, version: { increment: 1 }, ...searchFields },
    });
    console.log(`  ✓ ${entry.id}`);

    // Upsert supplements
    for (const dataType of supplementTypes) {
      const supplementPath = path.join(locDir, `${dataType}.json`);
      if (!fs.existsSync(supplementPath)) continue;

      const data = JSON.parse(fs.readFileSync(supplementPath, 'utf-8'));
      await prisma.adminLocationSupplement.upsert({
        where: { locationId_dataType: { locationId: entry.id, dataType } },
        create: { locationId: entry.id, dataType, data },
        update: { data },
      });
      console.log(`    ✓ ${dataType}`);
    }
  }

  // 3. Seed shared data
  const sharedDir = path.join(DATA_DIR, 'shared');
  if (fs.existsSync(sharedDir)) {
    const sharedFiles = fs.readdirSync(sharedDir).filter((f) => f.endsWith('.json'));
    for (const file of sharedFiles) {
      const key = file.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(sharedDir, file), 'utf-8'));
      await prisma.adminSharedData.upsert({
        where: { key },
        create: { key, data },
        update: { data },
      });
      console.log(`  ✓ shared/${key}`);
    }
  }

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
