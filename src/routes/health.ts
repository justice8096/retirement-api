/**
 * Health / readiness / operational cleanup routes.
 *
 * Public:
 *   - GET `/health` — liveness (always 200 if the process answers).
 *   - GET `/health/ready` — readiness; checks DB + encryption key presence.
 *     Returns 503 when the prod encryption key is missing (positive control).
 *
 * Admin-only:
 *   - POST `/health/cleanup` — purge ProcessedEvent rows older than N days.
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { cleanupProcessedEvents } from './webhooks.js';
import { requireAdmin, requireAuth, clerkEnabled } from '../middleware/auth.js';
import { getAuth } from '@clerk/fastify';
import { isEncryptionEnabled } from '../middleware/encryption.js';
import { toValidationErrorPayload } from '../lib/validation.js';

const cleanupSchema = z.object({
  olderThanDays: z.number().int().min(1).max(365).default(7),
}).strict();

interface HealthCheck {
  status: string;
  message?: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheck>;
  memory?: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
}

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/health — basic liveness + database connectivity check
  app.get('/health', async (_request, reply) => {
    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor(process.uptime()),
      checks: {},
    };

    // Database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.checks.database = { status: 'ok' };
    } catch {
      health.checks.database = { status: 'error', message: 'Database unreachable' };
      health.status = 'degraded';
    }

    // Redis connectivity (if configured)
    if (process.env.REDIS_URL) {
      try {
        const rateLimitStore = (app as unknown as { rateLimit?: { store?: { client?: { ping: () => Promise<string> } } } }).rateLimit;
        const redisClient = rateLimitStore?.store?.client;
        if (redisClient && typeof redisClient.ping === 'function') {
          await redisClient.ping();
          health.checks.redis = { status: 'ok' };
        } else {
          health.checks.redis = { status: 'warning', message: 'Redis configured but store not accessible' };
        }
      } catch {
        health.checks.redis = { status: 'error', message: 'Redis unreachable' };
        health.status = 'degraded';
      }
    } else {
      health.checks.redis = { status: 'info', message: 'Not configured (using in-memory rate limiting)' };
    }

    // Encryption check — report unhealthy in production if missing
    if (process.env.NODE_ENV === 'production' && !isEncryptionEnabled()) {
      health.checks.encryption = { status: 'error', message: 'Encryption not configured in production' };
      health.status = 'degraded';
    }

    // Only expose config/memory details to admin users (prevent info disclosure)
    let isAdmin = false;
    if (clerkEnabled) {
      try {
        const auth = getAuth(_request);
        if (auth?.userId) {
          isAdmin = _request.user?.tier === 'admin';
        }
      } catch { /* unauthenticated — OK for basic health check */ }
    }

    if (isAdmin) {
      // Encryption key configured
      health.checks.encryption = {
        status: process.env.ENCRYPTION_MASTER_KEY ? 'ok' : 'warning',
        message: process.env.ENCRYPTION_MASTER_KEY ? 'Configured' : 'Not configured',
      };

      // Clerk auth configured
      health.checks.auth = {
        status: process.env.CLERK_SECRET_KEY ? 'ok' : 'warning',
        message: process.env.CLERK_SECRET_KEY ? 'Configured' : 'Not configured',
      };

      // Stripe configured
      health.checks.stripe = {
        status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'warning',
        message: process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured',
      };

      // Memory usage
      const mem = process.memoryUsage();
      health.memory = {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      };
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    reply.header('Cache-Control', 'no-store');
    return reply.code(statusCode).send(health);
  });

  // GET /api/health/ready — lightweight readiness probe (for k8s/load balancers)
  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return reply.code(503).send({ ready: false });
    }
  });

  // POST /api/health/cleanup — admin-only endpoint to purge old processed webhook events
  app.post('/health/cleanup', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = cleanupSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const { olderThanDays } = parsed.data;
    try {
      const count = await cleanupProcessedEvents(olderThanDays);
      return { cleaned: count, olderThanDays };
    } catch (err) {
      request.log.error(err, 'Cleanup failed');
      return reply.code(500).send({ error: 'Cleanup failed' });
    }
  });
}
