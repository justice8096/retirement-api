import type { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    user: User;
    authProviderId: string;
    startTime?: bigint;
    /** Resolved BCP-47 locale from Accept-Language (always set by onRequest hook). */
    locale?: string;
  }
}
