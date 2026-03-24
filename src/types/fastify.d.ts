import type { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    user: User;
    authProviderId: string;
    startTime?: bigint;
  }
}
