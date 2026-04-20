/**
 * Public location routes — no auth required.
 *
 * Surfaces:
 *   - GET `/` — paginated, filterable catalogue (country / region / cost-range).
 *   - GET `/:id` — full location blob with `_units` injected into `acaMarketplace`
 *     (Dyscalculia F-203) and `acaApplicable: false` on non-US rows (F-208).
 *   - GET `/:id/:dataType` — supplements (neighborhoods, services, inclusion…).
 *   - POST `/batch-supplements` — N+1 elimination for list views.
 *
 * Side-effects: read-only. Heavy queries are memoised via `cached()`.
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { cached } from '../lib/cache.js';
import { toValidationErrorPayload } from '../lib/validation.js';

interface LocationData {
  name: string;
  country: string;
  region: string;
  currency: string;
  [key: string]: unknown;
}

// ─── Input Sanitization ────────────────────────────────────────────────────

/**
 * Reject strings that look like SQL injection, XSS, NoSQL injection,
 * or path traversal attempts. Returns a Zod refinement.
 */
const safeString = (maxLen: number = 200) =>
  z.string().max(maxLen).refine((val) => {
    // XSS patterns
    if (/<[a-z/!]|javascript:|on\w+\s*=/i.test(val)) return false;
    if (/\$\{|%3c|%3e/i.test(val)) return false;

    // NoSQL injection
    if (/\{\s*"\$/.test(val)) return false;

    // Path traversal
    if (/\.\.[/\\]/.test(val)) return false;

    // Null bytes
    if (val.includes('\0') || /%00/.test(val)) return false;

    return true;
  }, { message: 'Input contains disallowed characters or patterns' });

// ─── Query schemas ──────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(150),
  country: safeString(100).optional(),
  region: safeString(100).optional(),
  currency: z.string().max(10).optional(),
  search: safeString(200).optional(),
  sortBy: z.enum(['name', 'country', 'monthlyCostTotal', 'updatedAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  minCost: z.coerce.number().int().min(0).optional(),
  maxCost: z.coerce.number().int().min(0).optional(),
  fields: z.enum(['summary', 'full']).default('summary'),
}).strict();

const batchSupplementSchema = z.object({
  locationIds: z.array(safeString(100)).min(1).max(100),
  dataType: z.enum(['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info']),
}).strict();

// Safe ID pattern: alphanumeric, hyphens, underscores only
const safeIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

export default async function locationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/locations — paginated, filterable, searchable location index
  app.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }
    const q = parsed.data;

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
          subregion: true,
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
          subregion: true,
          currency: true,
          monthlyCostTotal: true,
          updatedAt: true,
        };

    try {
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

      // When fields=full, return locationData merged with denormalized columns.
      // locationData (JSONB) is the raw location object; the denormalized columns
      // (id, monthlyCostTotal, updatedAt, etc.) must be overlaid so clients get
      // them regardless of whether locationData carries them.
      const data = q.fields === 'full'
        ? locations.map((loc: Record<string, unknown>) => ({
            ...(loc.locationData as object),
            id: loc.id,
            name: loc.name,
            country: loc.country,
            region: loc.region,
            subregion: loc.subregion,
            currency: loc.currency,
            monthlyCostTotal: loc.monthlyCostTotal,
            updatedAt: loc.updatedAt,
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
    } catch (err) {
      request.log.error({ err: (err as Error).message }, 'Failed to query locations');
      return reply.code(500).send({ error: 'Failed to query locations' });
    }
  });

  // GET /api/locations/all — lightweight index of all locations (for dropdowns/selectors)
  // Returns only id + name + country + region — no JSONB, no pagination needed
  // Cached for 5 minutes — this is the most frequently hit endpoint (every page load)
  app.get('/all', async (request, reply) => {
    try {
      return await cached('locations:all', () =>
        prisma.adminLocation.findMany({
          select: { id: true, name: true, country: true, region: true, subregion: true, currency: true, monthlyCostTotal: true },
          orderBy: { name: 'asc' },
        }),
      );
    } catch (err) {
      request.log.error({ err: (err as Error).message }, 'Failed to query all locations');
      return reply.code(500).send({ error: 'Failed to query locations' });
    }
  });

  // GET /api/locations/countries — distinct country list for filter UIs (cached 5 min)
  app.get('/countries', async (request, reply) => {
    try {
      return await cached('locations:countries', async () => {
        const rows = await prisma.adminLocation.findMany({
          select: { country: true },
          distinct: ['country'],
          orderBy: { country: 'asc' },
        });
        return rows.map((r) => r.country).filter(Boolean);
      });
    } catch (err) {
      request.log.error({ err: (err as Error).message }, 'Failed to query countries');
      return reply.code(500).send({ error: 'Failed to query countries' });
    }
  });

  // GET /api/locations/regions — distinct region list for filter UIs (cached 5 min)
  app.get('/regions', async (request, reply) => {
    try {
      return await cached('locations:regions', async () => {
        const rows = await prisma.adminLocation.findMany({
          select: { region: true },
          distinct: ['region'],
          orderBy: { region: 'asc' },
        });
        return rows.map((r) => r.region).filter(Boolean);
      });
    } catch (err) {
      request.log.error({ err: (err as Error).message }, 'Failed to query regions');
      return reply.code(500).send({ error: 'Failed to query regions' });
    }
  });

  // GET /api/locations/:id — full location data
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Validate ID format to prevent injection via URL path
    const idParsed = safeIdSchema.safeParse(id);
    if (!idParsed.success) {
      return reply.code(400).send({ error: 'Invalid location ID format' });
    }

    try {
      const loc = await prisma.adminLocation.findUnique({
        where: { id: idParsed.data },
      });
      if (!loc) return reply.code(404).send({ error: 'Location not found' });
      const data = loc.locationData as Record<string, unknown>;

      // Dyscalculia F-203 — inject _units into acaMarketplace so downstream UIs
      // know premiumCapPctOfIncome is a decimal fraction (0.085 = 8.5%).
      const healthcare = data.healthcare as Record<string, unknown> | undefined;
      const aca = healthcare?.acaMarketplace as Record<string, unknown> | undefined;
      if (aca) {
        aca._units = {
          benchmarkSilverMonthly2Adult: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
          benchmarkSilverMonthlySingle: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
          premiumCapPctOfIncome: {
            encoding: 'fraction',
            meaning: '0.085 = 8.5% of MAGI',
            regime: 'aca_enhanced_post_2021',
          },
        };
      }

      // Dyscalculia F-208 — flag non-US locations explicitly so consumers
      // don't have to infer from field absence.
      if (healthcare && loc.country !== 'United States' && !aca) {
        healthcare.acaApplicable = false;
      }

      // WCAG best-practice — natural-language summary that downstream
      // screen-reader UIs can announce without re-synthesizing from fields.
      const costText = loc.monthlyCostTotal
        ? `About ${loc.currency} ${Math.round(loc.monthlyCostTotal).toLocaleString()} per month in typical costs.`
        : 'Monthly cost total not yet available.';
      const a11y = {
        description: `${loc.name} in ${loc.region ?? loc.country}. ${costText}`,
        ariaLabel: `${loc.name}, ${loc.country}`,
      };

      return {
        ...data,
        id: loc.id,
        name: loc.name,
        country: loc.country,
        region: loc.region,
        subregion: loc.subregion,
        currency: loc.currency,
        monthlyCostTotal: loc.monthlyCostTotal,
        updatedAt: loc.updatedAt,
        _version: loc.version,
        _a11y: a11y,
      };
    } catch (err) {
      request.log.error({ err: (err as Error).message, id }, 'Failed to query location');
      return reply.code(500).send({ error: 'Failed to query location' });
    }
  });

  // GET /api/locations/:id/:dataType — supplemental data for a single location
  app.get('/:id/:dataType', async (request, reply) => {
    const { id, dataType } = request.params as { id: string; dataType: string };
    const validTypes = ['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info'];

    // Validate ID format
    const idParsed = safeIdSchema.safeParse(id);
    if (!idParsed.success) {
      return reply.code(400).send({ error: 'Invalid location ID format' });
    }

    if (!validTypes.includes(dataType)) {
      return reply.code(400).send({ error: 'Invalid data type' });
    }

    try {
      const supplement = await prisma.adminLocationSupplement.findUnique({
        where: { locationId_dataType: { locationId: idParsed.data, dataType } },
      });
      if (!supplement) return reply.code(404).send({ error: 'Data not found' });
      return supplement.data;
    } catch (err) {
      request.log.error({ err: (err as Error).message, id, dataType }, 'Failed to query supplement');
      return reply.code(500).send({ error: 'Failed to query supplemental data' });
    }
  });

  // POST /api/locations/batch-supplements — batch load supplemental data for multiple locations
  // Eliminates N+1 fetches: instead of 100 requests, one request with all location IDs
  app.post('/batch-supplements', async (request, reply) => {
    const parsed = batchSupplementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const { locationIds, dataType } = parsed.data;

    try {
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
    } catch (err) {
      request.log.error({ err: (err as Error).message }, 'Failed to batch query supplements');
      return reply.code(500).send({ error: 'Failed to query supplemental data' });
    }
  });
}
