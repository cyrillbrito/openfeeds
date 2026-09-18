# Shorts viewer — idea & plan

Status: **phases 0-2 shipped 2026-08-24**, in the simplest form each could take. The open
questions at the bottom are still open; this document is the reasoning behind what exists and the
map of what was left out on purpose.

A dedicated screen that plays short vertical video from subscribed feeds as a scroll-snapped
queue, plus the classification work that makes shorts a first-class *kind* of article rather than
an awkward row in the inbox.

## What exists

| | |
|---|---|
| `src/lib/shorts.ts` | classification and URL building, pure and isomorphic |
| `articles.kind` | `'article' \| 'short'`, indexed with `published_at`; migration `0001` backfills the existing rows by URL |
| `normalize.ts` | sets `kind` on every parsed item, all three feed formats |
| `getShorts` / `getShortsCount` | the queue and the badge, in `lib/feeds.ts` |
| `/shorts` | the viewer — `src/routes/shorts.tsx` |
| sidebar | a `Shorts` entry with its own unread count |

Controls, both kinds:

| | |
|---|---|
| `↑` `↓` · `j` `k` · `PageUp` `PageDown` | previous / next |
| `Home` `End` | first / last |
| `Enter` `Space` | play the current short |
| `o` | open it on YouTube |
| `u` | toggle read |
| ▲ ▼ buttons + an `n / total` counter | the same two moves, for the mouse |

There is no pause or mute key, and there cannot be: a plain embed exposes no
controls to script. YouTube's own `k` / `m` work once the player has focus.

Verified against MrBeast's live channel feed: 15 entries in, 10 classified as shorts and 5 as
articles, matching the `/shorts/` links in the raw XML exactly.

Five decisions inside that are load-bearing and easy to undo by accident:

- **Poster frame until you click.** No autoplay attempt, no IFrame Player API, no auto-advance.
  The click IS the user gesture browsers require, so the entire autoplay-policy problem never
  arises, and exactly one `<iframe>` exists at a time.
- **Leaving a slide removes its iframe.** Removing it is the only way to stop it — see the note
  about pause above. Everything that changes the current slide goes through one `focusIndex`, so
  the wheel, the keys and the buttons cannot disagree about it.
- **The keyboard listener is on `window`, and the buttons are not decoration.** Once you click
  *inside* the player, focus belongs to a cross-origin iframe and its key events never reach the
  page. The on-screen buttons are what still works in that state.
- **The queue keeps read shorts.** Playing one marks it read, which revalidates the queue — if the
  query filtered read items out, the video playing under the cursor would vanish mid-frame.
  Instead it dims and the list holds still.
- **Shorts are excluded from the inbox and its "Mark all read", and nowhere else.** A feed's own
  page still shows everything that feed published. Each badge counts exactly what its screen shows.

Four things found the hard way, all commented at the site:

- `loading="lazy"` on the poster images does not resolve at all inside the snap scroller — the
  thumbnails stay at `naturalWidth` 0 even scrolled fully into view, so every stage renders black.
  They load eagerly.
- Programmatic **smooth scrolling does nothing** on a `scroll-snap-type: mandatory` container —
  neither `scrollTo({behavior:'smooth'})` nor CSS `scroll-behavior`. Assigning `scrollTop` works.
- `onCleanup` inside a `createEffect` callback warns `NO_OWNER_CLEANUP` and never runs, so the
  keydown listener has to be registered from the component body, guarded by `isServer`.
- **Any element child of the vendored `Button` comes back unclaimed at hydration** — an `<svg>`,
  even a `<span>`. Every other Button in the app happens to take plain text, which is why nothing
  had tripped over it. The chevrons are bare `▲` / `▼` glyphs for that reason.

---

## The finding that decides most of this

**YouTube's ordinary channel feed already tells us which entries are Shorts.** No API key, no
extra request, no heuristics:

