/**
 * Badge routes — view earned achievement badges.
 *
 * Badge definitions (display name, description, icon) live here on the server
 * so the frontend doesn't need to duplicate the catalog.
 */
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

// ─── Badge catalog ──────────────────────────────────────────────────────────

interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: string; // emoji
}

const BADGE_CATALOG: BadgeDefinition[] = [
  { key: 'founding_member', name: 'Founding Member', description: 'Early supporter who helped build the community', icon: '\u2B50' },
  { key: 'cost_corrector', name: 'Cost Corrector', description: 'Submitted an approved cost correction', icon: '\uD83D\uDCB0' },
  { key: 'data_pioneer', name: 'Data Pioneer', description: 'Added a new location to the database', icon: '\uD83C\uDF0D' },
  { key: 'reviewer', name: 'Community Reviewer', description: 'Contributed a location review or rating', icon: '\uD83D\uDCDD' },
  { key: 'data_completer', name: 'Data Completer', description: 'Filled in missing supplemental data', icon: '\uD83D\uDD0D' },
  { key: 'contributor_5', name: 'Regular Contributor', description: '5+ approved contributions', icon: '\uD83C\uDFC5' },
  { key: 'contributor_15', name: 'Major Contributor', description: '15+ approved contributions', icon: '\uD83C\uDFC6' },
];

const BADGE_MAP = new Map(BADGE_CATALOG.map((b) => [b.key, b]));

export default async function badgeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/badges/mine — user's earned badges with metadata
  app.get('/mine', async (request, _reply) => {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: request.userId },
      orderBy: { awardedAt: 'asc' },
    });

    return userBadges.map((ub) => {
      const def = BADGE_MAP.get(ub.badgeKey);
      return {
        key: ub.badgeKey,
        name: def?.name ?? ub.badgeKey,
        description: def?.description ?? '',
        icon: def?.icon ?? '\uD83C\uDFC5',
        awardedAt: ub.awardedAt,
      };
    });
  });

  // GET /api/badges/catalog — all available badges (for display in UI)
  app.get('/catalog', async (_request, _reply) => {
    return BADGE_CATALOG;
  });
}
