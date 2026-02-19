# Packaging only — build happens on CI runner
# Nitro's node-server output is fully self-contained
FROM oven/bun:1

WORKDIR /app

# Copy pre-built Nitro output (already has chunkIds injected, sourcemaps removed)
COPY out/apps/web/.output ./.output

# Run as non-root
USER bun

EXPOSE 3000
CMD ["bun", "--bun", "run", ".output/server/index.mjs"]
