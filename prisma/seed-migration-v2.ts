/**
 * Migration seed: Transition from subscriptions to pay-per-update + contributions.
 *
 * This script:
 * 1. Creates DataRelease v1 (initial dataset, free) if it doesn't exist
 * 2. Grandfathers existing paid subscribers:
 *    - UserReleasePurchase for v1 (grandfathered)
 *    - UserFeatureUnlock matching their current tier (grandfathered)
 *    - UserBadge: founding_member
 * 3. Gives all free users access to v1 data release
 *
 * Safe to run multiple times (idempotent via upserts + unique constraints).
 *
 * Usage:
 *   npx tsx prisma/seed-migration-v2.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('=== Migration v2: Subscriptions → Pay-per-update ===\n');

  // 1. Create initial DataRelease (v1 = the dataset everyone already has)
  const release = await prisma.dataRelease.upsert({
    where: { version: 1 },
    update: {},
    create: {
      version: 1,
      title: 'Initial Dataset',
      description: 'The original 139-location retirement cost dataset.',
      priceUsd: 0, // Free — this is the baseline everyone already has
      publishedAt: new Date(),
    },
  });
  console.log(`DataRelease v1: ${release.id} (${release.title})`);

  // 2. Process all existing users
  const users = await prisma.user.findMany({
    select: { id: true, tier: true, email: true },
  });
  console.log(`\nProcessing ${users.length} users...\n`);

  let grandfathered = 0;
  let freeGranted = 0;

  for (const user of users) {
    const isPaid = user.tier === 'basic' || user.tier === 'premium' || user.tier === 'admin';

    // Everyone gets access to v1 data
    await prisma.userReleasePurchase.upsert({
      where: { userId_releaseId: { userId: user.id, releaseId: release.id } },
      update: {},
      create: {
        userId: user.id,
        releaseId: release.id,
        grantedReason: isPaid ? 'grandfathered' : 'admin_grant',
      },
    });

    if (isPaid) {
      // Grant feature unlock matching their current tier
      const featureSet = user.tier === 'premium' || user.tier === 'admin' ? 'premium' : 'basic';

      await prisma.userFeatureUnlock.upsert({
        where: { userId_featureSet: { userId: user.id, featureSet } },
        update: {},
        create: {
          userId: user.id,
          featureSet,
          unlockedVia: 'grandfathered',
        },
      });

      // Premium users also get basic unlock
      if (featureSet === 'premium') {
        await prisma.userFeatureUnlock.upsert({
          where: { userId_featureSet: { userId: user.id, featureSet: 'basic' } },
          update: {},
          create: {
            userId: user.id,
            featureSet: 'basic',
            unlockedVia: 'grandfathered',
          },
        });
      }

      // Award founding_member badge
      await prisma.userBadge.upsert({
        where: { userId_badgeKey: { userId: user.id, badgeKey: 'founding_member' } },
        update: {},
        create: {
          userId: user.id,
          badgeKey: 'founding_member',
        },
      });

      grandfathered++;
      console.log(`  ✓ ${user.email} (${user.tier}) → grandfathered with ${featureSet} + founding_member badge`);
    } else {
      freeGranted++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Grandfathered (paid → full access + badge): ${grandfathered}`);
  console.log(`  Free users (v1 data access granted): ${freeGranted}`);
  console.log(`  DataRelease v1 created: ✓`);
  console.log(`\nMigration complete.`);
}

main()
  .catch((e) => {
    console.error('Migration seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
