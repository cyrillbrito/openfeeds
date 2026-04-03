# Packaging only — build happens on CI runner
FROM oven/bun:1

WORKDIR /app

# NOTE: Correct long-term approach is making Nitro output truly self-contained
# (or explicitly externalizing only known runtime deps). We currently hit multiple
# runtime asset/module misses in production startup, so this is a stability-first
# shortcut: copy the full pruned runtime output produced in CI.
COPY out/ ./

# Pre-create data directory with correct ownership before switching to non-root
RUN mkdir -p /data && chown bun:bun /data

# Run as non-root
USER bun

EXPOSE 3000
CMD ["bun", "--bun", "run", "apps/web/.output/server/index.mjs"]
