/**
 * Tests for the public-API-path matcher used by server.ts to suppress
 * Clerk's dev-instance handshake on monitoring endpoints.
 */
import { describe, it, expect } from 'vitest';
import { isPublicApiPath } from '../middleware/public-paths.js';

describe('isPublicApiPath', () => {
  it.each([
    '/api/health',
    '/api/health/ready',
    '/api/health/cleanup',
    '/api/health?since=2026-04-01',
    '/api/glossary',
    '/api/glossary/HSA',
    '/api/locations',
    '/api/locations/12345',
    '/api/releases',
    '/api/releases/v1.2.3',
    '/api/contributions',
    '/api/contributions/abc',
    '/api/badges',
    '/api/webhooks/stripe',
    '/api/openapi.json',
    '/api/openapi.json?v=2',
    // Swagger UI registers at /docs (routePrefix in src/lib/swagger.ts)
    '/docs',
    '/docs/',
    '/docs/static/swagger-ui.css',
    // @fastify/swagger default JSON path
    '/documentation',
    '/documentation/json',
    '/documentation/json?v=2',
  ])('matches public path: %s', (path) => {
    expect(isPublicApiPath(path)).toBe(true);
  });

  it.each([
    '/api/me',
    '/api/me/household',
    '/api/me/financial/holdings',
    '/api/admin',
    '/api/admin/contributions',
    '/api/billing/checkout',
    // /api/docs was the OLD (incorrect) path — Swagger UI is actually at
    // /docs, not /api/docs. Confirm nothing under /api/docs leaks public.
    '/api/docs',
    '/api/docs/static/swagger-ui.css',
    // Avoid false-positives where a public prefix appears as a substring
    // of an unrelated path. Anchoring on `^/api/<name>` (no leading slash
    // before "api") prevents this.
    '/healthz',
    '/api/healthcheck-v2',
    '/api/locations-private',
    '/api/badges2',
    '/api/health-secrets/admin',
    // /docs and /documentation must be exact-prefix to avoid catching
    // hypothetical sibling paths.
    '/docsarchive',
    '/documentationsystem',
  ])('does not match auth-required or near-miss path: %s', (path) => {
    expect(isPublicApiPath(path)).toBe(false);
  });

  it('handles empty / malformed input safely', () => {
    expect(isPublicApiPath('')).toBe(false);
    expect(isPublicApiPath('/')).toBe(false);
    expect(isPublicApiPath('/api/')).toBe(false);
  });
});
