#!/usr/bin/env bash
# tier-get.sh — read a user's subscription tier from the deploy postgres.
#
# Usage:
#   ./tier-get.sh <email>
#
# Example:
#   ./tier-get.sh justice8096@gmail.com
#
# Runs psql via `docker compose exec postgres` against the live deploy
# postgres. Defaults to the rogue compose file path; override via
# COMPOSE_FILE env var for other environments.
#
# Read-only; safe to run anytime.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <email>" >&2
  exit 2
fi

EMAIL="$1"
COMPOSE_FILE="${COMPOSE_FILE:-/srv/retirement/retirement-api/docker-compose.yml}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: compose file not found at ${COMPOSE_FILE}" >&2
  echo "       Set COMPOSE_FILE=<path> if running outside the rogue deploy." >&2
  exit 1
fi

# `-T` disables pseudo-TTY; needed when called from non-interactive shells.
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U retirement -d retirement_saas \
    -v "ON_ERROR_STOP=1" \
    -c "SELECT email, tier, updated_at FROM users WHERE email = '${EMAIL}';"
