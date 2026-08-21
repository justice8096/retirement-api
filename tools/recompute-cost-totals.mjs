#!/usr/bin/env node
/**
 * recompute-cost-totals.mjs — one-shot backfill of the denormalized
 * AdminLocation.monthlyCostTotal after the single-healthcare-figure fix
 * (healthcarePreMedicare is an ALTERNATE to healthcare and is excluded
 * from the catalog baseline; see src/routes/admin.ts + prisma/seed.ts).
 *
 * Idempotent: recomputes every row from its own locationData.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const rows = await prisma.adminLocation.findMany({ select: { id: true, locationData: true, monthlyCostTotal: true } });
let changed = 0;
for (const row of rows) {
  const costs = row.locationData?.monthlyCosts ?? {};
  let total = 0;
  for (const [key, val] of Object.entries(costs)) {
    if (key === 'healthcarePreMedicare') continue;
    if (val && typeof val.typical === 'number') total += val.typical;
  }
  total = Math.round(total);
  if (total !== row.monthlyCostTotal) {
    await prisma.adminLocation.update({ where: { id: row.id }, data: { monthlyCostTotal: total } });
    changed++;
  }
}
console.log(`${rows.length} locations scanned, ${changed} totals updated.`);
await prisma.$disconnect();
