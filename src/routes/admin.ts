import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAdmin } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import type { InputJsonValue } from '@prisma/client/runtime/library.js';

const locationSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  locationData: safeJsonRecord,
}).strict();

const updateLocationSchema = z.object({
  locationData: safeJsonRecord,
  changedBy: z.string().max(200).optional(),
}).strict();

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const createReleaseSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  priceUsd: z.number().int().min(0).default(0),
  stripePriceId: z.string().max(200).optional(),
}).strict();

const updateReleaseSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  priceUsd: z.number().int().min(0).optional(),
  stripePriceId: z.string().max(200).optional(),
  publish: z.boolean().optional(),
}).strict();

/**
 * Extract denormalized fields from locationData JSONB for indexed search/filter.
 * Called on create and update to keep search columns in sync.
 */
function extractSearchFields(locationData: Record<string, unknown>) {
  const name = typeof locationData.name === 'string' ? locationData.name : '';
  const country = typeof locationData.country === 'string' ? locationData.country : '';
  const region = typeof locationData.region === 'string' ? locationData.region : '';
  const currency = typeof locationData.currency === 'string' ? locationData.currency : 'USD';

  // Sum all monthlyCosts.*.typical values for cost-range filtering
  let monthlyCostTotal = 0;
  const costs = locationData.monthlyCosts;
  if (costs && typeof costs === 'object') {
    for (const val of Object.values(costs as Record<string, unknown>)) {
      if (val && typeof val === 'object' && 'typical' in (val as Record<string, unknown>)) {
        const typical = (val as Record<string, unknown>).typical;
        if (typeof typical === 'number') monthlyCostTotal += typical;
      }
    }
  }

  return { name, country, region, currency, monthlyCostTotal: Math.round(monthlyCostTotal) };
}

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  // POST /api/admin/locations — create new location
  app.post('/locations', async (request, reply) => {
    const parsed = locationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const existing = await prisma.adminLocation.findUnique({ where: { id: parsed.data.id } });
    if (existing) {
      return reply.code(409).send({ error: 'Location already exists' });
    }

    const searchFields = extractSearchFields(parsed.data.locationData);

    const result = await prisma.$transaction(async (tx) => {
      const location = await tx.adminLocation.create({
        data: {
          id: parsed.data.id,
          locationData: parsed.data.locationData as InputJsonValue,
          version: 1,
          ...searchFields,
        },
      });

      // Record initial version in history
      await tx.adminLocationHistory.create({
        data: {
          locationId: location.id,
          version: 1,
          locationData: parsed.data.locationData as InputJsonValue,
          changedBy: request.user.email,
        },
      });

      return location;
    });

    return reply.code(201).send(result);
  });

  // PUT /api/admin/locations/:id — update location (version increment + history)
  app.put('/locations/:id', async (request, reply) => {
    const parsed = updateLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { id } = request.params as { id: string };
    const idSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
    const idParsed = idSchema.safeParse(id);
    if (!idParsed.success) return reply.code(400).send({ error: 'Invalid location ID' });

    const existing = await prisma.adminLocation.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Location not found' });

    const newVersion = existing.version + 1;
    const searchFields = extractSearchFields(parsed.data.locationData);

    const result = await prisma.$transaction(async (tx) => {
      const location = await tx.adminLocation.update({
        where: { id },
        data: {
          locationData: parsed.data.locationData as InputJsonValue,
          version: newVersion,
          ...searchFields,
        },
      });

      await tx.adminLocationHistory.create({
        data: {
          locationId: id,
          version: newVersion,
          locationData: parsed.data.locationData as InputJsonValue,
          changedBy: parsed.data.changedBy ?? request.user.email,
        },
      });

      return location;
    });

    return result;
  });

  // DELETE /api/admin/locations/:id — delete location and all supplements/history
  app.delete('/locations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const idSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
    const idParsed = idSchema.safeParse(id);
    if (!idParsed.success) return reply.code(400).send({ error: 'Invalid location ID' });

    const existing = await prisma.adminLocation.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Location not found' });

    await prisma.adminLocation.delete({ where: { id } });
    return { message: 'Location deleted', id };
  });

  // GET /api/admin/locations/:id/history — paginated version history
  app.get('/locations/:id/history', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const parsed = historyQuerySchema.safeParse(request.query);
    const q = parsed.success ? parsed.data : historyQuerySchema.parse({});

    const skip = (q.page - 1) * q.limit;

    const [history, total] = await Promise.all([
      prisma.adminLocationHistory.findMany({
        where: { locationId: id },
        orderBy: { version: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.adminLocationHistory.count({ where: { locationId: id } }),
    ]);

    return {
      data: history,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  });

  // ─── Data Release Management ────────────────────────────────────────────

  // POST /api/admin/releases — create a draft release
  app.post('/releases', async (request, reply) => {
    const parsed = createReleaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const existing = await prisma.dataRelease.findUnique({ where: { version: parsed.data.version } });
    if (existing) {
      return reply.code(409).send({ error: `Release v${parsed.data.version} already exists` });
    }

    const release = await prisma.dataRelease.create({
      data: {
        version: parsed.data.version,
        title: parsed.data.title,
        description: parsed.data.description,
        priceUsd: parsed.data.priceUsd,
        stripePriceId: parsed.data.stripePriceId,
      },
    });

    return reply.code(201).send(release);
  });

  // PATCH /api/admin/releases/:id — update/publish a release
  app.patch('/releases/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateReleaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const existing = await prisma.dataRelease.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Release not found' });
    }

    const release = await prisma.dataRelease.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.priceUsd !== undefined && { priceUsd: parsed.data.priceUsd }),
        ...(parsed.data.stripePriceId !== undefined && { stripePriceId: parsed.data.stripePriceId }),
        ...(parsed.data.publish && { publishedAt: new Date() }),
      },
    });

    return release;
  });

  // POST /api/admin/locations/reindex — rebuild denormalized search columns for all locations
  // Useful after data migration or bulk import
  app.post('/locations/reindex', async (_request, reply) => {
    const all = await prisma.adminLocation.findMany({
      select: { id: true, locationData: true },
    });

    let updated = 0;
    for (const loc of all) {
      const searchFields = extractSearchFields(loc.locationData as Record<string, unknown>);
      await prisma.adminLocation.update({
        where: { id: loc.id },
        data: searchFields,
      });
      updated++;
    }

    return reply.send({ message: `Reindexed ${updated} locations` });
  });
}
