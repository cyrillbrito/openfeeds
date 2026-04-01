# Packaging only — build happens on CI runner
# Nitro's node-server output is fully self-contained
FROM oven/bun:1

WORKDIR /app

# Copy pre-built Nitro output (already has chunkIds injected, sourcemaps removed)
COPY out/apps/web/.output ./.output

# Pre-create data directory with correct ownership before switching to non-root
RUN mkdir -p /data && chown bun:bun /data

# Run as non-root
USER bun

EXPOSE 3000
CMD ["bun", "--bun", "run", ".output/server/index.mjs"]
