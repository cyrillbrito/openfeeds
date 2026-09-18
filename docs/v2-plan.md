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

1. **One container, one file.** `docker run -v ./data:/data openfeeds`
2. **One framework.** Full-stack, as native as possible. No meta-stack glue.
3. **Boring data path.** SQLite + plain endpoints + a query cache. No sync engine.
4. **Self-hostable.** The spine — vetoes any hosted-only dependency.
5. **Enjoyable to work on.**

### Not in v2.0

Local-first / offline · AI & TTS · realtime cross-device sync · multi-machine scaling.

---

# Settled

### SQLite

Simplicity, testing, local dev — the whole point. Drizzle's libSQL driver means a deployment
wanting managed backups can point at Turso via one env var, no code change.

**Turso Sync (browser replication) rejected:** requires Turso Cloud (breaks self-hosting),
partial sync not shipped (browser would receive the whole multi-user DB), OIDC limited to
Clerk/Auth0, beta with last-push-wins. Same shape of bet as Electric, one rung less mature.

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
are no longer silently dropped, and `content:encoded` is preferred over the `<description>` teaser
so full-text feeds are no longer truncated.

---

# Open

Ordered by how hard each is to reverse later. Spend deliberation accordingly.

## 1. Database architecture

Multi-user is settled; the layout is not.

**One shared DB, `user_id` on user tables** — simple: one file, one migration path, one
connection. Makes shared feed fetching possible. Scaling is a non-issue for a long time. Risk is
that a forgotten `userId` filter leaks or loses data — not theoretical: v1's GUID dedup at
`rss-sync.ts:94` omits it, so once any user has an article GUID, no other user ever gets it.
Mitigated by a repository layer where `userId` is always the first argument.

**One DB per user** — isolation is structural, so the bug above is impossible to write. Per-user
export/delete/backup is a file operation. Shards writes (SQLite has one writer per DB). Cost:
needs a shared "system" DB for anything cross-user, and migrations run across N+1 files where
partial failure strands users on mixed schema versions.

Coupled to (2) — decide them together.

The single-user prototype sidesteps this rather than answering it: no `userId` column exists. It
does keep the cheap half of the option open — `feeds.feed_url` is canonical and unique.

## 2. Feed sharing

Popular feeds are heavily shared. The risk isn't bandwidth, it's **getting rate-limited or
blocked** — 50 subscribers to one YouTube channel = 50 requests/hour to one host from one IP.
Bites at modest scale, not just at scale. Never actually hit in v1.

**Current lean: don't build it yet, but don't preclude it.** Options in increasing cost — keep
per-user fetching; dedupe the *fetch* via a global `feed_sources` table and fan out to per-user
article rows; or fully normalise (global articles + per-user state, the Feedbin model).

The cheap way to keep the path open is to make feed *identity* canonical from day one — a
normalised feed URL that's unique across the system — even while fetching stays per-user. That's
the hard half of the migration, and it costs almost nothing to add up front.

## 3. Testing

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
- **HTML sanitising.** `src/lib/sanitize-html.ts` is regex-based and explicitly a stopgap. A
  parser-based sanitiser is a prerequisite for multi-user, where one user's feed could otherwise
  script another's session.
- **Per-host politeness** — group a sync batch by host, cap concurrency per host. BullMQ never
  gave us this (its limiter is global).
- **Backfill on subscribe** — if feeds are ever shared, does a new subscriber get existing
  articles? Fetching once on subscribe keeps behaviour independent of other users.
- **Timestamps** — SQLite has no date type. Pick integer-ms or ISO text once, globally.
- **JS-rendered article pages.** An HTML parser (happy-dom or similar) handles static pages, but
  returns empty on pages that need JS. A real browser is the fallback — `Bun.WebView` would do it,
  but on Linux it drives an installed Chromium (~+500MB image), so it would have to be opt-in. The
  cheaper answer is the browser extension: it already has a real DOM and the host permissions the
  web app lacks.
