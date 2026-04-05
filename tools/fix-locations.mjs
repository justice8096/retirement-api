import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // Remove duplicate Austin
  const deleted = await prisma.adminLocation.deleteMany({ where: { id: 'us-austin-tx' } });
  console.log('Deleted us-austin-tx:', deleted.count, 'rows');

  // Add Camden NJ
  const camdenData = JSON.parse(fs.readFileSync('data/locations/us-camden-nj/location.json', 'utf-8'));
  const total = Object.values(camdenData.monthlyCosts || {}).reduce(
    (sum, c) => sum + (c.typical || 0), 0
  );

  await prisma.adminLocation.upsert({
    where: { id: 'us-camden-nj' },
    update: {
      locationData: camdenData,
      name: camdenData.name,
      country: camdenData.country,
      region: camdenData.region || '',
      currency: 'USD',
      monthlyCostTotal: Math.round(total),
    },
    create: {
      id: 'us-camden-nj',
      locationData: camdenData,
      name: camdenData.name,
      country: camdenData.country,
      region: camdenData.region || '',
      currency: 'USD',
      monthlyCostTotal: Math.round(total),
    },
  });
  console.log('Added Camden, NJ — monthly cost:', Math.round(total));

  // Verify
  const count = await prisma.adminLocation.count();
  const austin = await prisma.adminLocation.findMany({ where: { name: { contains: 'Austin' } }, select: { id: true, name: true } });
  const camden = await prisma.adminLocation.findMany({ where: { name: { contains: 'Camden' } }, select: { id: true, name: true } });
  console.log('Total locations:', count);
  console.log('Austin entries:', austin.map(a => `${a.name} (${a.id})`));
  console.log('Camden entries:', camden.map(c => `${c.name} (${c.id})`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
