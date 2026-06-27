# Packaging only — build happens on CI runner.
# CI runs `turbo prune @repo/server @repo/web @repo/marketing` so the pruned
# monorepo in out/ contains all three apps. Then `bun install` + `bun run build`
# builds the SPA (writes to apps/web/dist/) and the Astro static marketing
# bundle (writes to apps/marketing/dist/). This Dockerfile just copies the
# result and runs the Hono server, which serves /api/* + marketing + email
# assets + the SPA fallback.
FROM oven/bun:1.3.12

WORKDIR /app

# Pruned monorepo: node_modules + sources + built app bundles + email assets.
COPY out/ .

# Symlink server-served static artifacts under one root.
RUN mkdir -p /app/apps/server/dist \
 && ln -sfn /app/apps/web/dist /app/apps/server/dist/web \
 && ln -sfn /app/apps/marketing/dist /app/apps/server/dist/marketing \
 && ln -sfn /app/packages/emails/public/emails /app/apps/server/dist/emails

# Pre-create data directory with correct ownership before switching to non-root.
RUN mkdir -p /data && chown bun:bun /data

USER bun

EXPOSE 3000
ENV SERVER_PORT=3000

WORKDIR /app/apps/server
CMD ["bun", "--bun", "run", "src/index.ts"]
