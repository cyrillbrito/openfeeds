# Migrations service - runs database migrations and exits
FROM oven/bun:1 AS base


# Pruner stage - prune the monorepo
FROM base AS pruner

# Install turbo globally
RUN bun install -g turbo@^2

# Copy entire monorepo
COPY . .

# Generate a partial monorepo with a pruned lockfile for the "migrator" workspace
RUN turbo prune @repo/migrator --docker


# Builder stage - install dependencies
FROM base AS builder

# Copy pruned lockfile and package.json files first
COPY --from=pruner /home/bun/app/out/json/ .

# Install dependencies using Bun with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# Copy the full pruned source code
COPY --from=pruner /home/bun/app/out/full/ .


# Runner stage - minimal image with only what's needed for migrations
FROM base AS runner

WORKDIR /app

# Copy everything from builder (pruned monorepo structure)
COPY --from=builder /home/bun/app .

CMD ["bun", "--bun", "run", "apps/migrator/src/index.ts"]
