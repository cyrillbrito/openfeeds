# Shorts

A dedicated screen that plays short vertical video from subscribed feeds as a scroll-snapped
queue. `/shorts` — `src/routes/shorts.tsx`.

## How detection works

YouTube's ordinary channel feed already distinguishes the two by link shape:

```xml
<link rel="alternate" href="https://www.youtube.com/shorts/5mU6SRS2Bxo"/>   <!-- short -->
<link rel="alternate" href="https://www.youtube.com/watch?v=Qtl8lJwbd4g"/>  <!-- video -->
```

So detection is one regex (`src/lib/shorts.ts`) over a link already stored in `articles.url`:
no API key, no extra request, no heuristics — and reclassifying the backlog is an `UPDATE`.

Two alternatives were rejected. A channel's `UC…` id rewrites into `UUSH…` for a shorts-only
**playlist feed**, which works but is undocumented and would mean double-subscribing to every
channel; it is interesting later as a *subscription* option ("shorts only"), not as detection.
A **`HEAD /shorts/<id>` probe** (200 = short, 303 = not) costs a round trip per video and is
only a fallback if YouTube ever stops emitting `/shorts/` links.

## What the screen does

| | |
|---|---|
| `↑` `↓` · `j` `k` · `PageUp` `PageDown` | previous / next |
| `Home` `End` | first / last |
| `Enter` `Space` | play the current short |
| `o` | open on YouTube |
| `u` | toggle read |
| ▲ ▼ buttons + `n / total` | the same two moves, for the mouse |

No pause or mute key: a plain embed exposes no controls to script. YouTube's own `k` / `m`
work once the player has focus.

Five things are load-bearing and easy to undo by accident:

- **Poster frame until you click.** No autoplay, no IFrame Player API, no auto-advance. The
  click is the gesture browsers require, so the autoplay-policy problem never arises, and
  exactly one `<iframe>` exists at a time.
- **Leaving a slide removes its iframe**, which is the only way to stop it. Everything that
  changes the current slide goes through one `focusIndex`.
- **The keyboard listener is on `window`, and the buttons are not decoration.** Once focus is
  inside the cross-origin player its key events never reach the page; the buttons still work.
- **The queue keeps read shorts.** Playing one marks it read, which revalidates the queue —
  filtering read items out would make the playing video vanish mid-frame.
- **Shorts are excluded from the inbox and its "Mark all read", and nowhere else.** A feed's
  own page shows everything that feed published; each badge counts what its screen shows.

## Deliberately not built

Auto-advance (needs Google's IFrame Player API as a load-bearing script, and an infinite
auto-playing feed is close to the mechanic this app exists to avoid) · a persistent player
that survives the advance · PeerTube and Mastodon native video via MRSS · subscribe-time
`UULF`/`UUSH` splitting · graceful handling of uploaders who disabled embedding (today they
show YouTube's own black "Watch on YouTube" box).

## Sources

- [No Shorts Please! Hidden YouTube RSS Feed URLs](https://blog.amen6.com/blog/2025/01/no-shorts-please-hidden-youtube-rss-feed-urls/) — the `UULF`/`UUSH`/`UULV` prefixes
- [How to check if YouTube video is a SHORT](https://blog.quadmeup.com/2023/03/31/how-to-check-if-youtube-video-is-a-short/) — the 200-vs-303 HEAD probe
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Feedsmith: Media RSS namespace](https://feedsmith.dev/reference/namespaces/media)
