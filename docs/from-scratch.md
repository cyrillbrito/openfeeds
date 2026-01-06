# Build from Scratch

Avoid doing from scratch, better to just focus per app. From scratch there is no global settings that are relevant.

## Better-T-Stack Setup

```bash
bun create better-t-stack@latest openfeeds \
  --frontend solid --backend elysia --runtime bun \
  --auth better-auth --database sqlite --orm drizzle \
  --package-manager bun --addons oxlint turborepo \
  --api none --payments none --db-setup none --no-git \
  --web-deploy none --server-deploy none --no-install --examples none

cd openfeeds
```

## E2E

just copied whole project, since setup with bun was not working.

## Marketing

```
cd apps && bun create astro@latest marketing && cd ..
```

## Worker

```
cd apps && bun init worker && cd ..
```

## Additional Packages

```bash

# Create packages
cd packages && rm -rf env && rm -rf config  && bun init discovery && bun init scripts && bun init shared && cd ..

# E2E setup
cd apps && mkdir e2e && cd e2e
bun init && bun add -D playwright @playwright/test
bunx playwright install && cd ../..
```

## Dependencies

```bash
# API
cd apps/server
bun add @bull-board/api bullmq @mozilla/readability jsdom p-queue posthog-node redaxios resend feedsmith
cd ../..

# Web
cd apps/web
bun add daisyui @tanstack/solid-query @tanstack/solid-query-devtools posthog-js tailwind-merge \
  @solid-primitives/autofocus @solid-primitives/date @solid-primitives/scheduled
cd ../..

# DB
cd packages/db
bun add drizzle-orm && bun add -D drizzle-kit
cd ../..

# Discovery
cd packages/discovery && bun add feedsmith redaxios && cd ../..
```

## Environment

**apps/server/.env:**

```env
DB_PATH=.data/local.db
BETTER_AUTH_SECRET=your-secret
CORS_ORIGINS=http://localhost:3001
```

**apps/web/.env:**

```env
VITE_API_URL=http://localhost:3000
```

## Run

```bash
bun install && bun dev
```

## Alternative: Manual Setup

```bash
bunx create-turbo@latest --example with-shell-commands  # Name: openfeeds, bun
cd openfeeds

cd apps
bunx create-tsrouter-app@latest web --framework solid --template file-router
bun create elysia@latest api  # Name: api, bun
cd ..

cd packages
bun init db && bun init discovery && bun init shared && bun init scripts
cd ..
```
