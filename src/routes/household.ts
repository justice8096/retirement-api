/**
 * Household profile routes — members, pets, target retirement income.
 *
 * Surfaces:
 *   - GET `/me/household` — returns the profile with decrypted sensitive
 *     fields, `_units` metadata (Dyscalculia F-204) and `_labels` sibling
 *     (Dyslexia F-013) so UIs don't duplicate the field-label map.
 *   - PUT `/me/household` — upsert with encryption on `targetAnnualIncome`
 *     and each member's `ssPia` via the shared `encryptField` envelope.
 *
 * Dependent types — adult / child — are stored separately so age transitions
 * (20→21, 65→Medicare) can be modelled downstream.
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';
import { toValidationErrorPayload, getLabelsFor } from '../lib/validation.js';
import { defaultCurrencyFor } from '../lib/locale.js';
import {
  buildPetCostByYear, buildDependentCostByYear,
  PET_COST_CATEGORY_KEYS, DEFAULT_CHILD_SUPPORT_UNTIL_AGE, DEFAULT_DEPENDENT_MONTHLY_COST,
} from '#shared/engine/household-costs.js';
import { calcSSBenefit, calcSpousalBenefit } from '#shared/socialSecurity.js';

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  role: z.enum(['primary', 'spouse', 'dependent']).default('primary'),
  dependentType: z.enum(['adult', 'child']).nullable().optional(),
  name: z.string().max(100).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2030),
  ssPia: z.number().min(0).max(50000).nullable().optional(),
  ssFra: z.number().int().min(62).max(70).nullable().optional(),
  ssClaimAge: z.number().int().min(62).max(75).nullable().optional(),
  // Months past ssClaimAge (0-11) — claim at 67y4m = ssClaimAge 67 + 4.
  ssClaimAgeMonths: z.number().int().min(0).max(11).default(0),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.role === 'dependent') return data.dependentType != null;
    return data.dependentType == null || data.dependentType === undefined;
  },
  { message: 'dependentType is required for dependents and must be null/omitted for non-dependents' }
);

const petSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(100).nullable().optional(),
  type: z.enum(['dog', 'cat', 'bird', 'rabbit', 'fish', 'horse', 'reptile']).default('dog'),
  breed: z.string().max(100).nullable().optional(),
  size: z.enum(['small', 'medium', 'large']).nullable().optional(),
  weight: z.number().int().min(1).max(2500).nullable().optional(),
  feedingMode: z.enum(['commercial', 'homemade']).nullable().optional(),
  birthYear: z.number().int().min(2000).max(2030),
  expectedLifespan: z.number().int().min(1).max(50).default(12),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    if (data.feedingMode != null) return data.type === 'dog' || data.type === 'cat';
    return true;
  },
  { message: 'feedingMode is only supported for dogs and cats' }
);

const householdSchema = z.object({
  adultsCount: z.number().int().min(1).max(10).default(2),
  targetAnnualIncome: z.number().min(0).max(10_000_000).nullable().optional(),
  planningStartYear: z.number().int().min(2024).max(2050).default(2026),
  planningYears: z.number().int().min(1).max(70).default(40),
  requirements: z.array(z.string()).nullable().optional(),
  members: z.array(memberSchema).optional(),
  pets: z.array(petSchema).optional(),
}).strict();

/** Derive dog weight tier from exact weight in pounds. Non-dogs return null. */
function deriveWeightTier(type: string, weight: number | null | undefined): string | null {
  if (type !== 'dog' || !weight) return null;
  if (weight < 25) return 'small';
  if (weight <= 50) return 'medium';
  if (weight <= 100) return 'large';
  return 'giant';
}

