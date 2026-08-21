/**
 * Tests for GET /api/me/household/cost-curves — the server-side pet/dependent
 * cost-curve builder that feeds POST /api/simulate for thin clients.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/prisma.js', () => ({
  default: {
    householdProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    householdMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    householdPet: { deleteMany: vi.fn(), createMany: vi.fn() },
    adminLocation: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(async (request) => {
    request.userId = 'test-user-id';
    request.user = { id: 'test-user-id', tier: 'free' };
  }),
}));
vi.mock('../middleware/encryption.js', () => ({
  encryptField: vi.fn((v) => (v == null ? null : `ENC:${v}`)),
  decryptField: vi.fn((v) => v),
}));

import prisma from '../db/prisma.js';
import householdRoutes from '../routes/household.js';

const household = {
  id: 'hh-1', userId: 'test-user-id', planningStartYear: 2026, planningYears: 10,
  members: [
    { role: 'primary', dependentType: null, birthYear: 1975 },
    { role: 'dependent', dependentType: 'child', birthYear: 2010 },
  ],
  pets: [{ type: 'dog', birthYear: 2018, expectedLifespan: 12 }],
  targetAnnualIncome: null,
};
const location = {
  id: 'us-upper-darby-pa',
  locationData: {
    monthlyCosts: {
      petCare: { typical: 160 }, petDaycare: { typical: 370 }, petGrooming: { typical: 110 },
      groceries: { typical: 500 },
    },
  },
};

describe('GET /api/me/household/cost-curves', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await app.register(householdRoutes, { prefix: '/api/me/household' });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('builds both curves from household + location data', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(household);
    prisma.adminLocation.findUnique.mockResolvedValue(location);
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/household/cost-curves?locationId=us-upper-darby-pa',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.petMonthlyTotal).toBe(640);
    expect(body.years).toBe(10);
    expect(body.simStartYear).toBe(2026);
    expect(body.petCostByYear).toHaveLength(10);
    expect(body.petCostByYear[0]).toBeCloseTo(640 * 12);        // dog age 8 — base rate
    expect(body.petCostByYear[1]).toBeCloseTo(640 * 12 * 1.25); // senior from age 9
    expect(body.petCostByYear[4]).toBe(0);                      // after expected death (2030)
    expect(body.dependentCostByYear[0]).toBe(12_000);           // child age 16
    expect(body.dependentCostByYear[6]).toBe(0);                // child turned 22
    expect(body._units['petCostByYear[]'])
      .toEqual({ encoding: 'amount', currency: 'USD', periodicity: 'year' });
    expect(body._labels.petCostByYear).toBeTruthy();
    expect(body.assumptions.childSupportUntilAge).toBe(22);
  });

  it('honors query overrides (years, replacePets, dependent knobs)', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(household);
    prisma.adminLocation.findUnique.mockResolvedValue(location);
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/household/cost-curves?locationId=us-upper-darby-pa&years=6&replacePets=true&monthlyCostPerDependent=500&childSupportUntilAge=18',
    });
    const body = res.json();
    expect(body.years).toBe(6);
    expect(body.petCostByYear[5]).toBeCloseTo(640 * 12); // successor pet, base rate
    expect(body.dependentCostByYear[0]).toBe(6_000);     // child age 16 < 18
    expect(body.dependentCostByYear[2]).toBe(0);         // child turned 18
  });

  it('404s on missing household or unknown location', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(null);
    const r1 = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves?locationId=x' });
    expect(r1.statusCode).toBe(404);
    prisma.householdProfile.findUnique.mockResolvedValue(household);
    prisma.adminLocation.findUnique.mockResolvedValue(null);
    const r2 = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves?locationId=x' });
    expect(r2.statusCode).toBe(404);
  });

  it('400s without locationId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/household/cost-curves' });
    expect(res.statusCode).toBe(400);
  });
});
