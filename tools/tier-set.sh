#!/usr/bin/env bash
# tier-set.sh — elevate (or downgrade) a user's subscription tier.
#
# Usage:
#   ./tier-set.sh <email> <tier>
#
# Tier must be one of: free, basic, premium, admin.
#
# Examples:
#   ./tier-set.sh justice8096@gmail.com admin
#   ./tier-set.sh test@example.com basic
#
# Runs psql UPDATE via `docker compose exec postgres` against the live
# deploy postgres. Defaults to the rogue compose file path; override
# via COMPOSE_FILE env var for other environments.
#
# Cache caveat: the api caches user records for 10 seconds (see
# USER_CACHE_TTL_MS in src/middleware/auth.ts). Wait ~10s after this
# script returns before retrying tier-gated requests, or refresh the
# browser to force a new auth round-trip.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <email> <tier>" >&2
  echo "  tier must be one of: free, basic, premium, admin" >&2
  exit 2
fi

EMAIL="$1"
TIER="$2"
COMPOSE_FILE="${COMPOSE_FILE:-/srv/retirement/retirement-api/docker-compose.yml}"

# Validate tier arg up-front — clearer error than letting psql reject the
# enum cast. Mirrors the SubscriptionTier enum in prisma/schema.prisma.
case "${TIER}" in
  free|basic|premium|admin) ;;
  *)
    echo "ERROR: invalid tier '${TIER}'." >&2
    echo "       Must be one of: free, basic, premium, admin" >&2
    exit 2
    ;;
esac

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: compose file not found at ${COMPOSE_FILE}" >&2
  echo "       Set COMPOSE_FILE=<path> if running outside the rogue deploy." >&2
  exit 1
fi

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U retirement -d retirement_saas \
    -v "ON_ERROR_STOP=1" \
    -c "UPDATE users SET tier = '${TIER}' WHERE email = '${EMAIL}' RETURNING email, tier, updated_at;"

echo
echo "Done. The api caches user records for 10s — wait ~10s before retrying"
echo "tier-gated requests, or refresh the browser to force a fresh auth."
