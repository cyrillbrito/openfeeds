# OpenFeeds

**Your feed, your rules.** A self-hosted, multi-user RSS reader.

Subscribe to blogs, news sites, YouTube channels and podcasts in one place — no algorithm,
no tracking, no ads deciding what you see.

> **This branch is v2, a full rewrite.** It has its own history, and the app is scaffolded but
> has no feature code yet. See [docs/v2-plan.md](docs/v2-plan.md) for what's decided, what's
> still open, and why. v1 lives on `main` and is readable from here
> (`git show main:<path>`).

## What it does

**Reading**
- Subscribe to RSS and Atom feeds, YouTube channels, and podcasts
- Paste any website URL and let OpenFeeds find the feed for you
- An inbox across every feed, plus per-feed and per-tag views
- Readability mode — pulls the article out of the page, without the site's furniture
- A dedicated vertical viewer for YouTube Shorts, kept out of the main reading flow

**Organising**
- Tags on feeds and on individual articles
- Per-feed filter rules that auto-mark articles as read by title match
- Archive, with optional auto-archive after N days
- OPML import and export, so moving in or out is never a trap

**Running it**
- Feeds sync in the background on a schedule
- Multi-user: several people share one instance, each with their own feeds and read state
- Self-hosted: one container, one database file, your server

## Why it exists

Most readers are either someone else's cloud service or a desktop app tied to one machine.
OpenFeeds is meant to be the thing you run yourself and reach from anywhere — where the cost of
owning it is low enough that self-hosting is genuinely easy rather than a weekend project.

That constraint drives the architecture: **anything that can't be self-hosted is out**, however
convenient it would otherwise be.

## Status

Early development. The stack is settled — Bun, Solid 2 (start mode), SQLite, Tailwind, Better
Auth — and the app is scaffolded. The UI component layer, the database layout and the
feed-sharing model are still open.

## License

See [LICENSE.md](LICENSE.md) on `main`.
