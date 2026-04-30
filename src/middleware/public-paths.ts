/**
 * Public API path matcher.
 *
 * Used by the onRequest hook in `server.ts` to identify endpoints that do
 * not require Clerk authentication. The hook normalizes the `Accept` header
 * for matching paths to `application/json`, which prevents Clerk's dev
 * instance from triggering its handshake redirect (`HTTP 307` →
 * `https://<dev-instance>.clerk.accounts.dev/v1/client/handshake?
 * redirect_url=http://...`) on browser-style requests from non-browser
 * clients (uptime monitors, curl with browser UA, etc.).
 *
 * The handshake's `redirect_url` is hard-coded to `http://`, so axios-style
 * clients that follow redirects end up trying port 80 — manifesting as
 * `ECONNREFUSED <ip>:80` on monitors pointed at `/api/health/ready`.
 */

// Swagger UI registers at `/docs` and the JSON at `/documentation/json`
// (see src/lib/swagger.ts — `routePrefix: '/docs'` and @fastify/swagger's
// default `/documentation/...` paths). Both live at the root, NOT under
// `/api/`. The fallback OpenAPI route lives at `/api/openapi.json`.
const PUBLIC_API_PATTERNS: readonly RegExp[] = [
  /^\/api\/health(\/|$|\?)/,
  /^\/api\/glossary(\/|$|\?)/,
  /^\/api\/locations(\/|$|\?)/,
  /^\/api\/releases(\/|$|\?)/,
  /^\/api\/contributions(\/|$|\?)/,
  /^\/api\/badges(\/|$|\?)/,
  /^\/api\/webhooks(\/|$|\?)/,
  /^\/api\/openapi\.json(\?|$)/,
  /^\/docs(\/|$|\?)/,
  /^\/documentation(\/|$|\?)/,
];

export function isPublicApiPath(url: string): boolean {
  return PUBLIC_API_PATTERNS.some((p) => p.test(url));
}
