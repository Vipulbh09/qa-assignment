#!/usr/bin/env bash
# Clones the OpenTelemetry Astronomy Shop at a pinned commit and starts it.
# Pinning keeps test results reproducible: the upstream demo changes often.
set -euo pipefail

DEMO_REPO="https://github.com/open-telemetry/opentelemetry-demo"
DEMO_REF="${DEMO_REF:-ac0443b205dc184a08b27eed02c633b209d32c2f}"   # commit checked when this repo was created (2026-10-15)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_DIR="$ROOT/.demo"

if [ ! -d "$DEMO_DIR/.git" ]; then
  git init -q "$DEMO_DIR"
  git -C "$DEMO_DIR" remote add origin "$DEMO_REPO"
fi
git -C "$DEMO_DIR" fetch -q --depth=1 origin "$DEMO_REF" 2>/dev/null \
  || git -C "$DEMO_DIR" fetch -q --depth=50 origin main
git -C "$DEMO_DIR" checkout -q "$DEMO_REF" 2>/dev/null || git -C "$DEMO_DIR" checkout -q FETCH_HEAD
echo "Demo at $(git -C "$DEMO_DIR" rev-parse --short HEAD)"

# LOADGEN=off starts the stack without the simulated shoppers (the `load-generator` service).
# Recommended on a laptop: it is the single biggest avoidable CPU load, and tests compete with it.
SCALE=()
[ "${LOADGEN:-on}" = "off" ] && SCALE=(--scale load-generator=0)

docker compose --project-directory "$DEMO_DIR" -f "$DEMO_DIR/compose.yaml" up -d ${SCALE[@]+"${SCALE[@]}"}  # the ${..+..} form keeps an empty array safe under set -u on macOS bash 3.2
"$ROOT/scripts/wait-for-demo.sh"
