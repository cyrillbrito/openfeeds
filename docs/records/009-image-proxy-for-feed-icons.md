---
date: 2026-05-14
status: idea
---

# Image Proxy for Feed Icons

Feed icons (`feed.icon`) are rendered with `<img src={feed.icon}>` straight from the DB across ~7 components (`FeedIcon` in `_frame.feeds.index.tsx`, `FeedHeader`, `ArticleCard`, `CuratedFeedsBrowser`, `TagFeedManager`, `EditFeedModal`, `_frame.discover.tsx`). URLs come from RSS metadata as-is. Three problems:

1. **Mixed content** — many feeds advertise `http://` icons. On HTTPS pages the browser auto-upgrades to `https://`, but origins that don't serve TLS just fail. Console warnings on `/feeds`.
2. **Privacy leak** — every third-party origin sees the user's IP and referrer when icons load.
3. **No caching / rate limits** — YouTube channel avatars in particular rate-limit when many load at once.

## Prior attempt

Commit `856db9da` (2026-02-13) added an image proxy:

- `apps/web/src/routes/api/image-proxy.ts` — proxy endpoint, allowlisted to YouTube + Google hosts, 7-day cache headers.
- `apps/web/src/components/FeedIcon.tsx` — reusable component with built-in proxy routing, lazy loading, error fallback, consistent sizing.
- Replaced 4 icon rendering sites.

Not in the current tree — the work was reverted/lost at some point. Reason unclear; worth digging through `git log -- apps/web/src/components/FeedIcon.tsx` if revisited.

## If revisited

- Restore the proxy + component, but widen the allowlist (or drop it and rely on `safe-fetch` SSRF protection) so it also handles arbitrary feed origins — that's what fixes the mixed-content issue.
- Consider serving via a long-cache CDN path so Cloudflare caches edge-side.
- Sites missing icons today: check the 3 newer locations not covered in 856db9da (`CuratedFeedsBrowser`, `TagFeedManager`, `_frame.discover.tsx`).

## Longer term: dedicated image server

Rolling our own proxy route is a stopgap. The proper fix is an open-source image server in front of all third-party media (feed icons, article thumbnails, OG images, YouTube covers). It solves all three problems above plus gives us resizing, format conversion (WebP/AVIF), and quality control for free.

Candidates to evaluate:

- **[imgproxy](https://imgproxy.net/)** — Go, fast, signed URLs, broad format support. Most popular choice.
- **[imaginary](https://github.com/h2non/imaginary)** — Go, libvips-based, simpler API.
- **[Thumbor](https://www.thumbor.org/)** — Python, mature, plugin ecosystem.

Deploy as a sidecar container on the VPS, point `<img>` srcs at it, done. Low priority until icons/thumbnails actually hurt perceived perf.
