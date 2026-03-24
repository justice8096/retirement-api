/**
 * Stripe webhook handler.
 *
 * Handles subscription lifecycle events to keep the local user tier in sync
 * with Stripe billing state.
 *
 * Environment:
 *   STRIPE_SECRET_KEY      — Stripe API key
 *   STRIPE_WEBHOOK_SECRET  — Webhook endpoint signing secret
 *   STRIPE_PRICE_BASIC     — Price ID for basic tier
 *   STRIPE_PRICE_PREMIUM   — Price ID for premium tier
 */
import Stripe from 'stripe';
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import prisma from '../db/prisma.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Map Stripe price IDs to subscription tiers
function priceToTier(priceId: string | undefined): string {
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return 'premium';
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'basic';
  return 'free';
}

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
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

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer, // raw Buffer
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      request.log.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Idempotency: skip if already processed
    try {
      const existing = await prisma.processedEvent.findUnique({
        where: { eventId: event.id },
      });
      if (existing) {
        request.log.info({ eventId: event.id }, 'Duplicate webhook event, skipping');
        return { received: true, duplicate: true };
      }
    } catch {
      // Table may not exist yet (pre-migration) — proceed without idempotency
    }

    request.log.info({ eventId: event.id, type: event.type }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, request.log);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, request.log);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, request.log);
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

    // Record as processed
    try {
      await prisma.processedEvent.create({
        data: { eventId: event.id, eventType: event.type },
      });
    } catch {
      // Ignore if table doesn't exist yet or unique constraint (race condition)
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
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!customerId || !subscriptionId) return;

  // Get the subscription to find the price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = priceToTier(priceId);

  // Find user by Stripe customer ID and update tier
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier },
    });
    log.info({ userId: user.id, tier }, 'User tier updated after checkout');
  } else {
    log.warn({ customerId }, 'No user found for Stripe customer');
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, log: FastifyBaseLogger): Promise<void> {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = subscription.status === 'active' ? priceToTier(priceId) : 'free';

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier },
    });
    log.info({ userId: user.id, tier, status: subscription.status }, 'Subscription updated');
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, log: FastifyBaseLogger): Promise<void> {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: 'free' },
    });
    log.info({ userId: user.id }, 'Subscription deleted, reverted to free tier');
  }
}
