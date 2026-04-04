/**
 * Stripe webhook handler.
 *
 * Handles both legacy subscription events (grandfathered users) and new
 * one-time payment events for releases and feature purchases.
 *
 * Environment:
 *   STRIPE_SECRET_KEY      — Stripe API key
 *   STRIPE_WEBHOOK_SECRET  — Webhook endpoint signing secret
 */
import Stripe from 'stripe';
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import prisma from '../db/prisma.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
  if (!stripe) {
    app.log.warn('Stripe not configured — webhook routes disabled');
    return;
  }
  // Stripe sends raw body — must parse it ourselves for signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  // POST /api/webhooks/stripe
  app.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string | undefined;
    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      request.log.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook verification not configured' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer, // raw Buffer
        sig,
        webhookSecret,
      );
    } catch (err) {
      request.log.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    request.log.info({ eventId: event.id, type: event.type }, 'Stripe webhook received');

    // Idempotency: insert first with unique constraint to prevent race conditions
    try {
      await prisma.processedEvent.create({
        data: { eventId: event.id, eventType: event.type },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        request.log.info({ eventId: event.id }, 'Duplicate webhook event, skipping');
        return { received: true, duplicate: true };
      }
      // Table may not exist yet (pre-migration) — proceed without idempotency
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, request.log);
        break;
      }

      case 'customer.subscription.updated': {
        // Legacy: grandfathered subscriptions — no-op (don't change tiers)
        request.log.info('Legacy subscription.updated — no tier changes for grandfathered users');
        break;
      }

      case 'customer.subscription.deleted': {
        // Legacy: don't downgrade grandfathered users
        const subscription = event.data.object as Stripe.Subscription;
        request.log.info(
          { customerId: subscription.customer },
          'Legacy subscription.deleted — grandfathered users retain access'
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        request.log.warn({ customerId: invoice.customer }, 'Payment failed');
        break;
      }

      default:
        request.log.info({ type: event.type }, 'Unhandled webhook event type');
    }

    return { received: true };
  });
}

/**
 * Cleanup old processed events (call periodically, e.g., daily cron).
 * Keeps events for 7 days to handle delayed retries.
 */
export async function cleanupProcessedEvents(olderThanDays = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const { count } = await prisma.processedEvent.deleteMany({
    where: { processedAt: { lt: cutoff } },
  });
  return count;
}

// ─── Event Handlers ───────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, log: FastifyBaseLogger): Promise<void> {
  const metadataType = session.metadata?.type;
  const userId = session.metadata?.userId;

  if (!userId) {
    // Legacy checkout without metadata — try subscription flow
    await handleLegacyCheckout(session, log);
    return;
  }

  if (metadataType === 'release') {
    // One-time payment for a data release
    const releaseId = session.metadata?.releaseId;
    if (!releaseId) {
      log.warn({ sessionId: session.id }, 'Release checkout missing releaseId in metadata');
      return;
    }

    try {
      await prisma.userReleasePurchase.upsert({
        where: { userId_releaseId: { userId, releaseId } },
        update: {},
        create: { userId, releaseId, grantedReason: 'purchase' },
      });
      log.info({ userId, releaseId }, 'Release purchase recorded');
    } catch (err) {
      log.error({ err: (err as Error).message, userId, releaseId }, 'Failed to record release purchase');
    }

  } else if (metadataType === 'feature') {
    // One-time payment for feature access
    const featureSet = session.metadata?.featureSet as 'basic' | 'premium' | undefined;
    if (!featureSet || (featureSet !== 'basic' && featureSet !== 'premium')) {
      log.warn({ sessionId: session.id }, 'Feature checkout missing valid featureSet in metadata');
      return;
    }

    try {
      await prisma.userFeatureUnlock.upsert({
        where: { userId_featureSet: { userId, featureSet } },
        update: {},
        create: { userId, featureSet, unlockedVia: 'purchase' },
      });

      // If purchasing premium, also grant basic
      if (featureSet === 'premium') {
        await prisma.userFeatureUnlock.upsert({
          where: { userId_featureSet: { userId, featureSet: 'basic' } },
          update: {},
          create: { userId, featureSet: 'basic', unlockedVia: 'purchase' },
        });
      }

      log.info({ userId, featureSet }, 'Feature unlock recorded');
    } catch (err) {
      log.error({ err: (err as Error).message, userId, featureSet }, 'Failed to record feature unlock');
    }

  } else {
    // Unknown metadata type — fall back to legacy
    await handleLegacyCheckout(session, log);
  }
}

/**
 * Legacy handler for subscription-based checkouts (before migration).
 * Keeps backward compat during transition period.
 */
async function handleLegacyCheckout(session: Stripe.Checkout.Session, log: FastifyBaseLogger): Promise<void> {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!customerId || !subscriptionId) return;

  // Get the subscription to find the price
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;

  let tier: 'free' | 'basic' | 'premium' = 'free';
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) tier = 'premium';
  else if (priceId === process.env.STRIPE_PRICE_BASIC) tier = 'basic';

  // Find user by Stripe customer ID and update tier
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier },
    });
    log.info({ userId: user.id, tier }, 'Legacy: user tier updated after checkout');
  } else {
    log.warn({ customerId }, 'No user found for Stripe customer');
  }
}
