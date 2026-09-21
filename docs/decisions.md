# Decisions

What is settled for v2 and what is still open. Read this before proposing architecture.

v1 works but costs 7 containers and 33k lines. Two cloud-scale tools drove most of that —
**Electric SQL** (local-first sync) and **BullMQ/Redis** (distributed queue) — and neither was
load-bearing. The goals that follow from that:

1. **Two containers**: app + Postgres, one `compose.yml`.
2. **One framework.** No meta-stack glue.
3. **Boring data path.** One relational database, plain endpoints, a query cache.
4. **Self-hostable.** The spine — this vetoes any hosted-only dependency.

Out of scope for 2.0: local-first/offline, AI & TTS, realtime cross-device sync,
multi-machine scaling.

---

## Settled

**Postgres, one shared database, fully normalised.** `feeds` and `articles` are global — one
row per canonical feed URL, one per entry. `subscriptions` and `article_state` carry the
per-user half. Shared fetching then falls out for free: 50 subscribers to a channel is one
request an hour, not 50. Postgres over SQLite because the cron sweep writing while readers
mark things read is exactly the concurrent-writer case SQLite serialises, and because
`timestamptz` retires a whole class of date bugs.

The cost is honest: `docker run -v ./data:/data` is dead, and self-hosters own `pg_dump`.

Driver is `drizzle-orm/bun-sql` over Bun's built-in `Bun.SQL` — no `pg`, no native module.
Tests use **PGlite** (`memory://`), Postgres compiled to WASM, so `bun run test` needs no
container.

**No sync engine.** Electric bought instant mark-as-read and offline reading. A query cache
gives the first; the second was never real, since most content is YouTube and full text is
not pre-fetched.

**No queue — cron in the app process.** `feeds.nextFetchAt` is the queue. Job state could
only ever mirror the feeds table and then drift from it, so keeping the schedule on the row
it describes is what makes the sweep self-healing across crashes. Retries are backoff in
hours plus a visible per-feed error, because RSS failures are persistent, not transient.

**Better Auth, not Clerk.** Clerk is hosted SaaS, which the self-hosting veto kills. Better
Auth also already solves MCP: `@better-auth/oauth-provider` makes the instance a full OAuth
2.1 authorization server.

**Solid 2 + start mode.** SolidStart is retired; its capabilities moved into core and the
Vite plugin. Coordinated-RC packages are pinned exact — carets pull mismatched prereleases.

**Bun**, runtime and package manager, `bun:*` APIs included. `Bun.cron` and `Bun.SQL` are
what make the no-queue and no-driver decisions free.

**Tailwind 4** as a Vite plugin, theme in `src/app.css`, no config file.

**Kobalte `2.0.0-alpha`** with shadcn components **vendored** into `src/components/ui`. Every
shadcn-for-Solid port targets Kobalte 0.13 / Solid 1, so none of them installs; the
components are thin enough that owning the source is cheaper than waiting.

**feedsmith** for parsing. It preserves each format's structure rather than normalising, so
`src/server/feeds/normalize.ts` is ours — which is right, because that mapping is where feed
reality lives (`guid` vs `id` vs `url`, `content:encoded` vs `description`, RFC 822 vs ISO).

**The list links out.** No article page, no readability extraction, no HTML sanitiser, no
full-text column. The feed's own body is parsed for the excerpt and the fallback thumbnail,
stored once as `articles.summary`, and never rendered. The shorts viewer is the only screen
that plays content in-app. Reversible: a reader pane means re-adding a parser-based
sanitiser and a body column.

**Workspaces, not Turborepo.** Turbo's caching pays off across many packages and a CI matrix;
with an app and an extension it is config for no return. v1's package sprawl existed to share
code between `web` and `worker` — no worker, no reason.

---

## Open

**Testing.** The scaffold ships Vitest 4 with client (jsdom) and server (node) projects.
Open: whether to add Vitest browser mode for components and Playwright for E2E. Cheap to
reverse.

**Backfill on subscribe.** Feeds are shared, so a new subscriber finds a feed row that
already has articles. Does their inbox start empty, at the feed's current window, or with
everything collected? Only a question because the rows are global.

**Per-user retention.** Global articles are never deleted because one reader is done with
them. Something eventually has to decide when a row nobody subscribes to goes away.

---

## Rabbit holes

Pointers, not designs.

- **Feed URL normalisation** — `canonicalizeFeedUrl` handles scheme, host case, default
  ports, fragments, `utm_*`. Still open: FeedBurner and YouTube's several channel-feed forms.
- **Feed encoding** — `response.text()` assumes UTF-8; feeds declaring ISO-8859-1 or
  windows-1252 in their prolog decode to mojibake. Reads as a display bug, is a fetch bug.
- **Per-host politeness** — group a sync batch by host and cap concurrency per host.
- **Migration advisory lock** — boot-time migrations race if two instances start together.
  One `pg_advisory_lock` in `src/server/db/index.ts` fixes it; unnecessary single-instance.
