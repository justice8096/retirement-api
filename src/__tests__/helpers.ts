/**
 * Test helpers for API route testing.
 *
 * Uses Fastify's inject() for in-process HTTP testing — no real server needed.
 * Mocks Clerk auth by decorating request with user data directly.
 */
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import type { User } from '@prisma/client';

interface TestAppOptions {
  mockUser?: Partial<User>;
}

/**
 * Create a Fastify app with a route plugin registered.
 * Auth is simulated by decorating each request with the mock user.
 */
export async function buildTestApp(
  routePlugin: FastifyPluginAsync,
  prefix: string,
  options: TestAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Mock auth: inject user into every request
  const mockUser = {
    id: 'test-user-id',
    authProviderId: 'clerk_test_123',
    email: 'test@example.com',
    displayName: 'Test User',
    tier: 'free',
    stripeCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.mockUser,
  };

  // Override requireAuth/requireAdmin by decorating before routes run
  app.addHook('preHandler', async (request) => {
    request.userId = mockUser.id;
    request.user = mockUser as User;
    request.authProviderId = mockUser.authProviderId;
  });

  await app.register(routePlugin, { prefix });
  return app;
}

/**
 * Helper to send JSON requests via Fastify inject.
 */
export function inject(
  app: FastifyInstance,
  method: string,
  url: string,
  payload?: unknown,
) {
  const opts: { method: string; url: string; payload?: unknown; headers?: Record<string, string> } = { method, url };
  if (payload !== undefined) {
    opts.payload = payload;
    opts.headers = { 'content-type': 'application/json' };
  }
  return app.inject(opts);
}
