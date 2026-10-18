#!/usr/bin/env bash
# Waits until the frontend serves products in a non-USD currency through the
# proxy. USD listings succeed before product-catalog is healthy (the frontend
# skips conversion for USD), so they are not a reliable readiness signal.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-300}"

for ((i = 0; i < TIMEOUT; i += 5)); do
  if curl -fsS -m 10 "$BASE_URL/api/products?currencyCode=EUR" 2>/dev/null | grep -q '"id"'; then
    break
  fi
  sleep 5
  if (( i + 5 >= TIMEOUT )); then
    echo "Demo not ready after ${TIMEOUT}s" >&2
    exit 1
  fi
done

# A working EUR listing is not enough: right after start-up, checkout and product-catalog can stay
# "starting" or "unhealthy" for a few minutes on a laptop, and tests run then fail with 504s.
# Wait for every container to settle, but only warn on timeout so a stuck health probe does not block.
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"
for ((j = 0; j < HEALTH_TIMEOUT; j += 5)); do
  pending=$(docker ps --format '{{.Names}} {{.Status}}' | grep -E '\(health: starting\)|\(unhealthy\)' || true)
  [ -z "$pending" ] && break
  sleep 5
done
if [ -n "${pending:-}" ]; then
  echo "Warning: still not healthy after ${HEALTH_TIMEOUT}s, tests may fail with 504s:" >&2
  echo "$pending" >&2
fi
echo "Demo ready at $BASE_URL"
