import type { FastifyInstance } from 'fastify';

/**
 * Best-effort Swagger / OpenAPI registration.
 *
 * Addresses Dyslexia audit F-001 (no OpenAPI spec — dyslexic developers must
 * read route files directly). Registers `@fastify/swagger` +
 * `@fastify/swagger-ui` when they're installed. When the deps are missing
 * we fall back to a minimal hand-written `/api/openapi.json` so clients can
 * still discover the surface.
 */
export async function registerSwagger(app: FastifyInstance): Promise<boolean> {
  try {
    // Optional deps — resolve by name at runtime so missing-module errors are
    // non-fatal. Typed as unknown because the packages may not be installed
    // at typecheck time.
    const swaggerModName = '@fastify/swagger';
    const swaggerUiModName = '@fastify/swagger-ui';
    const swaggerMod = (await import(/* @vite-ignore */ swaggerModName).catch(
      () => null,
    )) as unknown as { default: unknown } | null;
    const swaggerUiMod = (await import(/* @vite-ignore */ swaggerUiModName).catch(
      () => null,
    )) as unknown as { default: unknown } | null;

    if (!swaggerMod || !swaggerUiMod) {
      app.log.warn(
        'Swagger packages not installed — serving minimal /api/openapi.json fallback. ' +
          'Run `npm install @fastify/swagger @fastify/swagger-ui` for the full UI.',
      );
      registerFallbackOpenApi(app);
      return false;
    }

    const swaggerPlugin = swaggerMod.default;
    const swaggerUiPlugin = swaggerUiMod.default;

    await app.register(swaggerPlugin as never, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'Retirement API',
          description:
            'REST API for the retirement planning platform. See /api/glossary for plain-language definitions of financial terms.',
          version: '0.1.0',
        },
        servers: [{ url: '/' }],
        tags: [
          { name: 'health', description: 'Liveness and readiness' },
          { name: 'locations', description: 'Public location data' },
          { name: 'me', description: 'Authenticated user resources' },
          { name: 'glossary', description: 'Plain-language financial definitions' },
          { name: 'billing', description: 'Stripe checkout and portal' },
          { name: 'admin', description: 'Administrative endpoints' },
        ],
      },
    });

    await app.register(swaggerUiPlugin as never, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });

    app.log.info('Swagger registered — UI at /docs, JSON at /documentation/json');
    return true;
  } catch (err) {
    app.log.warn({ err }, 'Swagger registration failed — falling back to static /api/openapi.json');
    registerFallbackOpenApi(app);
    return false;
  }
}

/**
 * Minimal OpenAPI 3.1 document served when `@fastify/swagger` isn't available.
 * Covers the public + known authenticated surface. Dyslexic developers get
 * a searchable JSON spec; Swagger-UI consumers can paste the URL.
 */
function registerFallbackOpenApi(app: FastifyInstance): void {
  app.get('/api/openapi.json', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return {
      openapi: '3.1.0',
      info: {
        title: 'Retirement API',
        version: '0.1.0',
        description:
          'Minimal static OpenAPI document. For the full interactive UI, install @fastify/swagger and @fastify/swagger-ui (see src/lib/swagger.ts).',
      },
      servers: [{ url: '/' }],
      paths: {
        '/api/health': {
          get: { summary: 'Liveness probe', tags: ['health'] },
        },
        '/api/health/ready': {
          get: { summary: 'Readiness probe', tags: ['health'] },
        },
        '/api/glossary': {
          get: {
            summary: 'Plain-language financial term definitions',
            tags: ['glossary'],
            parameters: [
              {
                name: 'key',
                in: 'query',
                required: false,
                schema: { type: 'string' },
                description: 'Return a single term instead of the full list.',
              },
            ],
          },
        },
        '/api/locations': {
          get: { summary: 'Paginated public locations', tags: ['locations'] },
        },
        '/api/me': {
          get: { summary: 'Current user profile', tags: ['me'] },
          put: { summary: 'Update profile', tags: ['me'] },
          delete: { summary: 'GDPR-erase account', tags: ['me'] },
        },
        '/api/me/financial': {
          get: { summary: 'Portfolio + FX + SS settings', tags: ['me'] },
          put: { summary: 'Update financial settings', tags: ['me'] },
        },
        '/api/me/withdrawal': {
          get: {
            summary:
              'Withdrawal strategy (decimal-fraction rates; response includes _units + explanation)',
            tags: ['me'],
          },
          put: { summary: 'Update withdrawal strategy', tags: ['me'] },
          delete: { summary: 'Reset to defaults', tags: ['me'] },
        },
        '/api/me/preferences': {
          get: { summary: 'User preferences (includes accessibility)', tags: ['me'] },
          patch: { summary: 'Shallow-merge update', tags: ['me'] },
        },
        '/api/me/scenarios': {
          get: { summary: 'List saved scenarios', tags: ['me'] },
          post: {
            summary: 'Create scenario (supports monte_carlo_v1 sub-schema)',
            tags: ['me'],
          },
        },
        '/api/me/fees': {
          get: { summary: 'Fee settings', tags: ['me'] },
          put: { summary: 'Update fee settings', tags: ['me'] },
        },
        '/api/billing/status': {
          get: { summary: 'Feature unlocks and tier', tags: ['billing'] },
        },
      },
    };
  });
}
