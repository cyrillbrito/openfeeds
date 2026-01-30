# Use Bun image as base
FROM oven/bun:1 AS base


# Pruner stage - prune the monorepo
FROM base AS pruner

# Install turbo globally
RUN bun install -g turbo@^2

# Copy entire monorepo
COPY . .

# Generate a partial monorepo with a pruned lockfile for the "web" workspace
RUN turbo prune @repo/web --docker


# Builder stage - install dependencies & build
FROM base AS builder

# Copy pruned lockfile and package.json files first (changes less often)
COPY --from=pruner /home/bun/app/out/json/ .

# Install dependencies using Bun with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# Copy the full pruned source code
COPY --from=pruner /home/bun/app/out/full/ .

# Build the web app (TanStack Start outputs to .output/)
# Create .env file with dummy values for prerendering
# The Nitro prerender spawns a subprocess that needs these env vars
# Using a file ensures they're available regardless of how the process is spawned
RUN echo 'BETTER_AUTH_SECRET=build-time-placeholder' >> apps/web/.env && \
    echo 'CLIENT_DOMAIN=http://localhost:3000' >> apps/web/.env && \
    echo 'DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder' >> apps/web/.env

RUN bun run build --filter=@repo/web


# Runner stage - final production image
FROM base AS runner

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /home/bun/app/apps/web/.output ./.output
COPY --from=builder /home/bun/app/node_modules ./node_modules

EXPOSE 3000
CMD ["bun", "--bun", "run", ".output/server/index.mjs"]
