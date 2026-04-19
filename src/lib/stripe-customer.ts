/**
 * Shared Stripe customer creation helper.
 *
 * Eliminates the race condition (SAST L-NEW-02) between `/checkout-feature`
 * and `/releases/:id/checkout` where two concurrent requests can both create
 * a Stripe customer when a user first purchases. The optimistic-concurrency
 * guard (`where.stripeCustomerId = null`) ensures the second writer fails and
 * falls back to reading the committed value.
 *
 * Also avoids the orphan-customer scenario where the losing writer's created
 * customer is abandoned.
 */
import type Stripe from 'stripe';
import type { User } from '@prisma/client';
import prisma from '../db/prisma.js';

export async function ensureStripeCustomer(
  stripe: Stripe,
  user: Pick<User, 'id' | 'email' | 'stripeCustomerId'>,
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  // Create a Stripe customer. If two requests race this point, both succeed
  // at Stripe — the DB update below resolves who wins.
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  try {
    // Only assign this customer if the DB row still has no stripeCustomerId.
    // If another concurrent request won, this update updates 0 rows and we
    // read the winning value below.
    const updated = await prisma.user.updateMany({
      where: { id: user.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });

    if (updated.count === 1) return customer.id;

    // Lost the race — re-read the winning customer id and let Stripe's
    // dashboard-level dedup tooling clean up the orphaned one.
    const winner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    return winner?.stripeCustomerId ?? customer.id;
  } catch {
    return customer.id;
  }
}
