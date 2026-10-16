#!/usr/bin/env bash
# Waits until the frontend serves products through the proxy, i.e. the
# frontend -> product-catalog gRPC path is up, not just the proxy port.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-300}"

for ((i = 0; i < TIMEOUT; i += 5)); do
  if curl -fsS "$BASE_URL/api/products" 2>/dev/null | grep -q '"id"'; then
    echo "Demo ready at $BASE_URL"
    exit 0
  fi
  sleep 5
done
echo "Demo not ready after ${TIMEOUT}s" >&2
exit 1
