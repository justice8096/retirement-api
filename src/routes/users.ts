import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { decryptField } from '../middleware/encryption.js';

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
}).strict();

export default async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me — current user profile
  app.get('/', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return reply.code(404).send({ error: 'User not found' });

    reply.header('Cache-Control', 'private, no-store');
    return user;
  });

  // PUT /api/me — update profile
  app.put('/', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        displayName: true,
        tier: true,
        updatedAt: true,
      },
    });

    return user;
  });

  // DELETE /api/me — delete account (GDPR right to erasure)
  // Cascade deletes: household, financial, preferences, scenarios, grocery, custom locations, overrides
  app.delete('/', async (request, _reply) => {
    await prisma.user.delete({
      where: { id: request.userId },
    });

    return { message: 'Account deleted successfully' };
  });

  // GET /api/me/export — full data export (GDPR right to portability)
  app.get('/export', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: {
        household: {
          include: {
            members: true,
            pets: true,
          },
        },
        financialSettings: true,
        preferences: true,
        customLocations: true,
        locationOverrides: true,
        scenarios: true,
        groceryData: true,
      },
    });

    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Strip internal IDs for export
    const { authProviderId: _auth, stripeCustomerId: _stripe, ...exportData } = user;

    // Decrypt sensitive fields for GDPR data portability (human-readable export)
    const decrypted = {
      ...exportData,
      financialSettings: exportData.financialSettings ? {
        ...exportData.financialSettings,
        portfolioBalance: decryptField((exportData.financialSettings as Record<string, unknown>).portfolioBalance),
      } : null,
      household: exportData.household ? {
        ...exportData.household,
        targetAnnualIncome: decryptField((exportData.household as Record<string, unknown>).targetAnnualIncome),
        members: ((exportData.household as Record<string, unknown>).members as Array<Record<string, unknown>> | undefined)?.map((m) => ({
          ...m,
          ssPia: decryptField(m.ssPia),
        })),
      } : null,
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="retirement-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.header('Cache-Control', 'private, no-store');
    return decrypted;
  });
}
