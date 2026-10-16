#!/usr/bin/env bash
set -euo pipefail
DEMO_DIR="$(cd "$(dirname "$0")/.." && pwd)/.demo"
docker compose --project-directory "$DEMO_DIR" -f "$DEMO_DIR/compose.yaml" down --remove-orphans
