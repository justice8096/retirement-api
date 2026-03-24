/**
 * Integration tests for public location routes (GET /api/locations).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    adminLocation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    adminLocationSupplement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../db/prisma.js';
import locationRoutes from '../routes/locations.js';

describe('GET /api/locations', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(locationRoutes, { prefix: '/api/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns paginated location index with summaries', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'fairfax-va',
        version: 3,
        name: 'Fairfax, VA',
        country: 'USA',
        region: 'Mid-Atlantic',
        currency: 'USD',
        monthlyCostTotal: 4500,
        updatedAt: new Date('2026-01-15'),
      },
      {
        id: 'lyon',
        version: 1,
        name: 'Lyon, France',
        country: 'France',
        region: 'Auvergne-Rhône-Alpes',
        currency: 'EUR',
        monthlyCostTotal: 3200,
        updatedAt: new Date('2026-02-01'),
      },
    ]);
    (prisma.adminLocation.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const res = await app.inject({ method: 'GET', url: '/api/locations' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.data[0]).toEqual({
      id: 'fairfax-va',
      version: 3,
      name: 'Fairfax, VA',
      country: 'USA',
      region: 'Mid-Atlantic',
      currency: 'USD',
      monthlyCostTotal: 4500,
      updatedAt: expect.any(String),
    });
  });

  it('returns empty data array when no locations', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.adminLocation.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await app.inject({ method: 'GET', url: '/api/locations' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it('supports pagination parameters', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.adminLocation.count as ReturnType<typeof vi.fn>).mockResolvedValue(150);

    const res = await app.inject({ method: 'GET', url: '/api/locations?page=3&limit=20' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.pagination.page).toBe(3);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.totalPages).toBe(8);
  });

  it('supports search parameter', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.adminLocation.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await app.inject({ method: 'GET', url: '/api/locations?search=france' });
    expect(res.statusCode).toBe(200);
  });

  it('supports country filter', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.adminLocation.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await app.inject({ method: 'GET', url: '/api/locations?country=France' });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/locations/all', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(locationRoutes, { prefix: '/api/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns lightweight list for dropdowns', async () => {
    (prisma.adminLocation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'lyon', name: 'Lyon', country: 'France', region: 'ARA', currency: 'EUR', monthlyCostTotal: 3200 },
    ]);

    const res = await app.inject({ method: 'GET', url: '/api/locations/all' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('lyon');
  });
});

describe('GET /api/locations/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(locationRoutes, { prefix: '/api/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns full location data with version', async () => {
    (prisma.adminLocation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fairfax-va',
      version: 3,
      locationData: {
        name: 'Fairfax, VA',
        country: 'USA',
        monthlyCosts: { rent: { typical: 2200 } },
      },
    });

    const res = await app.inject({ method: 'GET', url: '/api/locations/fairfax-va' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);
    expect(body.name).toBe('Fairfax, VA');
    expect(body._version).toBe(3);
    expect(body.monthlyCosts.rent.typical).toBe(2200);
  });

  it('returns 404 for unknown location', async () => {
    (prisma.adminLocation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/locations/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/locations/:id/:dataType', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(locationRoutes, { prefix: '/api/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns supplemental data for valid type', async () => {
    const neighborhoodData = {
      neighborhoods: [
        { name: 'Old Town', walkability: 85 },
      ],
    };
    (prisma.adminLocationSupplement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: neighborhoodData,
    });

    const res = await app.inject({ method: 'GET', url: '/api/locations/fairfax-va/neighborhoods' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual(neighborhoodData);
  });

  it('rejects invalid data type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/locations/fairfax-va/invalid-type' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when supplement not found', async () => {
    (prisma.adminLocationSupplement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/locations/fairfax-va/services' });
    expect(res.statusCode).toBe(404);
  });

  it.each(['neighborhoods', 'services', 'inclusion', 'detailed-costs', 'local-info'])(
    'accepts valid data type: %s',
    async (dataType) => {
      (prisma.adminLocationSupplement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
      const res = await app.inject({ method: 'GET', url: `/api/locations/fairfax-va/${dataType}` });
      expect(res.statusCode).toBe(200);
    }
  );
});

describe('POST /api/locations/batch-supplements', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(locationRoutes, { prefix: '/api/locations' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns batched supplemental data as a map', async () => {
    (prisma.adminLocationSupplement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { locationId: 'lyon', data: { foo: 1 } },
      { locationId: 'paris', data: { bar: 2 } },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/batch-supplements',
      payload: { locationIds: ['lyon', 'paris'], dataType: 'neighborhoods' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.lyon).toEqual({ foo: 1 });
    expect(body.paris).toEqual({ bar: 2 });
  });

  it('rejects invalid data type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/batch-supplements',
      payload: { locationIds: ['lyon'], dataType: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });
});
