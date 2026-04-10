import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { registerClerk } from './middleware/auth.js';
import { rateLimitConfig, buildRedisStore } from './middleware/rate-limit.js';
import { initSentry, captureException } from './lib/sentry.js';
import { validateEncryptionConfig } from './middleware/encryption.js';

// Initialize Sentry before anything else
await initSentry();

// Validate encryption config on startup (warns in production if key missing)
validateEncryptionConfig();

import locationRoutes from './routes/locations.js';
import userRoutes from './routes/users.js';
import householdRoutes from './routes/household.js';
import financialRoutes from './routes/financial.js';
import withdrawalRoutes from './routes/withdrawal.js';
import preferencesRoutes from './routes/preferences.js';
import scenarioRoutes from './routes/scenarios.js';
import groceryRoutes from './routes/groceries.js';
import customLocationRoutes from './routes/custom-locations.js';
import adminRoutes from './routes/admin.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import healthRoutes from './routes/health.js';
import releaseRoutes from './routes/releases.js';
import contributionRoutes, { adminContributionRoutes } from './routes/contributions.js';
import badgeRoutes from './routes/badges.js';

const app = Fastify({
  logger: true,
  bodyLimit: 1_048_576, // 1 MB
  genReqId: () => randomUUID(),
  requestIdHeader: 'x-request-id',
});

// â”€â”€â”€ Security Plugins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Support multiple frontend origins via CORS_ORIGIN (comma-separated)
const corsOrigins = (process.env.CORS_ORIGIN || process.env.APP_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (corsOrigins.includes('*')) {
  console.warn('[security] CORS_ORIGIN=* is not allowed with credentials: true, using default');
  corsOrigins.splice(0, corsOrigins.length);
}
await app.register(cors, {
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true,
});
await app.register(helmet, {
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
});
// Build Redis store for distributed rate limiting (falls back to in-memory)
let redisClient: { quit: () => Promise<void> } | undefined;
try {
  redisClient = await buildRedisStore() as { quit: () => Promise<void> } | undefined;
} catch (err) {
  app.log.warn(err, 'Failed to build Redis store for rate limiting â€” using in-memory');
}
await app.register(rateLimit, {
  ...rateLimitConfig,
  ...(redisClient ? { redis: redisClient } : {}),
});
await app.register(cookie);

// â”€â”€â”€ Request Timing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.addHook('onRequest', (request, _reply, done) => {
  request.startTime = process.hrtime.bigint();
  done();
});

