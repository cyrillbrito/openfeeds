# Packaging only — build happens on CI runner.
# CI runs `turbo prune @repo/api @repo/web` so the pruned monorepo in out/
# contains both apps. Then `bun install` + `bun run build` builds the SPA
# (writes to apps/web/dist/). This Dockerfile just copies the result and
# runs the Hono server, which serves /api/* + the SPA fallback (see
# SERVE_SPA in apps/api/src/index.ts).
FROM oven/bun:1

WORKDIR /app

# Pruned monorepo: node_modules + sources + apps/web/dist (built on CI).
COPY out/ .

# The SPA bundle lives in ./web-dist relative to the api process cwd (apps/api/).
# Symlink it so `hono/bun` serveStatic finds it without us hardcoding a long
# relative path in the source.
RUN ln -s /app/apps/web/dist /app/apps/api/web-dist

# Pre-create data directory with correct ownership before switching to non-root.
RUN mkdir -p /data && chown bun:bun /data

USER bun

EXPOSE 3000
ENV API_PORT=3000
ENV SERVE_SPA=true

WORKDIR /app/apps/api
CMD ["bun", "--bun", "run", "src/index.ts"]
