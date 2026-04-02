/**
 * Stripe billing routes — one-time feature purchases and legacy subscription management.
 *
 * New model: Users pay once for feature access (basic $9, premium $19) OR earn
 * it through contributions. Subscriptions are grandfathered but no longer sold.
 *
 * Environment:
 *   STRIPE_SECRET_KEY            — Stripe API key
 *   STRIPE_PRICE_FEATURE_BASIC   — One-time Price ID for basic feature set
 *   STRIPE_PRICE_FEATURE_PREMIUM — One-time Price ID for premium feature set
 *   APP_URL                      — Frontend URL for redirect
 */
import { z } from 'zod';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const FEATURE_PRICES: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_FEATURE_BASIC,
  premium: process.env.STRIPE_PRICE_FEATURE_PREMIUM,
};

const featureCheckoutSchema = z.object({
  featureSet: z.enum(['basic', 'premium']),
}).strict();

export default async function billingRoutes(app: FastifyInstance): Promise<void> {
  if (!stripe) {
    app.log.warn('Stripe not configured — billing routes disabled');
    return;
  }
  app.addHook('preHandler', requireAuth);

  // POST /api/billing/checkout-feature — one-time purchase for feature set
  app.post('/checkout-feature', async (request, reply) => {
    const parsed = featureCheckoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { featureSet } = parsed.data;
    const priceId = FEATURE_PRICES[featureSet];
    if (!priceId) {
      return reply.code(400).send({ error: `No Stripe price configured for ${featureSet}` });
    }

    // Check if already unlocked
    const existing = await prisma.userFeatureUnlock.findUnique({
      where: { userId_featureSet: { userId: request.userId, featureSet } },
    });
    if (existing) {
      return reply.code(409).send({ error: `${featureSet} features already unlocked` });
    }

    // Ensure user has a Stripe customer ID
    let customerId = request.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.user.email,
        metadata: { userId: request.userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: request.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/#/settings?feature_purchased=${featureSet}`,
      cancel_url: `${appUrl}/#/settings?cancelled=true`,
      metadata: {
        userId: request.userId,
        type: 'feature',
        featureSet,
      },
    });

    return { url: session.url, sessionId: session.id };
  });

  // POST /api/billing/portal — Stripe Customer Portal (legacy subscription management)
  app.post('/portal', async (request, reply) => {
    const customerId = request.user.stripeCustomerId;
    if (!customerId) {
      return reply.code(400).send({ error: 'No billing account found' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/#/settings`,
    });

    return { url: session.url };
  });

  // GET /api/billing/status — comprehensive billing/access status
  app.get('/status', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');

    const [featureUnlocks, releasePurchases, latestRelease, badges, isFoundingMember] = await Promise.all([
      prisma.userFeatureUnlock.findMany({
        where: { userId: request.userId },
        select: { featureSet: true, unlockedVia: true },
      }),
      prisma.userReleasePurchase.findMany({
        where: { userId: request.userId },
        include: { release: { select: { version: true } } },
      }),
      prisma.dataRelease.findFirst({
        where: { publishedAt: { not: null } },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
      prisma.userBadge.findMany({
        where: { userId: request.userId },
        select: { badgeKey: true },
      }),
      prisma.userBadge.findFirst({
        where: { userId: request.userId, badgeKey: 'founding_member' },
      }),
    ]);

    return {
      tier: request.user.tier, // Legacy — admin check still uses this
      featureUnlocks: featureUnlocks.map((u) => u.featureSet),
      purchasedReleases: releasePurchases.map((p) => p.release.version),
      latestRelease: latestRelease?.version ?? 0,
      isFoundingMember: !!isFoundingMember,
      badges: badges.map((b) => b.badgeKey),
      stripeCustomerId: request.user.stripeCustomerId ? '***' : null,
    };
  });
}
