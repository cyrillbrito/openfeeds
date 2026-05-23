# Packaging only — build happens on CI runner.
# CI runs `turbo prune @repo/server @repo/web` so the pruned monorepo in out/
# contains both apps. Then `bun install` + `bun run build` builds the SPA
# (writes to apps/web/dist/). This Dockerfile just copies the result and
# runs the Hono server, which serves /api/* + the SPA fallback (see
# SERVE_SPA in apps/server/src/index.ts).
FROM oven/bun:1

WORKDIR /app

# Pruned monorepo: node_modules + sources + apps/web/dist (built on CI).
COPY out/ .

# The SPA bundle lives in ./web-dist relative to the server process cwd
# (apps/server/). Symlink it so `hono/bun` serveStatic finds it without us
# hardcoding a long relative path in the source.
RUN ln -s /app/apps/web/dist /app/apps/server/web-dist

# Pre-create data directory with correct ownership before switching to non-root.
RUN mkdir -p /data && chown bun:bun /data

USER bun

EXPOSE 3000
ENV SERVER_PORT=3000
ENV SERVE_SPA=true

WORKDIR /app/apps/server
CMD ["bun", "--bun", "run", "src/index.ts"]
