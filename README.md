# OpenFeeds

**Your feed, your rules.** A self-hosted, multi-user RSS reader.

Subscribe to blogs, news sites, YouTube channels and podcasts in one place — no algorithm,
no tracking, no ads deciding what you see.

> **This branch is v2, a full rewrite** with its own history. v1 lives on `main` and is
> readable from here (`git show main:<path>`). See [docs/decisions.md](docs/decisions.md)
> for what is settled and what is still open.

## What works today

- Subscribe by pasting a feed URL **or** a homepage — OpenFeeds finds the feed, and verifies
  it before saving so a bad address fails immediately
- RSS, Atom, RDF and JSON Feed
- An inbox across every feed, and a page per feed
- Rows link straight to the source. There is no in-app reader and no content extraction
- A dedicated vertical viewer for YouTube Shorts, which are kept out of the inbox
- Background sync on a schedule, with visible per-feed failure state
- Multi-user: feeds and articles are stored once and shared; subscriptions and read state
  are per user

Not built yet: tags, filter rules, archive, OPML import/export, a browser extension.

## Running it

Needs [Bun](https://bun.sh) and a Postgres. From the repo root:

```sh
docker compose up -d          # Postgres
bun install
cp apps/web/.env.example apps/web/.env   # set BETTER_AUTH_SECRET
cd apps/web && bun run dev    # http://localhost:3000
```

Migrations apply at boot. See [CLAUDE.md](CLAUDE.md) for the full command list.

## Why it exists

Most readers are either someone else's cloud service or a desktop app tied to one machine.
OpenFeeds is meant to be the thing you run yourself and reach from anywhere — where the cost
of owning it is low enough that self-hosting is genuinely easy.

That constraint drives the architecture: **anything that can't be self-hosted is out**,
however convenient it would otherwise be.

## License

See [LICENSE.md](LICENSE.md) on `main`.
