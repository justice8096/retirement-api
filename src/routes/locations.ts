import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';

interface LocationData {
  name: string;
  country: string;
  region: string;
  currency: string;
  [key: string]: unknown;
}

// ─── Query schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(150),
  country: z.string().optional(),
  region: z.string().optional(),
  currency: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['name', 'country', 'monthlyCostTotal', 'updatedAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  minCost: z.coerce.number().int().min(0).optional(),
  maxCost: z.coerce.number().int().min(0).optional(),
  fields: z.enum(['summary', 'full']).default('summary'),
}).strict();

const batchSupplementSchema = z.object({
  locationIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  dataType: z.enum(['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info']),
}).strict();

export default async function locationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/locations — paginated, filterable, searchable location index
  app.get('/', async (request, _reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    const q = parsed.success ? parsed.data : listQuerySchema.parse({});

    const where: Record<string, unknown> = {};

    // Filters on denormalized columns
    if (q.country) where.country = q.country;
    if (q.region) where.region = q.region;
    if (q.currency) where.currency = q.currency;

    // Cost range filter
    if (q.minCost !== undefined || q.maxCost !== undefined) {
      where.monthlyCostTotal = {
        ...(q.minCost !== undefined && { gte: q.minCost }),
        ...(q.maxCost !== undefined && { lte: q.maxCost }),
      };
    }

    // Search by name (case-insensitive contains)
    if (q.search) {
      where.name = { contains: q.search, mode: 'insensitive' };
    }

    const skip = (q.page - 1) * q.limit;

    const select = q.fields === 'full'
      ? {
          id: true,
          version: true,
          name: true,
          country: true,
          region: true,
          currency: true,
          monthlyCostTotal: true,
          updatedAt: true,
          locationData: true,
        }
      : {
          id: true,
          version: true,
          name: true,
          country: true,
          region: true,
          currency: true,
          monthlyCostTotal: true,
          updatedAt: true,
        };

    const [locations, total] = await Promise.all([
      prisma.adminLocation.findMany({
        where,
        select,
        orderBy: { [q.sortBy]: q.sortDir },
        skip,
        take: q.limit,
      }),
      prisma.adminLocation.count({ where }),
    ]);

    // When fields=full, return locationData as the data items (dashboard expects location objects)
    const data = q.fields === 'full'
      ? locations.map((loc: Record<string, unknown>) => ({
          ...(loc.locationData as object),
          _version: loc.version,
        }))
      : locations;

    return {
      data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  });

  // GET /api/locations/all — lightweight index of all locations (for dropdowns/selectors)
  // Returns only id + name + country + region — no JSONB, no pagination needed
  app.get('/all', async (_request, _reply) => {
    const locations = await prisma.adminLocation.findMany({
      select: { id: true, name: true, country: true, region: true, currency: true, monthlyCostTotal: true },
      orderBy: { name: 'asc' },
    });
    return locations;
  });

  // GET /api/locations/countries — distinct country list for filter UIs
  app.get('/countries', async (_request, _reply) => {
    const rows = await prisma.adminLocation.findMany({
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    });
    return rows.map((r) => r.country).filter(Boolean);
  });

  // GET /api/locations/regions — distinct region list for filter UIs
  app.get('/regions', async (_request, _reply) => {
    const rows = await prisma.adminLocation.findMany({
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    });
    return rows.map((r) => r.region).filter(Boolean);
  });

  // GET /api/locations/:id — full location data
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const loc = await prisma.adminLocation.findUnique({
      where: { id },
    });
    if (!loc) return reply.code(404).send({ error: 'Location not found' });
    return { ...(loc.locationData as object), _version: loc.version };
  });

  // GET /api/locations/:id/:dataType — supplemental data for a single location
  app.get('/:id/:dataType', async (request, reply) => {
    const { id, dataType } = request.params as { id: string; dataType: string };
    const validTypes = ['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info'];
    if (!validTypes.includes(dataType)) {
      return reply.code(400).send({ error: 'Invalid data type' });
    }

    const supplement = await prisma.adminLocationSupplement.findUnique({
      where: { locationId_dataType: { locationId: id, dataType } },
    });
    if (!supplement) return reply.code(404).send({ error: 'Data not found' });
    return supplement.data;
  });

  // POST /api/locations/batch-supplements — batch load supplemental data for multiple locations
  // Eliminates N+1 fetches: instead of 100 requests, one request with all location IDs
  app.post('/batch-supplements', async (request, reply) => {
    const parsed = batchSupplementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { locationIds, dataType } = parsed.data;

    const supplements = await prisma.adminLocationSupplement.findMany({
      where: {
        locationId: { in: locationIds },
        dataType,
      },
    });

    // Return as { locationId: data } map
    const result: Record<string, unknown> = {};
    for (const s of supplements) {
      result[s.locationId] = s.data;
    }
    return result;
  });
}
