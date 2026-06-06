# Marketing App

Astro static site. Built to `apps/marketing/dist/` and served by the Hono server (`apps/server/`) — see the marketing-dist routing block in `apps/server/src/index.ts`. There is no Astro runtime in production; the waitlist signup is a Hono route at `POST /api/waitlist` that wraps `addContactToWaitlist` from `@repo/domain`.

Routes:

- `/` — cookie-gated by the Hono server: logged-out visitors see the marketing landing; logged-in users get the SPA. Uses the Better Auth `better-auth.session_token` cookie via a raw header sniff (no DB hit).
- `/terms`, `/privacy` — always marketing.
- `/_astro/*`, `/_emails/*` — marketing static assets.

## Asset Placement Rules

**Prefer `src/assets/` over `public/` for all assets.**

The Hono server treats `/_astro/*` and `/_emails/*` as marketing-owned root paths. Placing assets in `src/assets/` ensures they're bundled to `/_astro/` (with cache-busting hashes) and never collide with SPA assets.

### Use `src/assets/` for:

- Images used in components
- SVG icons and logos
- Fonts (reference via relative paths in CSS)
- Any asset that can be imported

Benefits: cache-busting hashes, image optimization, tree-shaking.

### Use `public/` only when:

- Browsers expect exact paths (e.g., favicons, `robots.txt`)
- Third-party scripts require specific paths

### Email assets: `public/_emails/`

Assets used in email templates (e.g., `logo.png`) go in `public/_emails/`. Astro copies `public/` verbatim to `dist/`, and the Hono server mounts `/_emails/*` against `marketing-dist/`. Email templates reference these as `https://openfeeds.app/_emails/logo.png`.

### Example

```astro
---
// Good: import from assets
import logo from '../assets/logo.svg';
---
<img src={logo.src} alt="Logo" />
```

```astro
<!-- Avoid: referencing public directly when import works -->
<img src="/logo.svg" alt="Logo" />
```
