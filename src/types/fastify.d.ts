import type { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    /** ioredis client backing rate limiting, decorated at boot when REDIS_URL
     *  connects. Absent (undefined) when using the in-memory fallback. */
    redisClient?: { ping: () => Promise<string>; quit: () => Promise<void> };
  }

  interface FastifyRequest {
    userId: string;
    user: User;
    authProviderId: string;
    startTime?: bigint;
    /** Resolved BCP-47 locale from Accept-Language (always set by onRequest hook). */
    locale?: string;
    /** API-version negotiation (Dyscalculia F-202). 1 = legacy whole-number
     *  percents on the wire. 2 = decimal fractions on every percentage field. */
    apiVersion?: 1 | 2;
  }
}
