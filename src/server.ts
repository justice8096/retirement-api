import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { registerClerk, assertNoDevBypassUserInProd } from './middleware/auth.js';
import { rateLimitConfig, buildRedisStore } from './middleware/rate-limit.js';
import { initSentry, captureException } from './lib/sentry.js';
import { validateEncryptionConfig } from './middleware/encryption.js';
import { toValidationErrorPayload } from './lib/validation.js';
import { pickLocale } from './lib/locale.js';
import { registerSwagger } from './lib/swagger.js';

// Initialize Sentry before anything else
await initSentry();

// Validate encryption config on startup (warns in production if key missing)
validateEncryptionConfig();

// SAST M-NEW-01 — refuse to boot if a dev-bypass user exists in a prod DB.
await assertNoDevBypassUserInProd();

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
import feesRoutes from './routes/fees.js';
import glossaryRoutes from './routes/glossary.js';

const app = Fastify({
  logger: true,
  bodyLimit: 1_048_576, // 1 MB
  genReqId: () => randomUUID(),
  requestIdHeader: 'x-request-id',
});

// ─── Security Plugins ─────────────────────────────────────────────────────

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
  // Default `same-origin` blocks the SPA at a different origin (e.g. localhost:4200)
  // from reading JSON responses even when CORS permits them. `same-site` keeps CORP
  // strict enough to prevent cross-site resource inclusion while allowing the
  // paired dashboard and marketing-site origins to consume the API.
  crossOriginResourcePolicy: { policy: 'same-site' },
});
// Build Redis store for distributed rate limiting (falls back to in-memory)
let redisClient: { quit: () => Promise<void> } | undefined;
try {
  redisClient = await buildRedisStore() as { quit: () => Promise<void> } | undefined;
} catch (err) {
  app.log.warn(err, 'Failed to build Redis store for rate limiting — using in-memory');
}
await app.register(rateLimit, {
  ...rateLimitConfig,
  ...(redisClient ? { redis: redisClient } : {}),
});
await app.register(cookie);

// ─── Content Language (Dyslexia audit F-008) ─────────────────────────────
// Honor `Accept-Language` where possible instead of hard-coding `en`.
// Exposes the resolved locale on `request.locale` so route handlers can
// pass it to Intl.NumberFormat for locale-aware formatting (Dyscalculia F-007).
app.addHook('onRequest', (request, _reply, done) => {
  const header = request.headers['accept-language'];
  request.locale = pickLocale(Array.isArray(header) ? header[0] : header);

  // Dyscalculia F-202 — surface API-version negotiation on every request.
  // Default = 1 (whole-number percents on wire). Clients opt in to 2 with
  // `Accept-Version: 2` to receive decimal fractions on all percentage fields.
  const versionHeader = request.headers['accept-version'];
  const rawVersion = Array.isArray(versionHeader) ? versionHeader[0] : versionHeader;
  request.apiVersion = rawVersion === '2' ? 2 : 1;
  done();
});

app.addHook('onSend', (request, reply, payload, done) => {
  if (request.locale) {
    reply.header('Content-Language', request.locale);
  }
  done(null, payload);
});

// ─── Request Timing ──────────────────────────────────────────────────────

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

// ─── Auth (Clerk) ─────────────────────────────────────────────────────────

await registerClerk(app);

// ─── Global Error Handler ─────────────────────────────────────────────────

app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  // Suppress noisy error logging for expected errors. Log the full, developer-
  // oriented error server-side (Dyslexia F-010 — separate log from user-bound
  // text); the client sees a distinct plain-language envelope below.
  const isExpected = error.statusCode && error.statusCode < 500;
  if (!isExpected) {
    request.log.error({
      err: error,
      method: request.method,
      url: request.url,
      code: (error as unknown as { code?: string }).code,
    }, 'unhandled error');
  }

  // ── Zod / Fastify validation errors ──────────────────────────
  // Dyslexia F-002/F-007 + Dyscalculia F-008: transform raw Zod issues into
  // a stable `{ field, fieldLabel, message, code }` envelope. Full Zod
  // internals stay in the server log (above), not in the client response.
  if (error.validation) {
    return reply
      .code(400)
      .send(toValidationErrorPayload(error.validation as unknown as import('zod').ZodIssue[]));
  }

  // ── Body limit exceeded (413 Payload Too Large) ──────────────
  if (error.statusCode === 413 || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return reply.code(413).send({ error: 'Request body too large', limit: '1MB' });
  }

  // ── Invalid content type (415) ───────────────────────────────
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return reply.code(415).send({ error: 'Unsupported content type' });
  }

  // ── Invalid JSON body ────────────────────────────────────────
  if (error.statusCode === 400 && (error.code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH' || error.message?.includes('JSON'))) {
    return reply.code(400).send({ error: 'Invalid request body' });
  }

  // ── Rate limit exceeded ──────────────────────────────────────
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

  // ── Prisma known errors ──────────────────────────────────────
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

  // ── Redis / IO errors from rate-limit or cache ───────────────
  const errName = (error as unknown as { name?: string }).name || '';
  const errMsg = error.message || '';
  if (errName === 'MaxRetriesPerRequestError' || errMsg.includes('ECONNREFUSED') ||
      errMsg.includes('ECONNRESET') || errMsg.includes('Redis')) {
    request.log.warn({ err: errMsg }, 'Redis error — request allowed through');
    // Don't crash on Redis failures — let the request proceed without rate limiting
    return reply.code(503).send({ error: 'Service temporarily degraded' });
  }

  // ── Report 5xx errors to Sentry ──────────────────────────────
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

// ─── Routes ───────────────────────────────────────────────────────────────

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
await app.register(feesRoutes, { prefix: '/api/me/fees' });
await app.register(glossaryRoutes, { prefix: '/api/glossary' });

// ─── OpenAPI / Swagger (Dyslexia audit F-001) ─────────────────────────────
// Registers @fastify/swagger + swagger-ui when available; falls back to a
// static /api/openapi.json document otherwise. Never fatal — a missing UI
// must not prevent the API from coming up.
await registerSwagger(app);

// ─── Start ────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3000', 10);
try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ─── Scheduled Tasks ──────────────────────────────────────────────────────

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

// ─── Graceful Shutdown ───────────────────────────────────────────────────

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



