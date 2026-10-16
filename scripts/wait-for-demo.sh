#!/usr/bin/env bash
# Waits until the frontend serves products in a non-USD currency through the
# proxy. USD listings succeed before product-catalog is healthy (the frontend
# skips conversion for USD), so they are not a reliable readiness signal.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-300}"

for ((i = 0; i < TIMEOUT; i += 5)); do
  if curl -fsS -m 10 "$BASE_URL/api/products?currencyCode=EUR" 2>/dev/null | grep -q '"id"'; then
    echo "Demo ready at $BASE_URL"
    exit 0
  fi
  sleep 5
done
echo "Demo not ready after ${TIMEOUT}s" >&2
exit 1
