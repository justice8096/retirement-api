# Tier admin scripts

Two helpers for reading + updating a user's subscription tier on the rogue deploy. Saves the round trip of `docker compose exec postgres psql -c "..."` boilerplate.

## When to use

- A dev account is on `free` tier and hits `Requires basic tier or higher` gates while testing — elevate to `admin` for full access.
- Need to reset a test user back to `free` to exercise the tier gates.
- Need to verify a user's current tier without browsing into Clerk + the database manually.

## Tier values

Per `prisma/schema.prisma:enum SubscriptionTier`:

- `free` — default for new signups; gates simulate-save, scenarios, custom locations, etc.
- `basic` — paid tier 1; unlocks save scenarios + most user features.
- `premium` — paid tier 2; unlocks the rest of the user-facing features.
- `admin` — internal; bypasses all tier gates AND unlocks `/api/admin/*` endpoints.

## Usage

```bash
# Read current tier
./tier-get.sh justice8096@gmail.com

# Elevate to admin (dev/testing)
./tier-set.sh justice8096@gmail.com admin

# Set back to free
./tier-set.sh test@example.com free
```

Both scripts default to `COMPOSE_FILE=/srv/retirement/retirement-api/docker-compose.yml` (the rogue deploy). For other environments, override:

```bash
COMPOSE_FILE=/path/to/docker-compose.yml ./tier-get.sh someone@example.com
```

## Cache behavior

The api caches user records for **10 seconds** (`USER_CACHE_TTL_MS` in `src/middleware/auth.ts`). After running `tier-set.sh`, the next request from that user will still see the OLD tier for up to 10 seconds. Either wait it out or refresh the browser to force a new auth round-trip.

## Why shell scripts and not Prisma

Prisma 7.8 changed `new PrismaClient()` to require explicit options, so the previous one-liner pattern (`node -e 'const{PrismaClient}=...'`) breaks without `{ datasourceUrl: ... }`. psql is simpler, has zero Node-version coupling, and the SQL is trivial.

## Why not an admin endpoint

A REST endpoint like `POST /api/admin/users/:id/tier` would be cleaner long-term. Tracked as a future improvement; for now the workflow is rare enough (only during dev / one-off support) that scripts are appropriate scope.

## Related

- `prisma/schema.prisma:User` — model definition + tier field
- `src/middleware/auth.ts` — `requireAdmin` / `requireAuth` middleware that reads tier
- `src/routes/scenarios.ts`, `src/routes/users.ts` — example callers of the tier gates
