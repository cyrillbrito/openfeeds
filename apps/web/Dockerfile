# Packaging only — build happens on CI runner
# Nitro's node-server output is fully self-contained
FROM node:24-slim

WORKDIR /app

# Copy pre-built Nitro output (already has chunkIds injected, sourcemaps removed)
COPY out/apps/web/.output ./.output

# Pre-create data directory with correct ownership before switching to non-root
RUN mkdir -p /data && chown node:node /data

# Run as non-root
USER node

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
