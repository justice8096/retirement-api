import type { User } from '@prisma/client';

declare module 'fastify' {
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
