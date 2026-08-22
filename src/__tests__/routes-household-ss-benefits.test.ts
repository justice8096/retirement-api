/**
 * Tests for GET /api/me/household/ss-benefits — server-computed own +
 * spousal Social Security benefits from the household members' SS profiles.
 * Spec: docs/superpowers/specs/2026-08-22-spousal-ss-benefits-design.md
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

function member(over: Record<string, unknown>) {
  return {
    id: 'm', role: 'primary', dependentType: null, name: null, birthYear: 1962,
    ssPia: null, ssFra: null, ssClaimAge: null, ssClaimAgeMonths: 0, sortOrder: 0,
    ...over,
  };
}

function household(members: Array<Record<string, unknown>>) {
  return {
    id: 'hh-1', userId: 'test-user-id', planningStartYear: 2026, planningYears: 30,
    targetAnnualIncome: null, members, pets: [],
  };
}

const pat = member({ id: 'pat', name: 'Pat', role: 'primary', ssPia: 2400, ssFra: 67, ssClaimAge: 67 });
const sam = member({ id: 'sam', name: 'Sam', role: 'spouse', ssPia: 760, ssFra: 67, ssClaimAge: 67, sortOrder: 1 });

describe('GET /api/me/household/ss-benefits', () => {
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

  function get() {
    return app.inject({ method: 'GET', url: '/api/me/household/ss-benefits' });
  }

  it('computes the spec worked example (both at FRA)', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(household([pat, sam]));
    const res = await get();
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.members).toHaveLength(2);
    expect(body.members[0]).toMatchObject({
      id: 'pat', name: 'Pat', role: 'primary',
      ownMonthly: 2400, spousalTopUpMonthly: 0, totalMonthly: 2400,
      claimAge: { years: 67, months: 0 },
    });
    expect(body.members[1]).toMatchObject({
      id: 'sam', name: 'Sam', role: 'spouse',
      ownMonthly: 760, spousalTopUpMonthly: 440, totalMonthly: 1200,
      claimAge: { years: 67, months: 0 },
    });
    expect(body.household).toEqual({ totalMonthly: 3600, totalAnnual: 43200 });
    expect(body.plainSummary).toContain('3,600');
    expect(body.plainSummary).toContain('Sam');
    expect(body.plainSummary).toContain('top-up');
    expect(Array.isArray(body.notes)).toBe(true);
    expect(body._units['members[].ownMonthly'])
      .toEqual({ encoding: 'amount', currency: 'USD', periodicity: 'month' });
    expect(body._units['household.totalAnnual'])
      .toEqual({ encoding: 'amount', currency: 'USD', periodicity: 'year' });
  });

  it('reduces own benefit and top-up for an early claimer', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([pat, { ...sam, ssClaimAge: 62 }]),
    );
    const body = (await get()).json();
    // own: 760 * 0.70 = 532; top-up: 440 * 0.65 = 286
    expect(body.members[1].ownMonthly).toBe(532);
    expect(body.members[1].spousalTopUpMonthly).toBe(286);
    expect(body.members[1].totalMonthly).toBe(818);
  });

  it('honors month-precision claim ages (66y8m)', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([pat, { ...sam, ssClaimAge: 66, ssClaimAgeMonths: 8 }]),
    );
    const body = (await get()).json();
    // top-up: 440 * (1 - 4 * 25/3600) = 427.78 → 428
    expect(body.members[1].spousalTopUpMonthly).toBe(428);
    expect(body.members[1].claimAge).toEqual({ years: 66, months: 8 });
  });

  it('defaults a missing claim age to FRA', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([pat, { ...sam, ssClaimAge: null }]),
    );
    const body = (await get()).json();
    expect(body.members[1].ownMonthly).toBe(760);
    expect(body.members[1].spousalTopUpMonthly).toBe(440);
  });

  it('gives a single qualifying member their own benefit and no top-up', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([pat, { ...sam, ssPia: null }]),
    );
    const body = (await get()).json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].spousalTopUpMonthly).toBe(0);
    expect(body.household).toEqual({ totalMonthly: 2400, totalAnnual: 28800 });
  });

  it('returns 200 with zeros and guidance when nobody has SS data', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([member({ id: 'kid', role: 'dependent', dependentType: 'child', birthYear: 2010 })]),
    );
    const res = await get();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.members).toEqual([]);
    expect(body.household).toEqual({ totalMonthly: 0, totalAnnual: 0 });
    expect(body.plainSummary).toBeTruthy();
  });

  it('skips a member missing FRA and says so in a note', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(
      household([pat, { ...sam, ssFra: null }]),
    );
    const body = (await get()).json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].id).toBe('pat');
    expect(body.notes.join(' ')).toContain('Sam');
    expect(body.notes.join(' ')).toContain('Full Retirement Age');
  });

  it('404s when no household profile exists', async () => {
    prisma.householdProfile.findUnique.mockResolvedValue(null);
    const res = await get();
    expect(res.statusCode).toBe(404);
  });
});
