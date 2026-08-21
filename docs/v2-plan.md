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
later. What goes is the *tooling* around it: plain `bun`/`pnpm` workspaces, no Turborepo. Turbo's
caching and task graph pay off across many packages and a CI matrix; with an app plus an
extension it's config to maintain for no return.

What does **not** come back is v1's package sprawl. Those packages existed mainly to share code
between `web` and `worker` — no worker, no reason. The web app is one package, and the only
structural rule that matters inside it is a hard `src/server/**` boundary, which is where the
client/server split pain lived in v1.

### Tailwind

Staying. Only the component layer on top is in question.

---

# Open

Ordered by how hard each is to reverse later. Spend deliberation accordingly.

## 1. Framework + UI + agent ergonomics — *one decision, not three*

Hardest to reverse; everything is written in it.

**The pull toward Solid 2:** genuinely exciting — async as a first-class citizen of the reactive
graph, a trusted author, excellent performance. API churn (`createResource`/`batch`/
`startTransition` removed, memos return promises, `<Loading>`/`<Errored>`/`<Reveal>`) is the
cheap kind of change and agents handle documented renames fine.

**The pull toward React:** it's the standard. Better agent support, deeper ecosystem, far more
material when debugging, and shadcn officially. Less to explore means less to get stuck in — and
getting stuck is what stalled v1.

**What's actually risky about Solid 2** isn't the API, it's the ecosystem seam: SolidStart v2
went stable 2026-08-04 (Vite Environment API, Vite 8/Rolldown, Node 24+), then two weeks later
Solid 2.0 RC announced SolidStart is retired and absorbed into "start mode". Stable ≠ future,
and most docs and training data describe whichever one you aren't using.

**On accessibility:** the DaisyUI critique is right — it's styling over browser defaults, with no
focus management, no ARIA wiring, no keyboard semantics. But that doesn't force React.
**Kobalte** is Solid's Radix equivalent (unstyled, WAI-ARIA), and three shadcn ports sit on it:
`solid-ui` (~1.3k stars, also uses corvu), `shadcn-solid`, `solidcn`. Community-maintained and
smaller than the React originals — that's the real trade, not availability. Solid 2 RC claims
Kobalte is ready; verify rather than trust.

So accessibility is solvable either way. The decision is really: **how much does agent support
and ecosystem depth matter versus working in something you enjoy?** Given that the stated reason
for v2 is lost motivation, that's not a tiebreaker to wave away in either direction.

**How to decide:** one week, throwaway code, in whichever is preferred — an auth-gated page that
server-fetches from SQLite, mutates, revalidates, using the real component library. That exercises
the framework, the UI kit, the server/client boundary, and what it's like to work with an agent on
it, all at once.

## 2. Database architecture

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

Coupled to (3) — decide them together.

## 3. Feed sharing

Popular feeds are heavily shared. The risk isn't bandwidth, it's **getting rate-limited or
blocked** — 50 subscribers to one YouTube channel = 50 requests/hour to one host from one IP.
Bites at modest scale, not just at scale. Never actually hit in v1.

**Current lean: don't build it yet, but don't preclude it.** Options in increasing cost — keep
per-user fetching; dedupe the *fetch* via a global `feed_sources` table and fan out to per-user
article rows; or fully normalise (global articles + per-user state, the Feedbin model).

The cheap way to keep the path open is to make feed *identity* canonical from day one — a
normalised feed URL that's unique across the system — even while fetching stays per-user. That's
the hard half of the migration, and it costs almost nothing to add up front.

## 4. Testing

v1 used Playwright. Worth reconsidering, but the framing needs correcting: **Vitest browser mode
is not an alternative to Playwright — it drives Playwright underneath.** It went stable in Vitest
4; the choice is which runner orchestrates, and it buys one config and one `expect` across unit
and browser tests.

Likely answer is both, doing different jobs: Vitest browser mode for components, Playwright
directly for full E2E flows. Cheap to reverse — tests are additive.

## 5. Runtime: Bun or Node

**Bun** — embeds a lot (SQLite, test runner, bundler, cron), very fast, and resolves the ESM /
TypeScript import friction that caused real pain in v1.

**Node** — the standard, better supported, more material to debug against. Relevant: SolidStart
v2 states Node 24+, and Vite 8/Rolldown is a Node toolchain, so a Solid path may mean Node for
dev/build even with Bun at runtime.

**Most reversible decision here** — Nitro presets make the deploy target roughly a config line,
and it's not a rewrite either way. Don't let it block anything; decide it late.

---

## Rabbit holes for later

Pointers, not designs.

- **Conditional GET.** v1's `rss-fetch.ts` is a bare `fetch(url)` — no `If-None-Match` /
  `If-Modified-Since`, so every sync downloads every feed body in full. ~10 lines, widely
  supported, a 304 is a few hundred bytes with no parse. Distinct from GUID dedup, which skips
  the *write* but still downloads and parses. Biggest efficiency win available, and it's
  independent of the feed-sharing decision.
- **Feed URL normalisation** — the canonical identity above. `http`/`https`, trailing slashes,
  `?utm_*`, FeedBurner, YouTube's several channel-feed URL forms. Duplicate sources are harmless;
  wrongly merged ones aren't.
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
