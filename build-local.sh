#!/usr/bin/env bash
# Replicate CI build pipeline locally to test Docker images before pushing.
# Usage:
#   ./build-local.sh          # build all 3 images
#   ./build-local.sh web      # build only web
#   ./build-local.sh worker   # build only worker
#   ./build-local.sh migrator # build only migrator
#
# After building, run with:
#   docker compose -f docker-compose.prod-local.yml up

set -euo pipefail

if [[ $# -eq 0 ]]; then
  TARGETS=(web worker migrator)
else
  TARGETS=("$@")
fi
TAG="local"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[build-local]${NC} $*"; }
warn() { echo -e "${YELLOW}[build-local]${NC} $*"; }
err()  { echo -e "${RED}[build-local]${NC} $*" >&2; }

cleanup() {
  if [[ -d "out" ]]; then
    log "Cleaning up out/ directory"
    rm -rf out
  fi
}

build_app() {
  local app="$1"
  local image_name="openfeeds-${app}"
  local dockerfile="apps/${app}/Dockerfile"

  # migrator image is named differently in prod
  if [[ "$app" == "migrator" ]]; then
    image_name="openfeeds-migrations"
  fi

  log "========================================="
  log "Building: ${app}"
  log "========================================="

  # Clean previous out/
  cleanup

  # Step 1: Turbo prune (same as CI)
  log "[${app}] Pruning monorepo for @repo/${app}..."
  bunx turbo@^2 prune "@repo/${app}"

  # Step 2: Install deps in pruned output (same as CI, no --frozen-lockfile)
  log "[${app}] Installing dependencies in out/..."
  (cd out && bun install)

  # Step 3: Build (migrator skips this, same as CI)
  if [[ "$app" != "migrator" ]]; then
    log "[${app}] Building..."
    (cd out && bun run build)
  fi

  # Step 4: Docker build
  log "[${app}] Building Docker image ${image_name}:${TAG}..."
  docker build \
    -f "${dockerfile}" \
    -t "${image_name}:${TAG}" \
    .

  log "[${app}] Done! Image: ${image_name}:${TAG}"

  # Clean up for next build
  cleanup
}

# Main
log "Building targets: ${TARGETS[*]}"
echo ""

for target in "${TARGETS[@]}"; do
  case "$target" in
    web|worker|migrator)
      build_app "$target"
      echo ""
      ;;
    *)
      err "Unknown target: $target (valid: web, worker, migrator)"
      exit 1
      ;;
  esac
done

log "All builds complete!"
log "Run with: docker compose -f docker-compose.prod-local.yml up"
