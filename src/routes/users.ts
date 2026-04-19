/**
 * Authenticated user routes — profile, account delete, GDPR export.
 *
 * Surfaces:
 *   - GET `/me` — profile + tier.
 *   - PUT `/me` — update displayName / email.
 *   - DELETE `/me` — GDPR right-to-erasure (cascades via Prisma).
 *   - GET `/me/export` — GDPR right-to-portability. Decrypts sensitive fields
 *     for human-readable JSON output. Relation loads capped (SAST L-06).
 *
 * Side-effects: writes to User; cascades to Household, Financial, etc.
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { decryptField } from '../middleware/encryption.js';
import { toValidationErrorPayload } from '../lib/validation.js';

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
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
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
  // SAST L-06 — hard caps on relation loads so a user at their 50 scenarios /
  // 20 custom-locations limit can't force an unbounded join. Totals are
  // returned so clients can paginate subsequent requests if needed.
  const EXPORT_TAKE_SCENARIOS = 200;
  const EXPORT_TAKE_CUSTOM_LOCATIONS = 100;
  const EXPORT_TAKE_LOCATION_OVERRIDES = 500;
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
        customLocations: { take: EXPORT_TAKE_CUSTOM_LOCATIONS, orderBy: { updatedAt: 'desc' } },
        locationOverrides: { take: EXPORT_TAKE_LOCATION_OVERRIDES, orderBy: { updatedAt: 'desc' } },
        scenarios: { take: EXPORT_TAKE_SCENARIOS, orderBy: { updatedAt: 'desc' } },
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
