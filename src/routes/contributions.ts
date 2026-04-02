/**
 * Contribution routes — submit data corrections/additions to earn feature access.
 *
 * Users can contribute cost corrections, new locations, reviews, and supplemental
 * data. Approved contributions earn badges and unlock features at thresholds:
 *   5 approved → Basic features
 *   15 approved → Premium features
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';

const BASIC_THRESHOLD = 5;
const PREMIUM_THRESHOLD = 15;

// Badge keys mapped to contribution types
const TYPE_BADGES: Record<string, string> = {
  cost_correction: 'cost_corrector',
  new_location: 'data_pioneer',
  review_rating: 'reviewer',
  supplemental_data: 'data_completer',
};

const createContributionSchema = z.object({
  type: z.enum(['cost_correction', 'new_location', 'review_rating', 'supplemental_data']),
  locationId: z.string().max(200).optional(),
  title: z.string().min(1).max(500),
  data: safeJsonRecord,
}).strict();

const reviewContributionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminNotes: z.string().max(2000).optional(),
}).strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  type: z.enum(['cost_correction', 'new_location', 'review_rating', 'supplemental_data']).optional(),
}).strict();

export default async function contributionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/contributions/mine — user's own contributions
  app.get('/mine', async (request, _reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    const q = parsed.success ? parsed.data : paginationSchema.parse({});

    const where: Record<string, unknown> = { userId: request.userId };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const skip = (q.page - 1) * q.limit;

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      data: contributions,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  });

  // GET /api/contributions/progress — contribution progress toward feature unlocks
  app.get('/progress', async (request, _reply) => {
    const [approvedCount, unlocks] = await Promise.all([
      prisma.contribution.count({
        where: { userId: request.userId, status: 'approved' },
      }),
      prisma.userFeatureUnlock.findMany({
        where: { userId: request.userId },
        select: { featureSet: true, unlockedVia: true },
      }),
    ]);

    const basicUnlocked = unlocks.some((u) => u.featureSet === 'basic');
    const premiumUnlocked = unlocks.some((u) => u.featureSet === 'premium');

    return {
      approvedCount,
      basicThreshold: BASIC_THRESHOLD,
      premiumThreshold: PREMIUM_THRESHOLD,
      basicUnlocked,
      premiumUnlocked,
    };
  });

  // POST /api/contributions — submit a new contribution (rate-limited to 10/day)
  app.post('/', async (request, reply) => {
    const parsed = createContributionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Rate limit: 10 contributions per day per user
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.contribution.count({
      where: {
        userId: request.userId,
        createdAt: { gte: dayAgo },
      },
    });
    if (recentCount >= 10) {
      return reply.code(429).send({ error: 'Daily contribution limit reached (10/day)' });
    }

    const contribution = await prisma.contribution.create({
      data: {
        userId: request.userId,
        type: parsed.data.type,
        locationId: parsed.data.locationId,
        title: parsed.data.title,
        data: parsed.data.data as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return reply.code(201).send(contribution);
  });
}

// ─── Admin contribution review routes ──────────────────────────────────────

export async function adminContributionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  // GET /api/admin/contributions — list contributions for review
  app.get('/', async (request, _reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    const q = parsed.success ? parsed.data : paginationSchema.parse({});

    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const skip = (q.page - 1) * q.limit;

    const [contributions, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        include: { user: { select: { id: true, email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.contribution.count({ where }),
    ]);

    return {
      data: contributions,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  });

  // PATCH /api/admin/contributions/:id — approve or reject a contribution
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewContributionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const contribution = await prisma.contribution.findUnique({ where: { id } });
    if (!contribution) {
      return reply.code(404).send({ error: 'Contribution not found' });
    }
    if (contribution.status !== 'pending') {
      return reply.code(409).send({ error: 'Contribution already reviewed' });
    }

    // Update contribution status
    const updated = await prisma.contribution.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminNotes: parsed.data.adminNotes,
        reviewedAt: new Date(),
        reviewedBy: request.user.email,
      },
    });

    // If approved, check for badge awards and feature unlocks
    if (parsed.data.status === 'approved') {
      await processApproval(contribution.userId, contribution.type);
    }

    return updated;
  });
}

/**
 * After approving a contribution, award badges and unlock features if thresholds are met.
 */
async function processApproval(userId: string, contributionType: string): Promise<void> {
  // Award type-specific badge (first of this type)
  const badgeKey = TYPE_BADGES[contributionType];
  if (badgeKey) {
    const existingBadge = await prisma.userBadge.findUnique({
      where: { userId_badgeKey: { userId, badgeKey } },
    });
    if (!existingBadge) {
      await prisma.userBadge.create({ data: { userId, badgeKey } });
    }
  }

  // Count total approved contributions
  const approvedCount = await prisma.contribution.count({
    where: { userId, status: 'approved' },
  });

  // Milestone badges
  if (approvedCount >= 5) {
    await prisma.userBadge.upsert({
      where: { userId_badgeKey: { userId, badgeKey: 'contributor_5' } },
      update: {},
      create: { userId, badgeKey: 'contributor_5' },
    });
  }
  if (approvedCount >= 15) {
    await prisma.userBadge.upsert({
      where: { userId_badgeKey: { userId, badgeKey: 'contributor_15' } },
      update: {},
      create: { userId, badgeKey: 'contributor_15' },
    });
  }

  // Feature unlocks at thresholds
  if (approvedCount >= BASIC_THRESHOLD) {
    await prisma.userFeatureUnlock.upsert({
      where: { userId_featureSet: { userId, featureSet: 'basic' } },
      update: {},
      create: { userId, featureSet: 'basic', unlockedVia: 'contribution' },
    });
  }
  if (approvedCount >= PREMIUM_THRESHOLD) {
    await prisma.userFeatureUnlock.upsert({
      where: { userId_featureSet: { userId, featureSet: 'premium' } },
      update: {},
      create: { userId, featureSet: 'premium', unlockedVia: 'contribution' },
    });
  }
}
