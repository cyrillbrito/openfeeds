# Packaging only — build happens on CI runner
# turbo prune + pnpm install runs on the runner,
# producing a self-contained pruned monorepo in out/
FROM node:24-slim

WORKDIR /app

# Copy pre-built pruned monorepo (includes node_modules and built deps)
COPY out/ .

# Run as non-root
USER node

CMD ["./node_modules/.bin/tsx", "apps/migrator/src/index.ts"]
