/**
 * Stripe billing routes — checkout session creation and subscription management.
 *
 * Environment:
 *   STRIPE_SECRET_KEY      — Stripe API key
 *   STRIPE_PRICE_BASIC     — Price ID for basic tier
 *   STRIPE_PRICE_PREMIUM   — Price ID for premium tier
 *   APP_URL                — Frontend URL for redirect
 */
import { z } from 'zod';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const ALLOWED_PRICES = new Set(
  [process.env.STRIPE_PRICE_BASIC, process.env.STRIPE_PRICE_PREMIUM].filter(Boolean) as string[]
);

const checkoutSchema = z.object({
  priceId: z.string().min(1).max(200),
}).strict();

export default async function billingRoutes(app: FastifyInstance): Promise<void> {
  if (!stripe) {
    app.log.warn('Stripe not configured — billing routes disabled');
    return;
  }
  app.addHook('preHandler', requireAuth);

  // POST /api/billing/checkout — create a Stripe Checkout Session
  app.post('/checkout', async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { priceId } = parsed.data;
    if (!ALLOWED_PRICES.has(priceId)) {
      return reply.code(400).send({ error: 'Invalid price ID' });
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
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/#/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#/settings?cancelled=true`,
      metadata: { userId: request.userId },
    });

    return { url: session.url, sessionId: session.id };
  });

  // POST /api/billing/portal — create a Stripe Customer Portal session
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

  // GET /api/billing/status — current subscription status
  app.get('/status', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return {
      tier: request.user.tier,
      stripeCustomerId: request.user.stripeCustomerId ? '***' : null,
    };
  });
}
