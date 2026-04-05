import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  role: z.enum(['primary', 'spouse', 'dependent']).default('primary'),
  dependentType: z.enum(['adult', 'child']).nullable().optional(),
  name: z.string().max(100).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2030),
  ssPia: z.number().min(0).max(50000).nullable().optional(),
  ssFra: z.number().int().min(62).max(70).nullable().optional(),
  ssClaimAge: z.number().int().min(62).max(75).nullable().optional(),
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

export default async function householdRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

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
    return decryptHousehold(household);
  });

  // PUT /api/me/household — create or replace household
  app.put('/', async (request, _reply) => {
    const parsed = householdSchema.safeParse(request.body);
    if (!parsed.success) {
      return _reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
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
