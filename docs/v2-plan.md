# OpenFeeds v2

Decisions, open topics, and the reasoning behind them. Not an implementation plan — v2 is a
full rewrite, so nothing here is about porting code.

## Why

v1 works but is expensive to own: 7 containers for a self-hoster (`postgres` w/ logical
replication + `redis` + `electric` + `migrator` + `web` + `worker` + `queuedash`), 33k lines
across 7 apps and 7 packages.

Two cloud-scale tools drove most of it — **Electric SQL** (local-first sync) and
**BullMQ/Redis** (distributed queue) — neither load-bearing here. The local-first bet in
particular never paid off: most content is YouTube (unwatchable offline) and full text isn't
pre-fetched, so the offline story was theoretical while the costs were real.

### Goals

1. **Two containers, no more.** App + Postgres, one `compose.yml`. Amended from "one
   container, one file" — see the Postgres decision below for what that cost and why it was
   paid.
2. **One framework.** Full-stack, as native as possible. No meta-stack glue.
3. **Boring data path.** One relational database + plain endpoints + a query cache. No sync
   engine.
4. **Self-hostable.** The spine — vetoes any hosted-only dependency.
5. **Enjoyable to work on.**

### Not in v2.0

Local-first / offline · AI & TTS · realtime cross-device sync · multi-machine scaling.

---

# Settled

### Postgres, one shared database

**Reversed from SQLite.** The prototype shipped on `bun:sqlite`, and the trade is now decided the
other way. Taken together with the normalisation decision below, this closes what were open
questions 1 and 2.

The layout is **one shared database, fully normalised**: `feeds` and `articles` are global, one
row per canonical feed URL and one row per entry, with per-user data arriving later as
`subscriptions` and `article_state`. The alternative — per-user copies of every article row —
stores the same YouTube video once per subscriber, and the duplication is in the largest columns
in the schema (`summary`). Normalising also makes shared fetching fall out for free
rather than needing a design: one feed row, one `nextFetchAt`, one request per hour no matter how
many people follow it. That was the actual risk in question 2 — not bandwidth, but 50 requests an
hour to one host from one IP getting the self-hoster blocked.

Given a shared, normalised database, three things pick Postgres over SQLite:

- **Concurrent writers.** SQLite serialises writes database-wide. The cron sweep writing articles
  while readers mark things read is precisely that contention, and it gets worse with every user
  since they now share one file. WAL and `busy_timeout` raise the ceiling; they do not remove it.
- **Real types.** `timestamptz` retires the "pick integer-ms or ISO text, globally" question that
  sat in the rabbit-hole list. Also `jsonb`, real booleans, and `ALTER TABLE` that does not
  rewrite the table.
- **Timing.** The schema is two tables with no production data. This is the cheapest this port
  will ever be; after auth and real users it is a migration project.

**What it costs, stated plainly:** goal 1 as originally written. `docker run -v ./data:/data
openfeeds` is dead, and with it "back up by copying a file". Self-hosters now run a second
container and own `pg_dump`. This is the same complexity v1 was criticised for at the top of this
document — the difference is that v1 needed Postgres *with logical replication* to feed a sync
sidecar, plus Redis, plus a worker, plus a queue dashboard. A plain Postgres and nothing else is
one container, not six, and it buys the data model rather than a sync engine we already rejected.

**Driver: `drizzle-orm/bun-sql`**, wrapping Bun's built-in `Bun.SQL`. No `pg`, no `postgres.js`,
no native module — the switch cost zero dependencies, which is the Bun commitment paying off a
second time.

**Local development: `compose.yml` at the repo root, Postgres only.** The app still runs on the
host under Bun; the container is infrastructure, not a dev environment. One compose file — the
self-host image gets added to it as a second service behind a profile rather than forked into a
`compose.prod.yml` that drifts.

**Tests use PGlite** (`memory://`), real Postgres compiled to WASM and run in-process. It
replaces SQLite's `:memory:` and keeps the suite hermetic; without it `bun run test` would need
`docker compose up` first, on every machine and in CI. It is from the Electric SQL people and is
not Electric — no sync, no replication, no server. Reversible: it is a devDependency behind one
branch in `src/server/db/index.ts`.

**Turso / libSQL is no longer the escape hatch.** It was the SQLite-compatible answer to managed
backups; on Postgres that is every managed provider in existence. **Turso Sync (browser
replication) stays rejected** on its own merits: requires Turso Cloud (breaks self-hosting),
partial sync not shipped, OIDC limited to Clerk/Auth0, beta with last-push-wins.

### No sync engine

