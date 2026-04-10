import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import type { InputJsonValue } from '@prisma/client/runtime/library.js';

const customLocationSchema = z.object({
  locationData: safeJsonRecord,
}).strict();

const overrideSchema = z.object({
  baseLocationId: z.string().min(1).max(100),
  overrides: safeJsonRecord,
}).strict();

const MAX_CUSTOM_LOCATIONS = 20;

export default async function customLocationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // ─── Custom Locations ─────────────────────────────────────────────────────

  // GET /api/me/locations — list custom locations
  app.get('/', async (request, reply) => {
    const locations = await prisma.userCustomLocation.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: 'desc' },
    });

    reply.header('Cache-Control', 'private, no-store');
    return locations;
  });

  // POST /api/me/locations — create custom location (basic+ tier)
  app.post('/', { preHandler: requireTier('basic') }, async (request, reply) => {
    const parsed = customLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const count = await prisma.userCustomLocation.count({ where: { userId: request.userId } });
    if (count >= MAX_CUSTOM_LOCATIONS) {
      return reply.code(409).send({ error: `Maximum ${MAX_CUSTOM_LOCATIONS} custom locations reached` });
    }

    const location = await prisma.userCustomLocation.create({
      data: {
        userId: request.userId,
        locationData: parsed.data.locationData as InputJsonValue,
      },
    });

    return reply.code(201).send(location);
  });

  // PUT /api/me/locations/:id — update custom location
  app.put('/:id', async (request, reply) => {
    const parsed = customLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { id } = request.params as { id: string };

    const existing = await prisma.userCustomLocation.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Custom location not found' });

    const location = await prisma.userCustomLocation.update({
      where: { id },
      data: { locationData: parsed.data.locationData as InputJsonValue },
    });

    return location;
  });

  // DELETE /api/me/locations/:id — delete custom location
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.userCustomLocation.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Custom location not found' });

    await prisma.userCustomLocation.delete({ where: { id } });
    return { message: 'Custom location deleted' };
  });

  // ─── Location Overrides ───────────────────────────────────────────────────

  // GET /api/me/locations/overrides — list all overrides
  app.get('/overrides', async (request, reply) => {
    const overrides = await prisma.userLocationOverride.findMany({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return overrides;
  });

  // PUT /api/me/locations/overrides — create or update an override for a base location
  app.put('/overrides', async (request, reply) => {
    const parsed = overrideSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Look up current version of base location
    const baseLoc = await prisma.adminLocation.findUnique({
      where: { id: parsed.data.baseLocationId },
      select: { version: true },
    });
    if (!baseLoc) return reply.code(404).send({ error: 'Base location not found' });

    const override = await prisma.userLocationOverride.upsert({
      where: {
        userId_baseLocationId: {
          userId: request.userId,
          baseLocationId: parsed.data.baseLocationId,
        },
      },
      update: {
        overrides: parsed.data.overrides as InputJsonValue,
        baseLocationVersion: baseLoc.version,
      },
      create: {
        userId: request.userId,
        baseLocationId: parsed.data.baseLocationId,
        baseLocationVersion: baseLoc.version,
        overrides: parsed.data.overrides as InputJsonValue,
      },
    });

    return override;
  });

  // DELETE /api/me/locations/overrides/:baseLocationId — remove override
  app.delete('/overrides/:baseLocationId', async (request, reply) => {
    const { baseLocationId } = request.params as { baseLocationId: string };

    const existing = await prisma.userLocationOverride.findFirst({
      where: {
        userId: request.userId,
        baseLocationId,
      },
    });
    if (!existing) return reply.code(404).send({ error: 'Override not found' });

    await prisma.userLocationOverride.delete({ where: { id: existing.id } });
    return { message: 'Override removed' };
  });
}
