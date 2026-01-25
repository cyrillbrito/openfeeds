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
# Dummy env vars for prerendering - app requires these at build time for SSR
ENV BETTER_AUTH_SECRET="build-time-placeholder"
ENV CLIENT_DOMAIN="http://localhost:3000"
RUN bun run build --filter=@repo/web


# Runner stage - final production image
FROM base AS runner

WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /home/bun/app/apps/web/.output ./.output
COPY --from=builder /home/bun/app/node_modules ./node_modules

EXPOSE 3000
CMD ["bun", "--bun", "run", ".output/server/index.mjs"]
