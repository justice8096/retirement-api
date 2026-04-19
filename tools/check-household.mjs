import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const profiles = await prisma.householdProfile.findMany({
  include: { members: { orderBy: { sortOrder: 'asc' } } },
});

console.log(`Found ${profiles.length} household profile(s):\n`);
for (const p of profiles) {
  console.log(`  userId: ${p.userId}`);
  console.log(`  planningStartYear: ${p.planningStartYear}`);
  console.log(`  adultsCount: ${p.adultsCount}`);
  console.log(`  targetAnnualIncome (encrypted): ${p.targetAnnualIncome ? '[set]' : 'null'}`);
  console.log(`  members (${p.members.length}):`);
  for (const m of p.members) {
    const age = new Date().getFullYear() - (m.birthYear ?? 0);
    console.log(`    - ${m.name || '(unnamed)'} · role=${m.role} · birthYear=${m.birthYear} · age=${age} · ssClaimAge=${m.ssClaimAge}`);
  }
  console.log();
}

await prisma.$disconnect();
