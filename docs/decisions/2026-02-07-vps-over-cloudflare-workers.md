# VPS over Cloudflare Workers for Cloud Deployment

**Date:** 2026-02-07
**Status:** Decided — VPS with Cloudflare CDN proxy
**Context:** Choosing deployment strategy for the managed cloud offering

## Decision

Run the web app and worker on a single VPS (Hetzner/Fly.io). Use Cloudflare's free CDN proxy in front for static asset caching, SSL, and DDoS protection. Do not deploy the web app to Cloudflare Workers.

Self-hosters run everything with Bun + Docker Compose as-is.

## Why Not Cloudflare Workers

### Hard Blockers

1. **Bun-native Postgres driver** — `packages/db` uses `import { SQL } from 'bun'` with `drizzle-orm/bun-sql`. Workers can't run this. Would need to swap to an HTTP-based driver (Neon serverless, Hyperdrive) and maintain two driver paths or fully migrate away from Bun's driver.

2. **BullMQ job enqueueing** — Web server functions enqueue BullMQ jobs via persistent TCP Redis connections. Workers don't support persistent TCP. Options: Cloudflare Queues (different API), Upstash HTTP Redis, or an HTTP bridge to the VPS worker. All require rework of every `addJob()` call path.

3. **File system for TTS audio** — `packages/domain/src/tts.ts` writes `.mp3` files to disk with `node:fs`. Workers have no filesystem. Would need R2 or serving audio from the VPS directly.

### Already Solved (Not Blockers)

- **Database** — Using managed Postgres (cloud-hosted), not self-hosted. No issue.
- **Electric SQL** — Using Electric Cloud. Client could potentially connect directly, bypassing the proxy. The proxy itself is just HTTP fetches and would work on Workers.

### Still Need a VPS Regardless

Even with Workers for the web app, the **BullMQ worker process** (`apps/worker/`) is a long-running Bun process that cannot run on serverless. A VPS is still required for background job processing. This means Workers doesn't eliminate infrastructure — it adds a second deployment target.

## Why VPS Is Fine

- **Low traffic** — RSS reader with dozens to low hundreds of users checking feeds a few times daily. A $6-12/month VPS handles this easily.
- **SSR latency is acceptable** — TanStack Start SSR adds ~100-200ms for distant users vs edge. After initial load, SolidJS hydrates and Electric SQL handles real-time sync client-side. Users won't notice.
- **Single deployment target** — Docker Compose runs web, worker, and migrator. No architecture split needed.
- **Zero code changes** — Everything works as-is with Bun.

## CDN Still Helps (Partially)

With Cloudflare free proxy in front of the VPS:

| What                                 | Cached at edge? | Impact                                         |
| ------------------------------------ | --------------- | ---------------------------------------------- |
| JS bundles, CSS, fonts (`/_build/*`) | Yes             | Faster subsequent loads, less VPS bandwidth    |
| Images, static assets                | Yes             | Same                                           |
| SSR HTML responses                   | No              | Always hits VPS — acceptable for this use case |
| Server functions / API calls         | No              | Always hits VPS                                |
| Electric SQL shape requests          | No              | Go to Electric Cloud directly                  |

The static assets (bulk of bytes) get cached. The SSR HTML (small payload, rendered once per navigation) hits the VPS — fine for a personal/small-user-base app.

## Cost Comparison

| Setup                        | Monthly estimate                                                      |
| ---------------------------- | --------------------------------------------------------------------- |
| **VPS only** (Hetzner CAX11) | ~$6 + managed Postgres + Electric Cloud                               |
| **Workers + VPS hybrid**     | ~$5 Workers paid + VPS for worker + managed Postgres + Electric Cloud |

No meaningful savings. The hybrid adds operational complexity (two deployment pipelines, driver abstraction, queue bridging) for roughly the same cost.

## Revisit If

- User base grows to thousands with global distribution — edge SSR starts mattering
- Cloudflare adds native BullMQ-compatible queue or persistent connections
- A drop-in Drizzle driver works on both Bun and Workers without code changes
