import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  role: z.enum(['primary', 'spouse', 'dependent']).default('primary'),
  name: z.string().max(100).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2030),
  ssPia: z.number().min(0).max(50000).nullable().optional(),
  ssFra: z.number().int().min(62).max(70).nullable().optional(),
  ssClaimAge: z.number().int().min(62).max(75).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

const petSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().max(50).default('dog'),
  breed: z.string().max(100).nullable().optional(),
  size: z.enum(['small', 'medium', 'large']).nullable().optional(),
  birthYear: z.number().int().min(2000).max(2030),
  expectedLifespan: z.number().int().min(1).max(30).default(12),
});

const householdSchema = z.object({
  adultsCount: z.number().int().min(1).max(10).default(2),
  targetAnnualIncome: z.number().min(0).max(10_000_000).nullable().optional(),
  planningStartYear: z.number().int().min(2024).max(2050).default(2026),
  planningYears: z.number().int().min(1).max(60).default(35),
  requirements: z.array(z.string()).nullable().optional(),
  members: z.array(memberSchema).optional(),
  pets: z.array(petSchema).optional(),
}).strict();

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
        pets: true,
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
      return { error: 'Validation failed', details: parsed.error.issues };
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
            data: pets.map((p) => ({
              householdId: household.id,
              type: p.type,
              breed: p.breed ?? null,
              size: p.size ?? null,
              birthYear: p.birthYear,
              expectedLifespan: p.expectedLifespan,
            })),
          });
        }
      }

      return tx.householdProfile.findUnique({
        where: { id: household.id },
        include: {
          members: { orderBy: { sortOrder: 'asc' } },
          pets: true,
        },
      });
    });

    return decryptHousehold(result as HouseholdWithRelations);
  });
}