```xml
<link rel="alternate" href="https://www.youtube.com/shorts/5mU6SRS2Bxo"/>   <!-- short -->
<link rel="alternate" href="https://www.youtube.com/watch?v=Qtl8lJwbd4g"/>  <!-- video -->
```

Verified live today against `?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA` — 10 of ~15 entries carried a
`/shorts/` link. And feedsmith already hands us everything else we need from the same entry:

```js
entry.yt.videoId              // "5mU6SRS2Bxo"
entry.media.group.thumbnails  // [{ url: ".../hqdefault.jpg", width: 480, height: 360 }]
entry.media.group.community   // { statistics: { views }, starRating: { average, count } }
```

So detection is **a regex on the link we already store**, applied at normalize time. That is the
whole mechanism. Everything below is UI work on top of a one-line classifier.

Because `articles.url` already holds the `/shorts/` URL for every short we ever ingested, the
backfill is a single `UPDATE`. No refetch.

### The two alternatives, and why they're not the mechanism

- **Undocumented playlist feeds.** A channel's `UC…` id rewrites into `UULF…` (long-form only),
  `UUSH…` (shorts only), `UULV…` (live). `…/feeds/videos.xml?playlist_id=UUSHX6OQ…` returns 200
  and a clean shorts-only feed. Discovered by brute force, undocumented, can vanish. Useful as a
  *subscription option* later ("subscribe to shorts only" / "no shorts"), useless as detection —
  it would mean double-subscribing to every channel.
- **`HEAD https://www.youtube.com/shorts/<id>`** → 200 means short, 303 means it redirected to
  `/watch` and isn't. One network round-trip per video. Last-resort fallback if YouTube ever stops
  emitting `/shorts/` links in the channel feed. Don't build on it.

---

## Data model

One new classification column on `articles`, and the two fields the viewer needs to render a tile
without re-parsing anything:

```ts
/** What this entry IS, not where it came from. 'article' unless proven otherwise. */
kind: text('kind', { enum: ['article', 'video', 'short'] })
  .notNull()
  .default('article'),
/** Poster frame. Feeds supply it via MRSS; articles rarely have one. */
thumbnailUrl: text('thumbnail_url'),
/** Seconds, when the feed says. YouTube's RSS never does; PeerTube and MRSS do. */
durationSeconds: integer('duration_seconds'),
```

plus `index('articles_kind_published_at_idx').on(table.kind, table.publishedAt)` — the shorts queue
is `where kind = 'short' and is_read = 0 order by published_at desc`, and the inbox grows a
`kind != 'short'` filter.

**Stored, not computed.** A `like '%/shorts/%'` at read time would work today, but the
classification is per-platform and will grow rules (PeerTube by duration, MRSS by aspect ratio),
and it needs to be re-derivable in a backfill. It belongs next to dedup and read state.

**Where the code goes.** A new `src/server/feeds/media.ts`:

```ts
export function classifyMedia(item, feedUrl): {
  kind: 'article' | 'video' | 'short';
  provider?: 'youtube' | 'peertube' | 'generic';
  embedId?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}
```

Pure function, one call from `normalize.ts`. Keeping it out of `normalize.ts` keeps that file about
*feed formats* and this one about *platforms* — two things that change for different reasons. Tests
mirror `normalize.test.ts`: fixture in, classification out.

---

## Playback: the actually hard part

### One persistent player, not one iframe per card

This is the biggest client decision and it is forced by browser autoplay policy:

