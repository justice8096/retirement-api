---
name: API Endpoint Implementation
description: >-
  This skill should be used when the user asks to "implement API endpoints",
  "build the API routes", "implement me endpoints", "implement admin endpoints",
  "wire up routes", "add CRUD operations", "implement user endpoints",
  "scaffold API handlers", "add Zod validation to routes", "implement
  household API", "implement financial API", "implement scenarios API",
  or mentions building out the stub/501 endpoints in the Fastify API.
version: 1.0.0
---

# API Endpoint Implementation

Scaffold and implement the 22 stub API endpoints that currently return 501. Uses Prisma for database operations and Zod for input validation.

## When to Use

- When implementing any `/api/me/*` or `/api/admin/*` endpoint
- When wiring Zod schemas into route handlers
- When adding new API routes
- After auth middleware is in place

## Current State

All `/api/me/*` and `/api/admin/*` routes return `501 Not Implemented`.
Working routes: `GET /api/health`, `GET /api/locations/*`.

## Implementation Pattern

Each endpoint follows this structure:

```javascript
async function handler(request, reply) {
  // 1. Extract authenticated user (from auth middleware)
  const userId = request.user.id;

  // 2. Validate input (Zod)
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  // 3. Database operation (Prisma)
  const result = await prisma.model.operation({
    where: { userId },
    data: parsed.data,
  });

  // 4. Return response
  return reply.send(result);
}
```

## Endpoints to Implement (by priority)

### Priority 1: User Profile (prerequisite for everything else)

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `GET /api/me` | — | `prisma.user.findUnique({ where: { id: userId } })` |
| `PUT /api/me` | `{ displayName?, email? }` | `prisma.user.update(...)` |
| `DELETE /api/me` | — | Cascade delete all user data (transaction) |
| `GET /api/me/export` | — | Fetch all user tables, return as JSON |

### Priority 2: Household

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `GET /api/me/household` | — | `findUnique` with include members + pets |
| `PUT /api/me/household` | `{ adultsCount?, targetAnnualIncome?, planningStartYear?, planningYears?, requirements? }` | `upsert` |
| `POST /api/me/household/members` | `{ role, name, birthYear, ssPia?, ssFra?, ssClaimAge? }` | `create` on HouseholdMember |
| `PUT /api/me/household/members/:id` | same as above | `update` with ownership check |
| `DELETE /api/me/household/members/:id` | — | `delete` with ownership check |
| `POST /api/me/household/pets` | `{ type?, breed?, size?, birthYear, expectedLifespan? }` | `create` on HouseholdPet |
| `PUT /api/me/household/pets/:id` | same as above | `update` with ownership check |
| `DELETE /api/me/household/pets/:id` | — | `delete` with ownership check |

### Priority 3: Financial Settings

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `GET /api/me/financial` | — | `findUnique`, decrypt sensitive fields |
| `PUT /api/me/financial` | `{ portfolioBalance?, fxDriftEnabled?, fxDriftAnnualRate?, ssCutEnabled?, ssCutYear?, ssCola? }` | `upsert`, encrypt before write |

### Priority 4: Preferences

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `GET /api/me/preferences` | — | `findUnique` |
| `PATCH /api/me/preferences` | `{ [key]: value }` (partial JSON) | `upsert` with JSON merge |

### Priority 5: Scenarios + Groceries

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `GET /api/me/scenarios` | — | `findMany({ where: { userId } })` |
| `POST /api/me/scenarios` | `{ name, scenarioData }` | `create` |
| `PUT /api/me/scenarios/:id` | `{ name?, scenarioData? }` | `update` with ownership check |
| `DELETE /api/me/scenarios/:id` | — | `delete` with ownership check |
| `GET /api/me/groceries` | — | `findUnique` |
| `PUT /api/me/groceries` | `{ overrides?, lists? }` | `upsert` |

### Priority 6: Admin

| Method | Path | Zod Schema | Prisma Operation |
|--------|------|-----------|-----------------|
| `POST /api/admin/locations` | Full location schema | `create` AdminLocation |
| `PUT /api/admin/locations/:id` | Full location schema | `update` + increment version + create history |
| `DELETE /api/admin/locations/:id` | — | `delete` with cascade |

## Ownership Checks

Every `/api/me/*` query MUST include `where: { userId }` to prevent horizontal privilege escalation. For nested resources (members, pets, scenarios), verify the parent belongs to the authenticated user:

```javascript
const member = await prisma.householdMember.findUnique({
  where: { id: memberId },
  include: { household: true },
});
if (member.household.userId !== userId) {
  return reply.status(403).send({ error: 'Forbidden' });
}
```

## Key Files

- `packages/api/src/routes/*.js` — Route handlers to implement
- `packages/api/src/middleware/` — Auth middleware (must exist first)
- `packages/api/prisma/schema.prisma` — Database models
- `packages/api/src/lib/encryption.js` — Financial field encryption (for Priority 3)
