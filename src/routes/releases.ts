/**
 * Data release routes — list published releases and purchase access.
 *
 * Releases represent versioned data updates. Users pay once per release
 * to access updated location data.
 */
import { z } from 'zod';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export default async function releaseRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/releases — list published releases (public, with purchased flag for auth users)
  app.get('/', async (request, _reply) => {
    const releases = await prisma.dataRelease.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });

    // If user is authenticated, check which releases they own
    let purchasedIds: Set<string> = new Set();
    try {
      // Try to extract auth — this is a public endpoint so auth is optional
      const authHeader = request.headers.authorization;
      if (authHeader) {
        // requireAuth would set request.userId, but we don't want to block on auth failure
        // Instead, query purchases for all releases and let the frontend know
        await requireAuth(request, _reply);
        if (request.userId) {
          const purchases = await prisma.userReleasePurchase.findMany({
            where: { userId: request.userId },
            select: { releaseId: true },
          });
          purchasedIds = new Set(purchases.map((p) => p.releaseId));
        }
      }
    } catch {
      // Auth failed — that's fine, just don't include purchase info
    }

    return releases.map((r) => ({
      id: r.id,
      version: r.version,
      title: r.title,
      description: r.description,
      priceUsd: r.priceUsd,
      publishedAt: r.publishedAt,
      purchased: purchasedIds.has(r.id),
    }));
  });

  // GET /api/releases/current — latest published release version
  app.get('/current', async (_request, _reply) => {
    const latest = await prisma.dataRelease.findFirst({
      where: { publishedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { version: true, title: true, publishedAt: true },
    });
    return latest ?? { version: 0, title: 'No releases', publishedAt: null };
  });

  // POST /api/releases/:id/checkout — one-time Stripe payment for a release
  app.post('/:id/checkout', { preHandler: requireAuth }, async (request, reply) => {
    if (!stripe) {
      return reply.code(503).send({ error: 'Stripe not configured' });
    }

    const { id } = request.params as { id: string };

    const release = await prisma.dataRelease.findUnique({ where: { id } });
    if (!release || !release.publishedAt) {
      return reply.code(404).send({ error: 'Release not found' });
    }

    // Check if already purchased
    const existing = await prisma.userReleasePurchase.findUnique({
      where: { userId_releaseId: { userId: request.userId, releaseId: id } },
    });
    if (existing) {
      return reply.code(409).send({ error: 'Already purchased' });
    }

    // Free releases — grant immediately
    if (release.priceUsd === 0) {
      await prisma.userReleasePurchase.create({
        data: {
          userId: request.userId,
          releaseId: id,
          grantedReason: 'purchase',
        },
      });
      return { purchased: true, free: true };
    }

    // Paid release — create Stripe checkout
    if (!release.stripePriceId) {
      return reply.code(500).send({ error: 'Release has no Stripe price configured' });
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
      line_items: [{ price: release.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/#/settings?release_purchased=${release.version}`,
      cancel_url: `${appUrl}/#/settings?cancelled=true`,
      metadata: {
        userId: request.userId,
        type: 'release',
        releaseId: id,
      },
    });

    return { url: session.url, sessionId: session.id };
  });
}
