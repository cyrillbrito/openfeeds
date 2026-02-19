# Packaging only — build happens on CI runner
# turbo prune + bun install + bun build runs on the runner,
# producing a self-contained pruned monorepo in out/
FROM oven/bun:1

WORKDIR /app

# Copy pre-built pruned monorepo (includes node_modules and built deps)
# Root package.json is included — version is read at runtime by @repo/domain
COPY out/ .

CMD ["bun", "--bun", "run", "apps/worker/src/index.ts"]
