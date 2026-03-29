# Packaging only — build happens on CI runner
# TanStack Start Vite output is fully self-contained
FROM node:24-slim

WORKDIR /app

# Copy pre-built output (already has chunkIds injected, sourcemaps removed)
COPY out/apps/web/dist ./dist

# Pre-create data directory with correct ownership before switching to non-root
RUN mkdir -p /data && chown node:node /data

# Run as non-root
USER node

EXPOSE 3000
CMD ["node", "dist/server/server.js"]
