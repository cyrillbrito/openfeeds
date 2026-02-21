# PostHog Analytics

Analytics powered by [PostHog](https://posthog.com/) with EU data residency.

## Setup

| Component | SDK                   | Host                                       | Init Location                                 |
| --------- | --------------------- | ------------------------------------------ | --------------------------------------------- |
| Web app   | `posthog-js`          | `https://ph.openfeeds.app` (reverse proxy) | `apps/web/src/utils/posthog.ts`               |
| Marketing | `posthog-js` (inline) | `https://ph.openfeeds.app` (reverse proxy) | `apps/marketing/src/components/PostHog.astro` |
| Server    | `posthog-node`        | `https://eu.i.posthog.com` (direct)        | `packages/domain/src/config.ts`               |

- **Person profiles**: `identified_only` — anonymous users are not tracked
- **Reverse proxy**: Cloudflare Worker at `ph.openfeeds.app` → PostHog EU. Bypasses ad-blockers. See [PostHog proxy docs](https://posthog.com/docs/advanced/proxy/cloudflare).
- **Super properties**: Each app registers `{ app: 'web' | 'marketing' | 'server' }`.

### Env Vars

| Var                  | Package                       | Required               | Notes                            |
| -------------------- | ----------------------------- | ---------------------- | -------------------------------- |
| `POSTHOG_PUBLIC_KEY` | `packages/domain`, `apps/web` | No                     | Disabled when absent (local dev) |
| `POSTHOG_APP`        | `packages/domain`             | No, default `'server'` | Attached to exception metadata   |
| `PUBLIC_POSTHOG_KEY` | `apps/marketing`              | No                     | Astro public env convention      |

## User Identification

- **Identify** on sign-in, sign-up, and frame load (`posthog.identify(userId, { email, name })`)
- **Reset** on sign-out (`posthog.reset()`)

Locations: `apps/web/src/routes/_frame.tsx`, `signup.tsx`, `login.tsx`, `UserMenu.tsx`.

## Best Practices

- **Prefer server-side tracking** — no ad-blockers, no JS interruptions, deterministic execution. Use client-side only for UI interactions (clicks, page views, scrolls).
- **No PII in event properties** — use IDs, not emails or names.
- **Filter internal users** — exclude internal email domains and dev environments from analytics.

## Event Naming Convention

`category:object_action` in lowercase snake_case with present-tense verbs.

Allowed verbs: `click`, `submit`, `create`, `view`, `add`, `invite`, `update`, `delete`, `remove`, `start`, `end`, `cancel`, `fail`, `generate`, `send`.

## Events

### Server-Side (posthog-node)

Tracked via `trackEvent()` in `packages/domain/src/analytics.ts`. Preferred over client-side for reliability.

| Event                             | Properties                                | Location                                                                |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `auth:account_create`             | `method`                                  | `apps/web/src/server/auth.ts`                                           |
| `auth:session_create`             | `method`                                  | `apps/web/src/server/auth.ts`                                           |
| `feeds:feed_create`               | `feed_id`, `feed_url`, `source`           | `packages/domain/src/entities/feed.ts`                                  |
| `feeds:feed_delete`               | `feed_id`                                 | `packages/domain/src/entities/feed.ts`                                  |
| `feeds:opml_import`               | `feed_count`, `tag_count`, `failed_count` | `packages/domain/src/import.ts`                                         |
| `tags:tag_create`                 | `tag_id`, `color`                         | `packages/domain/src/entities/tag.ts`                                   |
| `tags:tag_delete`                 | `tag_id`                                  | `packages/domain/src/entities/tag.ts`                                   |
| `filters:rule_create`             | `feed_id`, `operator`                     | `packages/domain/src/entities/filter-rule.ts`                           |
| `tts:audio_generate`              | `article_id`, `duration_ms`               | `packages/domain/src/tts.ts`                                            |
| `limits:feeds_limit_hit`          | `source`, `current_usage`, `limit`        | `packages/domain/src/entities/feed.ts`, `packages/domain/src/import.ts` |
| `limits:filter_rules_limit_hit`   | `current_usage`, `limit`                  | `packages/domain/src/entities/filter-rule.ts`                           |
| `limits:saved_articles_limit_hit` | `current_usage`, `limit`                  | `packages/domain/src/entities/article.ts`                               |
| `limits:extractions_limit_hit`    | `window`, `current_usage`, `limit`        | `packages/domain/src/entities/article.ts`                               |

### Client-Side (posthog-js)

| Event                   | Properties                        | Location                                             |
| ----------------------- | --------------------------------- | ---------------------------------------------------- |
| `articles:article_view` | `article_id`, `feed_id`, `source` | `apps/web/src/routes/_frame.articles.$articleId.tsx` |

### Exception Capture

- **Client**: `posthog.captureException()` on unexpected auth errors (sign-in, sign-up, reset-password, forgot-password).
- **Server**: `posthog.captureException()` in `packages/domain/src/logger.ts` on `logger.error()` calls.

## Links

- [PostHog EU Dashboard](https://eu.posthog.com/)
- [PostHog Docs](https://posthog.com/docs)
- [Reverse Proxy Setup](https://posthog.com/docs/advanced/proxy/cloudflare)
- [Naming Conventions](https://posthog.com/docs/data/events#best-practices)
- [posthog-js API](https://posthog.com/docs/libraries/js)
- [posthog-node API](https://posthog.com/docs/libraries/node)
