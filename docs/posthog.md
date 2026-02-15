# PostHog Analytics Strategy

This document outlines the analytics strategy for OpenFeeds using PostHog.

## Best Practices (from PostHog docs)

### 1. Prefer Backend to Frontend Tracking

Backend analytics are more reliable than frontend for three reasons:

1. **No ad-blockers** - Many users have tracking blocked on browsers
2. **No JS interruptions** - Network issues, CORS, browser settings can't interfere
3. **Full control** - Server execution is deterministic

**When to use frontend tracking:**

- User journeys (page sequences)
- UI interactions (clicks, scrolls)
- Client-side performance

**When to use backend tracking:**

- CRUD operations (create, update, delete)
- Accurate counts (signups, purchases)
- Business metrics

### 2. Naming Convention

Following PostHog's recommended `category:object_action` pattern:

- **Lowercase only**
- **Snake case**: `signup_flow:pricing_page_view`
- **Present-tense verbs**: `create`, `submit`, `view` (not `created`, `submitted`)
- **Category prefix**: Groups related events

**Allowed verbs:**

```
click, submit, create, view, add, invite, update, delete, remove, start, end, cancel, fail, generate, send
```

**Property naming:**

- `object_adjective` pattern: `user_id`, `feed_url`, `article_count`
- Boolean prefix `is_/has_`: `is_bulk`, `has_content`
- Date suffix `_date/_timestamp`: `created_at`, `sync_timestamp`

### 3. Reverse Proxy

A reverse proxy routes events through your domain, bypassing ad-blockers. This typically increases event capture by 10-30%.

**Done:** Cloudflare Worker proxy at `ph.openfeeds.app` forwarding to PostHog EU.

See: https://posthog.com/docs/advanced/proxy/cloudflare

### 4. Filter Out Internal Users

Add filtering for:

- Internal email domains
- `is_employee` property
- Development environments (`localhost`, staging)

---

## Current Setup

### SDK Integration

- **Client-side**: `posthog-js` in `apps/web`
- **Server-side**: `posthog-node` in `packages/domain`
- **Marketing**: Inline snippet in `apps/marketing`

### Configuration

- **Host**: `https://ph.openfeeds.app` (Cloudflare Worker proxy → EU data residency)
- **Person profiles**: `identified_only`
- **App labels**: Each app registers its source (`web`, `server`, `worker`, `marketing`)

---

## Event Taxonomy

### Backend Events (Server-Side)

These events are tracked in `packages/domain` functions for reliability.

#### Authentication

| Event                 | Properties | Location  |
| --------------------- | ---------- | --------- |
| `auth:account_create` | `method`   | `auth.ts` |
| `auth:session_create` | `method`   | `auth.ts` |

#### Feed Management

| Event               | Properties                                | Location            |
| ------------------- | ----------------------------------------- | ------------------- |
| `feeds:feed_create` | `feed_id`, `feed_url`, `source`           | `createFeed()`      |
| `feeds:feed_delete` | `feed_id`                                 | `deleteFeed()`      |
| `feeds:opml_import` | `feed_count`, `tag_count`, `failed_count` | `importOpmlFeeds()` |

#### Tag Management

| Event             | Properties        | Location      |
| ----------------- | ----------------- | ------------- |
| `tags:tag_create` | `tag_id`, `color` | `createTag()` |
| `tags:tag_delete` | `tag_id`          | `deleteTag()` |

#### Filter Rules

| Event                 | Properties            | Location             |
| --------------------- | --------------------- | -------------------- |
| `filters:rule_create` | `feed_id`, `operator` | `createFilterRule()` |

#### Audio/TTS

| Event                | Properties                  | Location                 |
| -------------------- | --------------------------- | ------------------------ |
| `tts:audio_generate` | `article_id`, `duration_ms` | `generateArticleAudio()` |

### Frontend Events (Client-Side)

These events are tracked in `apps/web` for UI-specific interactions.

#### Article Viewing

| Event                   | Properties                        | Location      |
| ----------------------- | --------------------------------- | ------------- |
| `articles:article_view` | `article_id`, `feed_id`, `source` | Article route |

**Note:** `article_view` is frontend-only because it tracks the UI action of opening an article, not a database change.

---

## Implementation Architecture

### Server-Side Tracking (Preferred)

Location: `packages/domain/src/analytics.ts`

```typescript
import { posthog } from './config';

export function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (posthog) {
    posthog.capture({ distinctId: userId, event, properties });
  }
}
```

Domain functions call `trackEvent()` after successful operations:

