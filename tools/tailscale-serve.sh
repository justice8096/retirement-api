#!/usr/bin/env bash
# tailscale-serve.sh — Expose the API via Tailscale Serve (HTTPS) and optionally Funnel (public)
#
# Usage:
#   ./tools/tailscale-serve.sh          # Tailscale Serve only (tailnet-private)
#   ./tools/tailscale-serve.sh --funnel # Tailscale Funnel (public internet)
#   ./tools/tailscale-serve.sh --stop   # Stop serving
#
# Prerequisites:
#   - Tailscale installed and logged in
#   - API server running on PORT (default 3000)

set -euo pipefail

PORT="${PORT:-3000}"
FUNNEL=false
STOP=false

for arg in "$@"; do
  case "$arg" in
    --funnel) FUNNEL=true ;;
    --stop)   STOP=true ;;
  esac
done

# Get tailscale DNS name
DNS_NAME=$(tailscale status --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))" 2>/dev/null)
if [ -z "$DNS_NAME" ]; then
  echo "ERROR: Cannot determine Tailscale DNS name. Is Tailscale running?"
  exit 1
fi

if $STOP; then
  echo "Stopping Tailscale Serve on port $PORT..."
  tailscale serve --remove "/$PORT" 2>/dev/null || true
  tailscale funnel --remove "/$PORT" 2>/dev/null || true
  echo "Stopped."
  exit 0
fi

echo "=== Tailscale Serve ==="
echo "  Machine:  $DNS_NAME"
echo "  API port: $PORT"
echo ""

# Set up Tailscale Serve — proxies HTTPS on port 443 to local HTTP on $PORT
tailscale serve --bg --https=443 "http://127.0.0.1:${PORT}"
echo ""
echo "API available at: https://${DNS_NAME}"
echo "  (accessible from any device on your tailnet)"

if $FUNNEL; then
  echo ""
  echo "Enabling Tailscale Funnel (public internet access)..."
  tailscale funnel --bg --https=443 "http://127.0.0.1:${PORT}"
  echo ""
  echo "API publicly available at: https://${DNS_NAME}"
  echo "  (accessible from the public internet)"
fi

echo ""
echo "To stop: $0 --stop"
