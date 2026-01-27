# Marketing App

Astro-based marketing website deployed to Cloudflare Pages.

## Asset Placement Rules

**Prefer `src/assets/` over `public/` for all assets.**

A Cloudflare Worker routes traffic between marketing and the main app based on URL paths. Marketing assets are served from `/_astro/` (Astro's default build output). Placing assets in `src/assets/` ensures they're bundled to `/_astro/` and easily distinguished from app assets.

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

Assets used in email templates (e.g., `logo.png`) go in `public/_emails/`. This folder is excluded from Astro's Cloudflare adapter routing, allowing direct static serving. Email templates reference these as `https://openfeeds.app/_emails/logo.png`.

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