Electric bought instant mark-as-read and offline reading. Optimistic mutations in a query cache
give the first; the second was never real. It cost Postgres-with-logical-replication, a sync
sidecar, `user_id` denormalisation for shape filtering, per-entity collection plumbing, and a
class of UI crashes.

### No queue — cron in the app process

BullMQ + Redis + a worker app + queuedash wrapped what is, in v1, a loop calling one function.
Job state only ever duplicated DB state and could drift from it; the feeds table already knows
what needs fetching, which makes the cron approach self-healing.

The real loss is retries — but v1's retries were seconds-scale and silent. RSS failures are
persistent (dead domain, moved feed, new Cloudflare rule), so the right model is backoff in
**hours** plus a visible "this feed is broken" state, which v1 never had at all.

### Better Auth, not Clerk

Clerk is hosted SaaS → breaks self-hosting, the same veto that killed Turso Sync. And Better
Auth already solves MCP: `@better-auth/oauth-provider` makes the instance a full OAuth 2.1
authorization server (dynamic client registration, RFC 9207), and the MCP plugin builds on it
with RFC 8414 discovery. Exactly the MCP flow.

Auth felt tricky in v1 because of TanStack Start's Solid port, not Better Auth — the evidence is
`patches/better-auth@1.4.12.patch`, a one-line `react-start` → `solid-start` swap.

### Workspaces, but minimal

A monorepo is still needed — the browser extension is a separate build target, and likely more
later. What goes is the *tooling* around it: plain Bun workspaces, no Turborepo. Turbo's
caching and task graph pay off across many packages and a CI matrix; with an app plus an
extension it's config to maintain for no return.

What does **not** come back is v1's package sprawl. Those packages existed mainly to share code
between `web` and `worker` — no worker, no reason.

```
apps/web/         # the app
  src/server/**   # server-only, enforced at build time (see below)
apps/extension/   # browser extension
packages/shared/  # API types + client — stays exactly one package
```

### Solid 2 + start mode

Chosen and scaffolded. SolidStart is **retired** — its capabilities moved into core and into the
Vite plugin's "start mode", so there is no meta-framework layer any more. Most SolidStart
material online describes a thing that no longer exists.

`create-solid`'s `fullstack` template gave streaming SSR, file-system routing, server functions,
sessions and API routes. It also enforces the `src/server/**` boundary for free: a `server-only`
marker fails the build if that code can reach the client bundle. Vitest arrives configured with
two projects (client/jsdom, server/node), and oxlint ships with it.

Cost: Solid 2 is an RC and `@solidjs/router` is still a `next`. Coordinated-RC packages are
**pinned exact** — carets pull mismatched prereleases, and the docs warn the set must stay
compatible.

### Bun

Runtime and package manager, committed to — `bun:*` APIs included. Verified against the real
scaffold: build, both Vitest projects, dev SSR and the production server behave identically under
Bun and Node, and hydration, server functions and signed session cookies all work.

`Bun.cron` (1.3.11+, with an in-process overload for long-running servers) is precisely the
"cron in the app process" decision above — the no-queue plan needs no dependency at all.

Lock-in is small: Drizzle abstracts the SQLite driver, and `Bun.serve` takes start mode's
`handleRequest` directly, *deleting* the ~140 lines of Node http↔web glue in `server.js`.

**Correction:** the "Node 24+" figure came from SolidStart v2 and is obsolete. The real floor is
Node 20.19+ / 22.12+, a Vite 8 requirement.

### Tailwind

Staying — v4, as a Vite plugin, so there is no `tailwind.config.js` and the theme is declared in
`src/app.css`.

### UI: Kobalte 2 alpha, shadcn components vendored

`@kobalte/core@2.0.0-alpha.0` is the only accessibility layer that runs on Solid 2: its peers pin
`solid-js@2.0.0-rc.0` and `@solidjs/web@2.0.0-rc.0` exactly, matching our pins. The stable 0.13
line is Solid 1 only, and Kobalte is skipping 1.0 entirely.

All three shadcn-for-Solid ports (`solid-ui`, `shadcn-solid`, `solidcn`) sit on Kobalte 0.13, so
none of them installs. That turns out not to matter: shadcn's premise is copy-paste code you own,
and the components are thin — a Kobalte primitive plus `cva` and `cn`. They are **vendored** into
`src/components/ui` and retargeted. `hngngn/shadcn-solid` is the better base (shadcn-v4
generation, inline SVGs, no icon dependency).

The real porting cost was Solid's own changes, not Kobalte's — `splitProps`→`omit`,
`classList`→`class` array form, and the `ValidComponent` type moving to `@solidjs/web`. Kobalte's
own compound part names are unchanged from 0.13.