app.addHook('onResponse', (request, reply, done) => {
  if (request.startTime) {
    const ms = Number(process.hrtime.bigint() - request.startTime) / 1e6;
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${ms.toFixed(1)}ms`,
    }, 'request completed');
  }
  done();
});

// â”€â”€â”€ Auth (Clerk) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

await registerClerk(app);

// â”€â”€â”€ Global Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  // Suppress noisy error logging for expected errors
  const isExpected = error.statusCode && error.statusCode < 500;
  if (!isExpected) {
    request.log.error(error);
  }

  // â”€â”€ Zod / Fastify validation errors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error.validation) {
    return reply.code(400).send({ error: 'Validation error', details: error.validation });
  }

  // â”€â”€ Body limit exceeded (413 Payload Too Large) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error.statusCode === 413 || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return reply.code(413).send({ error: 'Request body too large', limit: '1MB' });
  }

  // â”€â”€ Invalid content type (415) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return reply.code(415).send({ error: 'Unsupported content type' });
  }

  // â”€â”€ Invalid JSON body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error.statusCode === 400 && (error.code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH' || error.message?.includes('JSON'))) {
    return reply.code(400).send({ error: 'Invalid request body' });
  }

  // â”€â”€ Rate limit exceeded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error.statusCode === 429 || error.statusCode === 403 ||
      (error as unknown as { code?: string }).code === 'FST_ERR_RATE_LIMIT' ||
      error.message?.includes('rate limit') || error.message?.includes('Rate limit') ||
      error.message?.includes('Too many')) {
    const retryAfter = (error as unknown as { retryAfter?: number }).retryAfter || 60;
    reply.header('retry-after', String(retryAfter));
    return reply.code(error.statusCode || 429).send({
      error: 'Too many requests',
      retryAfter,
      limit: (error as unknown as { limit?: number }).limit,
    });
  }

  // â”€â”€ Prisma known errors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prismaCode = (error as unknown as { code?: string }).code;
  if (prismaCode === 'P2025') {
    return reply.code(404).send({ error: 'Record not found' });
  }
  if (prismaCode === 'P2002') {
    return reply.code(409).send({ error: 'Duplicate record' });
  }
  // Prisma connection errors
  if (prismaCode === 'P2024' || prismaCode === 'P1001' || prismaCode === 'P1002') {
    captureException(error, { method: request.method, url: request.url });
    return reply.code(503).send({ error: 'Service temporarily unavailable' });
  }

  // â”€â”€ Redis / IO errors from rate-limit or cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const errName = (error as unknown as { name?: string }).name || '';
  const errMsg = error.message || '';
  if (errName === 'MaxRetriesPerRequestError' || errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ECONNRESET') || errMsg.includes('Redis')) {
    request.log.warn({ err: errMsg }, 'Redis error â€” request allowed through');
    // Don't crash on Redis failures â€” let the request proceed without rate limiting
    return reply.code(503).send({ error: 'Service temporarily degraded' });
  }

  // â”€â”€ Report 5xx errors to Sentry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    captureException(error, {
      method: request.method,
      url: request.url,
      userId: request.userId,
    });
  }
  const message = statusCode === 500 ? 'Internal server error' : error.message;
  return reply.code(statusCode).send({ error: message });
});

// â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

await app.register(healthRoutes, { prefix: '/api' });
await app.register(locationRoutes, { prefix: '/api/locations' });
await app.register(userRoutes, { prefix: '/api/me' });
await app.register(householdRoutes, { prefix: '/api/me/household' });
await app.register(financialRoutes, { prefix: '/api/me/financial' });
await app.register(withdrawalRoutes, { prefix: '/api/me/withdrawal' });
await app.register(preferencesRoutes, { prefix: '/api/me/preferences' });
await app.register(scenarioRoutes, { prefix: '/api/me/scenarios' });
await app.register(groceryRoutes, { prefix: '/api/me/groceries' });
await app.register(customLocationRoutes, { prefix: '/api/me/locations' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(adminContributionRoutes, { prefix: '/api/admin/contributions' });
await app.register(billingRoutes, { prefix: '/api/billing' });
await app.register(webhookRoutes, { prefix: '/api/webhooks' });
await app.register(releaseRoutes, { prefix: '/api/releases' });
await app.register(contributionRoutes, { prefix: '/api/contributions' });
await app.register(badgeRoutes, { prefix: '/api/badges' });

// â”€â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const port = parseInt(process.env.PORT || '3000', 10);
try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// â”€â”€â”€ Scheduled Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Cleanup old processed webhook events daily (24h interval)
import { cleanupProcessedEvents } from './routes/webhooks.js';

let cleanupInterval: ReturnType<typeof setInterval>;
function startCleanupScheduler(): void {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  // Run once shortly after startup, then every 24h
  setTimeout(async () => {
    try {
      const count = await cleanupProcessedEvents(7);
      if (count > 0) app.log.info({ count }, 'Cleaned up old processed webhook events');
    } catch (err) {
      app.log.warn(err, 'Failed to cleanup processed events');
    }
  }, 60_000); // 1 minute after startup

  cleanupInterval = setInterval(async () => {
    try {
      const count = await cleanupProcessedEvents(7);
      if (count > 0) app.log.info({ count }, 'Cleaned up old processed webhook events');
    } catch (err) {
      app.log.warn(err, 'Failed to cleanup processed events');
    }
  }, TWENTY_FOUR_HOURS);
}

startCleanupScheduler();

// â”€â”€â”€ Graceful Shutdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Received signal, shutting down gracefully');
  if (cleanupInterval) clearInterval(cleanupInterval);
  try {
    await app.close();
    if (redisClient) {
      await redisClient.quit().catch(() => {});
      app.log.info('Redis connection closed');
    }
    app.log.info('Server closed');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
