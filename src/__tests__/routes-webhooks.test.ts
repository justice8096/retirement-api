/**
 * Integration tests for Stripe webhook handler (POST /api/webhooks/stripe).
 *
 * Mocks Stripe signature verification and tests all handled event types.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
  process.env.STRIPE_PRICE_BASIC = 'price_basic_123';
  process.env.STRIPE_PRICE_PREMIUM = 'price_premium_456';
});

const mockStripe = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripe),
}));

vi.mock('../db/prisma.js', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    processedEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '../db/prisma.js';
import webhookRoutes from '../routes/webhooks.js';

function makeEvent(type: string, data: Record<string, unknown>) {
  return {
    id: `evt_${Date.now()}`,
    type,
    data: { object: data },
  };
}

describe('Webhook routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  function postWebhook(body = '{}') {
    return app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig_test_valid',
      },
    });
  }

  // ─── Signature Verification ──────────────────────────────────────

  describe('signature verification', () => {
    it('rejects request without stripe-signature header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/stripe',
        payload: '{}',
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe('Missing stripe-signature header');
    });

    it('rejects invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const res = await postWebhook();

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error).toBe('Invalid signature');
    });
  });

  // ─── checkout.session.completed ──────────────────────────────────

  describe('checkout.session.completed', () => {
    it('upgrades user to basic tier after checkout', async () => {
      const event = makeEvent('checkout.session.completed', {
        customer: 'cus_abc',
        subscription: 'sub_123',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_basic_123' } }] },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', stripeCustomerId: 'cus_abc' });
      prisma.user.update.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).received).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'basic' },
      });
    });

    it('upgrades user to premium tier after checkout', async () => {
      const event = makeEvent('checkout.session.completed', {
        customer: 'cus_abc',
        subscription: 'sub_456',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_premium_456' } }] },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', stripeCustomerId: 'cus_abc' });
      prisma.user.update.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'premium' },
      });
    });

    it('handles missing customer or subscription gracefully', async () => {
      const event = makeEvent('checkout.session.completed', {
        customer: null,
        subscription: null,
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('handles user not found for customer ID', async () => {
      const event = makeEvent('checkout.session.completed', {
        customer: 'cus_unknown',
        subscription: 'sub_789',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_basic_123' } }] },
      });
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── customer.subscription.updated ───────────────────────────────

  describe('customer.subscription.updated', () => {
    it('updates tier when subscription is active', async () => {
      const event = makeEvent('customer.subscription.updated', {
        customer: 'cus_abc',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium_456' } }] },
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'premium' },
      });
    });

    it('downgrades to free when subscription is not active', async () => {
      const event = makeEvent('customer.subscription.updated', {
        customer: 'cus_abc',
        status: 'past_due',
        items: { data: [{ price: { id: 'price_basic_123' } }] },
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'free' },
      });
    });
  });

  // ─── customer.subscription.deleted ───────────────────────────────

  describe('customer.subscription.deleted', () => {
    it('reverts user to free tier on cancellation', async () => {
      const event = makeEvent('customer.subscription.deleted', {
        customer: 'cus_abc',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'free' },
      });
    });

    it('handles user not found gracefully', async () => {
      const event = makeEvent('customer.subscription.deleted', {
        customer: 'cus_gone',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── invoice.payment_failed ──────────────────────────────────────

  describe('invoice.payment_failed', () => {
    it('acknowledges payment failure without changing tier', async () => {
      const event = makeEvent('invoice.payment_failed', {
        customer: 'cus_abc',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────

  describe('idempotency', () => {
    it('skips duplicate events', async () => {
      const event = makeEvent('checkout.session.completed', {
        customer: 'cus_abc',
        subscription: 'sub_123',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.processedEvent.findUnique.mockResolvedValue({ eventId: event.id });

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).duplicate).toBe(true);
      // Should NOT process the event
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('records event after processing', async () => {
      const event = makeEvent('invoice.payment_failed', {
        customer: 'cus_abc',
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      prisma.processedEvent.findUnique.mockResolvedValue(null);
      prisma.processedEvent.create.mockResolvedValue({});

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(prisma.processedEvent.create).toHaveBeenCalledWith({
        data: { eventId: event.id, eventType: 'invoice.payment_failed' },
      });
    });
  });

  // ─── Unhandled events ────────────────────────────────────────────

  describe('unhandled events', () => {
    it('returns received: true for unknown event types', async () => {
      const event = makeEvent('some.unknown.event', { foo: 'bar' });
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const res = await postWebhook();

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).received).toBe(true);
    });
  });
});