Cost: an alpha published days before adoption, with no migration guide. Mitigated by owning the
component source outright — a breaking change is a local edit, not a blocked upgrade.

### Parsing: feedsmith

`feedsmith@3.0.0-rc.3` handles RSS, Atom, RDF and JSON Feed behind one `parseFeed`. It preserves
each format's structure rather than normalising, so the mapping to our schema is ours to write and
own — which is the right split, because that mapping is exactly where feed-format reality lives
(`guid` vs `id` vs `url`, `content:encoded` vs `description`, RFC 822 vs ISO 8601).

Two v1 bugs are fixed by construction: the identity fallback chain means items without a `<guid>`
are no longer silently dropped, and `content:encoded` is used when a feed ships no
`<description>`, so those items still get a preview.

### The list links out — no reader, no extraction

There is no article page. A row's title opens the source in a new tab and marks the item read;
the **shorts viewer is the only screen that plays content in-app**, because a vertical video is
unwatchable as a link.

This is the single biggest thing v1 owned that v2 does not: readability extraction, an HTML
sanitiser, a reader layout, and a body column holding every article's full text. The feed's own
body is still parsed — it is where the excerpt and the fallback thumbnail come from — but it is
stored once as `articles.summary` and never rendered.

Reversible: a reader pane means re-adding a parser-based sanitiser and a body column, and nothing
else.

---

# Open

Ordered by how hard each is to reverse later. Spend deliberation accordingly.

*(Database architecture and feed sharing used to be items 1 and 2 here. Both are settled above.)*

## 1. Per-user isolation: RLS, or the convention we have?

Multi-user is built. `subscriptions` and `article_state` exist, every function in
`server/feeds/queries.ts` takes `userId` as its first argument, and that id comes from the
session cookie in `server/require-user.ts` — never from a parameter the client controls.
Normalisation does the heavy lifting: `feeds` and `articles` are global, so there is no `userId`
on them to forget, and the exposure is confined to those two tables.

What remains open is whether convention is enough. A repository layer where `userId` is always
the first argument is what we have; Postgres row-level security would enforce it in the database,
where a query written in a hurry cannot bypass it. The cost of RLS is a per-request `SET LOCAL`
and a connection model that respects it.

The precedent for caring: v1's GUID dedup at `rss-sync.ts:94` omitted the user, so once any user
had an article GUID, no other user ever received it.

## 2. Testing

v1 used Playwright. Worth reconsidering, but the framing needs correcting: **Vitest browser mode
is not an alternative to Playwright — it drives Playwright underneath.** It went stable in Vitest
4; the choice is which runner orchestrates, and it buys one config and one `expect` across unit
and browser tests.

The scaffold already ships Vitest 4 with two projects — client in jsdom, server in node against
the real server build — so this is now an increment, not a decision: whether to add Vitest
browser mode for components and Playwright for full E2E flows. Cheap to reverse either way.

---

## Rabbit holes for later

Pointers, not designs.

- ~~**Conditional GET**~~ — done. `src/server/feeds/fetch.ts` stores the ETag / Last-Modified from
  each response and echoes them back, so an unchanged feed costs a 304 and no parse.
- **Feed URL normalisation** — partly done (`canonicalizeFeedUrl`): scheme, host case, default
  ports, fragments, `utm_*`. Deliberately conservative, since a wrongly merged feed loses a
  subscription while a duplicate is merely untidy. Still open: FeedBurner and YouTube's several
  channel-feed URL forms.
- **Feed encoding.** `response.text()` assumes UTF-8; feeds declaring ISO-8859-1 or windows-1252
  in their XML prolog decode to mojibake. Reads as a display bug, is a fetch bug.
- ~~**HTML sanitising**~~ — moot while nothing renders remote HTML. `sanitize-html.ts` is gone.
- **Per-host politeness** — group a sync batch by host, cap concurrency per host. BullMQ never
  gave us this (its limiter is global).
- **Backfill on subscribe** — now live, not hypothetical: feeds *are* shared, so a new subscriber
  finds a feed row that already has articles. Does their inbox start empty, at the feed's current
  window, or with everything ever collected? Only a question because the rows are global.
- **Migration advisory lock** — boot-time migrations race if two app instances start together.
  One `pg_advisory_lock` in `src/server/db/index.ts` fixes it; unnecessary while single-instance.
- ~~**Timestamps**~~ — settled by Postgres. `timestamptz` everywhere, `withTimezone` always.
- **Per-user retention.** Global articles are never deleted just because one reader archived
  them. Something eventually has to decide when a row nobody subscribes to any more goes away.
- ~~**JS-rendered article pages**~~ — dropped with the reader; see the link-out decision above.