interface HouseholdWithRelations {
  targetAnnualIncome: unknown;
  members?: Array<{ ssPia: unknown; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Decrypt sensitive fields in household + members for client response. */
function decryptHousehold(household: HouseholdWithRelations | null) {
  if (!household) return null;
  return {
    ...household,
    targetAnnualIncome: decryptField(household.targetAnnualIncome),
    members: household.members?.map((m) => ({
      ...m,
      ssPia: decryptField(m.ssPia),
    })),
  };
}

const costCurvesQuerySchema = z.object({
  locationId: z.string().min(1),
  years: z.coerce.number().int().min(1).max(100).optional(),
  simStartYear: z.coerce.number().int().min(2024).max(2100).optional(),
  monthlyCostPerDependent: z.coerce.number().min(0).max(100_000).default(DEFAULT_DEPENDENT_MONTHLY_COST),
  childSupportUntilAge: z.coerce.number().int().min(16).max(30).default(DEFAULT_CHILD_SUPPORT_UNTIL_AGE),
  // Query strings arrive as strings — z.coerce.boolean() would turn "false"
  // into true, so map the literal strings explicitly.
  replacePets: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
}).strict();

export default async function householdRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/household/cost-curves — per-year pet/dependent cost curves
  // for the Monte Carlo engine, built server-side from the household's pets
  // and dependents plus the named location's pet cost categories. Feed the
  // result straight into POST /api/simulate (petCostByYear /
  // dependentCostByYear) — and exclude the pet categories from any flat
  // spending figure you pass, since the pet curve replaces them.
  app.get('/cost-curves', async (request, reply) => {
    const parsed = costCurvesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }
    const q = parsed.data;

    const household = await prisma.householdProfile.findUnique({
      where: { userId: request.userId },
      include: {
        members: { orderBy: { sortOrder: 'asc' } },
        pets: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!household) return reply.code(404).send({ error: 'No household profile yet' });

    const loc = await prisma.adminLocation.findUnique({ where: { id: q.locationId } });
    if (!loc) return reply.code(404).send({ error: 'Location not found' });

    const monthlyCosts = (loc.locationData as {
      monthlyCosts?: Record<string, { typical?: number }>;
    }).monthlyCosts ?? {};
    const petMonthlyTotal = PET_COST_CATEGORY_KEYS
      .reduce((sum, key) => sum + (monthlyCosts[key]?.typical ?? 0), 0);

    const years = q.years ?? household.planningYears;
    const simStartYear = q.simStartYear ?? household.planningStartYear;

    const petCostByYear = buildPetCostByYear(household.pets, {
      years, simStartYear,
      petMonthlyTotalAtYear: () => petMonthlyTotal, // single-location v1
      replacePets: q.replacePets,
    });
    const dependentCostByYear = buildDependentCostByYear(
      household.members.filter((m) => m.role === 'dependent'),
      {
        years, simStartYear,
        monthlyCostPerDependent: q.monthlyCostPerDependent,
        childSupportUntilAge: q.childSupportUntilAge,
      },
    );

    reply.header('Cache-Control', 'private, no-store');
    return {
      locationId: q.locationId,
      years,
      simStartYear,
      petMonthlyTotal,
      petCostByYear,
      dependentCostByYear,
      assumptions: {
        monthlyCostPerDependent: q.monthlyCostPerDependent,
        childSupportUntilAge: q.childSupportUntilAge,
        replacePets: q.replacePets,
        petCostCategories: [...PET_COST_CATEGORY_KEYS],
      },
      _units: {
        'petCostByYear[]': { encoding: 'amount', currency: 'USD', periodicity: 'year' },
        'dependentCostByYear[]': { encoding: 'amount', currency: 'USD', periodicity: 'year' },
        petMonthlyTotal: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
        'assumptions.monthlyCostPerDependent': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
      },
      _labels: getLabelsFor(['petCostByYear', 'dependentCostByYear', 'petMonthlyTotal']),
    };
  });

  // GET /api/me/household/ss-benefits — server-computed own + spousal Social
  // Security benefits from the members' SS profiles. Steady state, today's
  // dollars: assumes both spouses have reached their claim ages; COLA and the
  // trust-fund cut stay scenario-level knobs downstream. Spec:
  // docs/superpowers/specs/2026-08-22-spousal-ss-benefits-design.md
  app.get('/ss-benefits', async (request, reply) => {
    const household = await prisma.householdProfile.findUnique({
      where: { userId: request.userId },
      include: { members: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!household) return reply.code(404).send({ error: 'No household profile yet' });

    const notes: string[] = [];
    const adults = household.members
      .filter((m) => m.role === 'primary' || m.role === 'spouse')
      .map((m) => ({ ...m, ssPia: decryptField(m.ssPia) as number | null }));

    // Absence of data is not an error: members without a PIA simply don't
    // appear; a PIA without an FRA is skipped with a plain-language note.
    const qualifying = adults.filter((m) => (m.ssPia ?? 0) > 0 && m.ssFra != null);
    for (const m of adults.filter((m) => (m.ssPia ?? 0) > 0 && m.ssFra == null)) {
      notes.push(`${m.name ?? 'One member'} has a basic Social Security amount but no Full Retirement Age, so their benefit is not included yet. Add their Full Retirement Age to count it.`);
    }

    const fmt = new Intl.NumberFormat(request.locale ?? 'en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    });

    const members = qualifying.map((own) => {
      const claimYears = own.ssClaimAge ?? own.ssFra!;
      const claimMonths = own.ssClaimAgeMonths ?? 0;
      const claimAge = claimYears + claimMonths / 12;
      const other = qualifying.find((m) => m.id !== own.id);
      const ownMonthly = calcSSBenefit(own.ssPia!, own.ssFra!, claimAge);
      const spousalTopUpMonthly = qualifying.length === 2 && other
        ? calcSpousalBenefit(other.ssPia!, own.ssPia!, own.ssFra!, claimAge)
        : 0;
      return {
        id: own.id,
        name: own.name,
        role: own.role,
        ownMonthly,
        spousalTopUpMonthly,
        totalMonthly: ownMonthly + spousalTopUpMonthly,
        claimAge: { years: claimYears, months: claimMonths },
      };
    });

    const totalMonthly = members.reduce((sum, m) => sum + m.totalMonthly, 0);
    const totalAnnual = totalMonthly * 12;

    let plainSummary: string;
    if (members.length === 0) {
      plainSummary = 'Add each member’s basic Social Security amount (PIA) and Full Retirement Age to see your household’s expected benefit.';
    } else {
      plainSummary = `Together your household expects ${fmt.format(totalMonthly)} per month (${fmt.format(totalAnnual)} per year) from Social Security.`;
      const topped = members.find((m) => m.spousalTopUpMonthly > 0);
      if (topped) {
        const other = members.find((m) => m.id !== topped.id);
        plainSummary += ` ${topped.name ?? 'The lower earner'} gets a ${fmt.format(topped.spousalTopUpMonthly)} monthly top-up because half of ${other?.name ?? 'the higher earner'}’s benefit is larger than their own.`;
      }
      notes.push('Amounts are in today’s dollars and assume both of you have started collecting.');
      notes.push('The top-up compares each person’s basic amount (PIA) before any early or late claiming adjustment.');
    }

    reply.header('Cache-Control', 'private, no-store');
    return {
      members,
      household: { totalMonthly, totalAnnual },
      plainSummary,
      notes,
      _units: {
        'members[].ownMonthly': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
        'members[].spousalTopUpMonthly': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
        'members[].totalMonthly': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
        'household.totalMonthly': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
        'household.totalAnnual': { encoding: 'amount', currency: 'USD', periodicity: 'year' },
      },
    };
  });

  // GET /api/me/household — fetch household with members and pets
  app.get('/', async (request, reply) => {
    const household = await prisma.householdProfile.findUnique({
      where: { userId: request.userId },
      include: {
        members: { orderBy: { sortOrder: 'asc' } },
        pets: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!household) return reply.code(404).send({ error: 'No household profile yet' });

    reply.header('Cache-Control', 'private, no-store');
    const decrypted = decryptHousehold(household);

    // Dyscalculia F-204 / Dyslexia F-013 — ship _units + _labels so consumers
    // know targetAnnualIncome is yearly in the user's currency and ssPia is
    // a monthly USD amount, without hard-coding the convention downstream.
    const currency = defaultCurrencyFor(request.locale ?? 'en-US');
    return {
      ...decrypted,
      _units: {
        targetAnnualIncome: { encoding: 'amount', currency, periodicity: 'year' },
        'members[].ssPia': { encoding: 'amount', currency: 'USD', periodicity: 'month' },
      },
      _labels: getLabelsFor(['targetAnnualIncome', 'members', 'pets']),
    };
  });

  // PUT /api/me/household — create or replace household
  app.put('/', async (request, _reply) => {
    const parsed = householdSchema.safeParse(request.body);
    if (!parsed.success) {
      return _reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const { members, pets, ...profileData } = parsed.data;

    // Encrypt sensitive profile fields
    const encryptedProfile: Record<string, unknown> = { ...profileData };
    if (profileData.targetAnnualIncome !== undefined) {
      encryptedProfile.targetAnnualIncome = encryptField(profileData.targetAnnualIncome);
    }

    const result = await prisma.$transaction(async (tx) => {
      const household = await tx.householdProfile.upsert({
        where: { userId: request.userId },
        update: encryptedProfile,
        create: { ...encryptedProfile, userId: request.userId },
      });

      // Replace members if provided
      if (members !== undefined) {
        await tx.householdMember.deleteMany({ where: { householdId: household.id } });
        if (members.length > 0) {
          await tx.householdMember.createMany({
            data: members.map((m, i) => ({
              householdId: household.id,
              role: m.role,
              dependentType: m.dependentType ?? null,
              name: m.name ?? null,
              birthYear: m.birthYear,
              ssPia: encryptField(m.ssPia),  // Encrypt SS PIA
              ssFra: m.ssFra ?? null,
              ssClaimAge: m.ssClaimAge ?? null,
              ssClaimAgeMonths: m.ssClaimAgeMonths ?? 0,
              sortOrder: m.sortOrder ?? i,
            })),
          });
        }
      }

      // Replace pets if provided
      if (pets !== undefined) {
        await tx.householdPet.deleteMany({ where: { householdId: household.id } });
        if (pets.length > 0) {
          await tx.householdPet.createMany({
            data: pets.map((p, i) => ({
              householdId: household.id,
              name: p.name ?? null,
              type: p.type,
              breed: p.breed ?? null,
              size: p.size ?? null,
              weight: p.weight ?? null,
              weightTier: deriveWeightTier(p.type, p.weight),
              feedingMode: p.feedingMode ?? null,
              birthYear: p.birthYear,
              expectedLifespan: p.expectedLifespan,
              sortOrder: p.sortOrder ?? i,
            })),
          });
        }
      }

      return tx.householdProfile.findUnique({
        where: { id: household.id },
        include: {
          members: { orderBy: { sortOrder: 'asc' } },
          pets: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    return decryptHousehold(result as HouseholdWithRelations);
  });
}

export { memberSchema, petSchema, householdSchema, deriveWeightTier };