- **Autoplay only works muted.** No exceptions, all modern browsers. Either start muted with an
  unmute affordance (what TikTok's web player does), or require one tap to start and keep audio
  alive from there.
- A **user gesture unlocks audio for that player**, and each iframe is its own context — a fresh
  iframe per slide means a fresh muted context per slide, i.e. audio dies on every advance.

So: **a single `<iframe>` that stays mounted, with `loadVideoById()` swapping the video.** The
scroller becomes full-height sentinel slides watched by an `IntersectionObserver`, with the player
fixed over the stage. Boring, no layout thrash, one iframe, audio survives.

The naive "map each short to its own `<iframe>` in a snap scroller" fights autoplay *and* burns
memory. Worth stating up front so nobody builds it twice.

### Embed URL

```
https://www.youtube-nocookie.com/embed/<videoId>?playsinline=1&rel=0&mute=1
```

in a `aspect-[9/16]` stage. Shorts embed fine through `/embed/` — there is no separate Shorts embed
endpoint, the only difference is the aspect ratio.

### Auto-advance costs a third-party script

A plain iframe gives **no "ended" event**. Auto-advance requires the YouTube IFrame Player API
(`https://www.youtube.com/iframe_api`) and `onStateChange === YT.PlayerState.ENDED`. That is a
load-bearing external script from Google, which per CLAUDE.md is an ask-first dependency.

Recommendation: **ship manual advance first** (keyboard / wheel / swipe, no API), and add the API
only if auto-advance turns out to matter. Manual-only is also the version that respects the "prefer
boring" rule — an infinite auto-playing feed is precisely the mechanic this app exists to avoid.

### Failure modes to design for

- **Embedding disabled by the uploader** → a black "Watch on YouTube" box. With the IFrame API this
  surfaces as `onError` 101/150 and can auto-skip; without it, the fallback is a thumbnail tile with
  an open-on-YouTube link, and the user moves on.
- **Privacy.** `youtube-nocookie.com` reduces tracking, doesn't remove it. An `sandbox` attribute
  breaks the player, so this is a trust decision about `youtube.com` specifically. Reasonable for a
  self-hosted reader; a later setting could point at an Invidious/Piped instance instead (fits the
  ethos, but those instances are chronically flaky).
- **No downloading or proxying video.** yt-dlp and friends are a maintenance treadmill and a ToS
  problem. Embed or nothing.

---

## UI

### Entry points (both, they're cheap)

1. **A `Shorts` item in the sidebar**, right under Inbox, with its own unread count. Same
   `NAV_LINK` treatment as everything else in `App.tsx`. This is the primary door.
2. **Shorts in the inbox render as a thumbnail tile**, and clicking one opens the viewer *at that
   item* (`/shorts/<articleId>`). So the viewer is a queue and any short is an entry point into it.

And the half that may be worth more than the viewer itself: **an inbox "hide shorts" filter.** A
channel that posts five shorts a day currently buries everything else.

### The viewer screen

- Full-height dark stage, centred 9:16 player, title / channel / published overlaid or beside it.
- Keyboard: `↑`/`↓` or `j`/`k` advance, `space` pause, `m` mute, `o` open on YouTube, `esc` back.
- Wheel and touch: `scroll-snap-type: y mandatory` over full-height slides; the observer tells the
  fixed player which video to load.
- Marks read on advance (or after N seconds visible), reusing `toggleRead`. `archiveArticle` works
  unchanged.
- Prefetch the *next* thumbnail only. No eager player warm-up.

### Solid 2 traps this will hit

- The player is imperative and must be **client-only** — build it inside an effect, not in the
  component body, or SSR touches `window`. Remember `createEffect` takes two arguments here.
- If the viewer is a route with a param, its `<Loading>` needs `on={props.params.id}` or a
  `/shorts/1` → `/shorts/2` navigation holds the previous screen.
- New query names must not prefix the existing ones (`feeds`, `inbox`, `unread-count`, `article`,
  `feed-articles`). `shorts-queue` and `shorts-count` are safe with each other and with those.
- The new queries must be added to the revalidation lists in `lib/feeds.ts` — `UNREAD_KEYS` grows.

---

## Other platforms

| Platform | RSS? | What we'd get | Verdict |
|---|---|---|---|
| **YouTube** | first-party | `/shorts/` link, videoId, thumbnail, view count | the whole feature |
| **PeerTube** | first-party | MRSS `media:content` with duration, dimensions **and a direct MP4** | best case — native `<video>`, no third party, classify short by duration + portrait |
| **Mastodon** | first-party | account feed carries video attachments as MRSS | native `<video>`, easy win |
| **TikTok** | ✗ | only via self-hosted RSSHub / RSS-Bridge | works if the user points a feed at their own bridge; we ship nothing and promise nothing |
| **Instagram** | ✗ | same, and more fragile | same |
| **Bluesky** | first-party | video attachments aren't usefully in the feed | skip |

The design consequence: `classifyMedia` returns a **provider**, YouTube is the only provider with
bespoke embed handling, and everything else falls through to "MRSS video content → native
`<video>`" or "unknown → not a short, stays an article". No platform-specific code for the ones we
can't reliably reach.

---

## Does this force the undecided questions?

**No** — worth stating explicitly, since it's the one thing CLAUDE.md asks about up front.

`kind`, `thumbnailUrl` and `durationSeconds` are properties of the *entry as published*, not of a
user's relationship to it. They live on `articles` identically whether the database ends up shared
or per-user, and they're identical whether or not fetching is shared across users. The only
per-user thing here is the "hide shorts in inbox" preference, which needs the same home as every
other preference and can wait for it.

The existing `sanitize-html.ts` caveat is untouched: the shorts viewer renders no remote HTML. The
embed iframe is a new remote-content surface, but it's a trust decision about one known origin
rather than a sanitiser problem.

---

## Phases

**0 — Classifier.** ✅ Shipped as `src/lib/shorts.ts` plus one column, not the three the plan
proposed: `thumbnailUrl` and `durationSeconds` were dropped because for YouTube both derive from
the video id. They come back the day a second provider lands.

**1 — Inbox awareness.** ✅ Shipped as the exclusion and the split counts. The "shorts render as
thumbnail tiles in the inbox" half was dropped — with shorts excluded there is nothing to render.

**2 — The viewer.** ✅ Shipped, with keyboard control and on-screen prev/next. Mark-read happens on
play rather than on advance — simpler, and it needs no observer.

**3 — Not built, deliberately.** Auto-advance via the IFrame Player API · a persistent player that
survives the advance · PeerTube/Mastodon native video · subscribe-time `UULF`/`UUSH` splitting so a
channel can be added as "videos only" or "shorts only" · duration display · handling videos whose
uploader disabled embedding (today they show YouTube's own black "Watch on YouTube" box).

---

## Still open

1. **Do shorts share the inbox unread count, or get their own?** Shipped with their own, on the
   reasoning that one channel's daily five shouldn't drown the badge that says an article is
   waiting. Reversible in one query.
2. **Auto-advance or manual?** Shipped manual. Auto-advance means adopting Google's IFrame API as
   a load-bearing script, and an infinite auto-playing feed is close to the mechanic this app
   exists to avoid.
3. **Subscribe-time splitting?** When someone adds a YouTube channel, offer to split it into two
   feeds via `UULF`/`UUSH`? Cleaner separation and no classifier needed for those feeds — but two
   sidebar rows per channel and a dependency on undocumented URLs. Not attempted.

---

## Sources

- [No Shorts Please! Hidden YouTube RSS Feed URLs](https://blog.amen6.com/blog/2025/01/no-shorts-please-hidden-youtube-rss-feed-urls/) — `UULF`/`UUSH`/`UULV` playlist prefixes
- [The RSS World of YouTube](https://zegnat.bearblog.dev/the-rss-world-of-youtube/)
- [How to check if YouTube video is a SHORT](https://blog.quadmeup.com/2023/03/31/how-to-check-if-youtube-video-is-a-short/) — the 200-vs-303 HEAD probe
- [YouTube IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference) and [player parameters](https://developers.google.com/youtube/player_parameters)
- [Feedsmith: Media RSS namespace](https://feedsmith.dev/reference/namespaces/media)
- [kevinpapst/freshrss-youtube](https://github.com/kevinpapst/freshrss-youtube) — prior art: FreshRSS embeds YouTube/PeerTube inline
- [FreshRSS/Extensions#234](https://github.com/FreshRSS/Extensions/issues/234) — the "exclude shorts" request, still open