```typescript
// In packages/domain/src/entities/feed.ts
export async function createFeed(data: CreateFeed, userId: string): Promise<Feed> {
  const feed = await db
    .insert(feeds)
    .values({ ...data, userId })
    .returning();

  trackEvent(userId, 'feeds:feed_create', {
    feed_id: feed.id,
    feed_url: data.url,
    source: 'manual',
  });

  return feed;
}
```

### Client-Side Tracking (UI Only)

Use `posthog-js` directly for client-side events:

```typescript
import posthog from 'posthog-js';

// Track UI-specific events
posthog.capture('articles:article_view', {
  article_id: id,
  feed_id: feedId,
  source: 'inbox',
});
```

### User Identification

Call `posthog.identify()` after successful login (client-side):

```typescript
posthog.identify(user.id, {
  email: user.email,
  name: user.name,
  created_at: user.createdAt,
});
```

Call `posthog.reset()` on logout.

---

## Dashboards

### 1. Growth Dashboard

| Metric                   | Query                         |
| ------------------------ | ----------------------------- |
| Daily Active Users (DAU) | Unique users with any event   |
| New signups              | `auth:account_create` count   |
| Feed subscriptions       | `feeds:feed_create` count     |
| Net feed growth          | `feed_create` - `feed_delete` |

### 2. Engagement Funnel

```
auth:account_create
  -> feeds:feed_create (within 1 day)
    -> articles:article_view (within 7 days)
      -> 5+ article_view events (within 7 days)
        -> Return Day 2+
```

### 3. Feature Adoption

| Feature      | Event                 | Target |
| ------------ | --------------------- | ------ |
| Tags         | `tags:tag_create`     | 30%    |
| Filter Rules | `filters:rule_create` | 10%    |
| Audio/TTS    | `tts:audio_generate`  | 5%     |
| OPML Import  | `feeds:opml_import`   | 20%    |

### 4. Retention Cohorts

- D1/D7/D30 retention rates
- Retention by acquisition source (OPML vs manual)
- Retention by feature usage (tags, filters)

---

## Feature Flags (Future)

| Flag                    | Purpose                           |
| ----------------------- | --------------------------------- |
| `enable-youtube-shorts` | Gradual rollout of shorts feature |
| `enable-audio-tts`      | Control TTS feature availability  |
| `new-article-reader`    | A/B test new reader layout        |
| `onboarding-v2`         | Test new onboarding flow          |

---

## Privacy Considerations

- Person profiles set to `identified_only` - anonymous users not tracked
- EU data residency (`eu.i.posthog.com`)
- No PII in event properties (use IDs, not emails/names in properties)
- Session replay respects user privacy settings

---

## MCP Integration

The PostHog MCP server can be used to:

1. **Create dashboards programmatically**
2. **Query analytics data** from AI agents
3. **Manage feature flags** via CLI/agent
4. **Search documentation** for implementation help

### Example MCP Prompts

```
"Create a funnel: auth:user_signup -> feeds:feed_create -> articles:article_view within 7 days"

"Show me DAU for the last 30 days"

"What % of users who signed up last week have used tags:tag_create?"

"Create a feature flag called 'new-reader-layout' with 10% rollout"
```

---

## Metrics to Monitor

### North Star Metric

**Articles Viewed per Week** - Core value delivery metric

### Supporting Metrics

| Category    | Metric                    | Target    |
| ----------- | ------------------------- | --------- |
| Acquisition | Weekly signups            | Growth    |
| Activation  | % signup -> first article | > 50%     |
| Engagement  | Articles viewed per user  | > 10/week |
| Retention   | D7 retention              | > 40%     |
| Retention   | D30 retention             | > 20%     |

---

## Implementation Status

- [x] Document analytics strategy
- [x] Implement user identification (client-side)
- [x] Add client-side analytics utility
- [x] Add server-side analytics utility
- [x] Move CRUD events to server-side (domain package)
  - [x] `feeds:feed_create`, `feeds:feed_delete` in `feed.ts`
  - [x] `feeds:opml_import` in `import.ts`
  - [x] `tags:tag_create`, `tags:tag_delete` in `tag.ts`
  - [x] `filters:rule_create` in `filter-rule.ts`
  - [x] `audio:audio_generate` in `tts.ts`
- [x] Set up reverse proxy (`ph.openfeeds.app` via Cloudflare Worker)
- [ ] Create Growth Dashboard in PostHog
- [ ] Create Engagement Funnel in PostHog
- [ ] Set up retention cohorts
- [ ] Implement feature flags
- [ ] Add internal user filtering
