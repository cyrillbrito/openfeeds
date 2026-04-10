# Recommendation System V1 (No Vectors)

**Date:** April 2026  
**Status:** Phase A in progress

## Goal

Ship a useful "Recommended" feed fast, without embeddings or vector search.

This v1 uses only signals we already have (or can add cheaply):

- Feed affinity (which feeds the user engages with)
- Tag affinity (which tagged content the user engages with)
- Recency (fresh content bias)

This is a standard first step. Embeddings can be added later with minimal refactor.

## Why this works

- Much simpler operationally (no embedding API, no pgvector, no ANN tuning)
- Enough to improve over pure chronological order
- Fits existing architecture: server computes, Electric syncs, client queries locally

## Signals and formula

<!-- STATUS: DONE — weights implemented in packages/domain/src/recommendation-scoring.ts -->

Use a weighted score per unread article:

```sql
final_score =
    feed_weight    * feed_affinity
  + tag_weight     * tag_affinity
  + recency_weight * recency_score
```

Starting weights:

- Feed affinity: `0.55`
- Tag affinity: `0.25`
- Recency: `0.20`

Notes:

- Feed gets highest weight in v1 because it is usually strongest in RSS products.
- Recency prevents stale but high-affinity content from dominating.

## Signal collection strategy (no event pipeline)

V1 can avoid a full append-only event system.

Use a per-user-per-article state row and update it in place from the client. This keeps implementation simple while still providing enough signal quality.

### Per-article interaction fields

<!-- STATUS: DONE — columns added to articles table in packages/db/src/schema/schema.ts -->

Add these columns directly to the `articles` table. Articles are already user-scoped, so no new table is needed:

- `impression_count` (integer, default 0)
- `last_impression_at` (timestamp, nullable)
- `open_count` (integer, default 0)
- `dwell_seconds` (integer, accumulated, capped)
- `recommendation_score` (real, nullable — written by server scoring job)
- `score_computed_at` (timestamp, nullable)

The client updates interaction fields (`impression_count`, `open_count`, `dwell_seconds`) via the normal optimistic mutation flow (same pattern as `is_read` / `is_archived`). The server scoring job writes `recommendation_score` directly to Postgres. Electric syncs both directions — no conflict because they touch different columns at different times.

### Impression quality guardrails

<!-- STATUS: TODO — client-side viewport tracking + cooldown not implemented yet -->

Only count an impression when the article was meaningfully visible (for example, in viewport for >= 600-1000ms). Add a per-article cooldown (for example, max one impression every 6-24h) to avoid noisy penalties from repeated scrolling.

### Article-level preference signal

<!-- STATUS: PARTIAL — open_count and impression_count used in affinity SQL; dwell_30s_count and explicit_tag_add_count not yet factored in -->

Compute article preference from positive and negative evidence:

```text
positive = 1.0 * open_count + 2.0 * dwell_30s_count + 1.5 * explicit_tag_add_count
negative = 0.25 * impressions_without_open
impressions_without_open = max(impression_count - open_count, 0)
```

This captures: repeatedly seen but never opened should decrease preference over time.

Archive action guidance:

- Treat `archive` as neutral in v1.
- In this product, archive is inbox workflow ("hide for now"), not clear dislike.
- Do not map archive to positive or negative affinity unless future UX adds explicit intent.

## Feed/tag affinity derivation

<!-- STATUS: DONE — computeFeedAffinities() and computeTagAffinities() in recommendation-scoring.ts -->

Feed and tag affinity use the same logic. They differ only by grouping key.

- Feed affinity: aggregate article preference by `feed_id`
- Tag affinity: aggregate article preference by `tag_id` (via article-tag join)

So yes, feed/tag affinity is derived from article-level behavior, not manually curated.

Recommended form:

- Weighted average of article preference
- Exponential time decay (old behavior matters less)
- Bayesian smoothing/prior to avoid extreme scores on low sample sizes

## Data model

<!-- STATUS: DONE — all columns added to schema.ts (articles, feeds, tags) -->

All recommendation data lives on existing entities. No new tables needed for v1.

### On the `articles` table (new columns)

- `impression_count`, `last_impression_at`, `open_count`, `dwell_seconds` — interaction signals, written by client via server functions
- `recommendation_score`, `score_computed_at` — written by server scoring job directly to Postgres

These columns sync via Electric as part of the existing articles shape. The interaction fields are small integers/timestamps — negligible payload. If needed later, exclude server-only columns from the Electric shape using the `columns` parameter.

### On `feeds` and `tags` (new columns, server-side only)

<!-- STATUS: DONE — affinity + affinity_computed_at added to both tables -->
<!-- TODO: exclude affinity columns from Electric shapes (not done yet) -->

Assumption for this v1: `feeds` and `tags` are user-scoped rows (not global/shared).

- `feeds.affinity`, `feeds.affinity_computed_at`
- `tags.affinity`, `tags.affinity_computed_at`

Exclude affinity columns from Electric shapes — these are server-internal scoring data.

## Compute pipeline

<!-- STATUS: DONE — BullMQ job every 30min, computeRecommendationScoresForAllUsers() in recommendation-scoring.ts -->

Recurring BullMQ job every 30-60 minutes:

1. Recompute `feeds.affinity` per user from article-level signals
2. Recompute `tags.affinity` per user from article-level signals (including explicit tag behavior)
3. Score unread articles using feed/tag/recency formula
4. `UPDATE articles SET recommendation_score = ... WHERE user_id = $1 AND is_read = false`

No separate rankings table. No stale data cleanup. Electric syncs the updated scores to the client automatically.

Client "Recommended" page orders articles by `recommendation_score DESC`.

## Minimal SQL skeleton

<!-- STATUS: DONE — implemented as scoreUnreadArticles() in recommendation-scoring.ts, uses subquery for MAX(tag.affinity) instead of GROUP BY -->

```sql
WITH article_scores AS (
  SELECT
    a.id,
    COALESCE(f.affinity, 0) * 0.55
    + COALESCE(MAX(t.affinity), 0) * 0.25
    + (1.0 / (1 + EXTRACT(EPOCH FROM now() - a.pub_date) / 86400)) * 0.20
    AS score
  FROM articles a
  LEFT JOIN feeds f ON f.id = a.feed_id
  LEFT JOIN article_tags at ON at.article_id = a.id
  LEFT JOIN tags t ON t.id = at.tag_id
  WHERE a.user_id = $1
    AND a.is_read = false
  GROUP BY a.id, f.affinity, a.pub_date
)
UPDATE articles
SET recommendation_score = article_scores.score,
    score_computed_at = now()
FROM article_scores
WHERE articles.id = article_scores.id;
```

## Client-to-server data flow

<!-- STATUS: DONE — onUpdate handler extended with interaction fields; UpdateArticleSchema updated -->

Interaction fields follow the same pattern as `is_read` / `is_archived`:

1. Client calls `articlesCollection.update()` — optimistic local change
2. `onUpdate` handler fires a server function to persist the change
3. Server writes to Postgres via domain layer
4. Electric syncs confirmed state back, TanStack DB reconciles via `txid`

The existing `onUpdate` handler currently only sends `isRead` and `isArchived`. Extend it (or add a dedicated server function) to also sync `impressionCount`, `openCount`, `dwellSeconds`, `lastImpressionAt`.

For dwell time: accumulate client-side and flush periodically (for example, every 10s while reading, and on navigation away). Avoid a server call per second.

<!-- STATUS: TODO — client-side dwell time accumulation + flush not implemented -->

For impressions: apply cooldown logic client-side before writing. Only increment `impressionCount` if `lastImpressionAt` is older than the cooldown threshold (6-24h).

<!-- STATUS: TODO — client-side impression cooldown logic not implemented -->

## Upgrade path to V2 (with vectors)

Design v1 so embeddings are additive, not a rewrite:

1. `recommendation_score` on articles stays the output — same column, same client query
2. Add `articles.embedding` and `user_taste_vectors` table
3. Add `content_similarity` term into same scoring UPDATE query
4. Retune weights (for example: content 0.50, feed 0.25, tag 0.10, recency 0.15)

Frontend changes should be near zero — the client already orders by `recommendation_score`.

## Refactor risk

Low. All recommendation data lives on existing entities:

- Interaction signals are columns on `articles` — client writes, server reads
- Score is a column on `articles` — server writes, client reads
- Affinity is columns on `feeds`/`tags` — server writes, server reads
- Scoring math can change freely — it's a single UPDATE query in a BullMQ job
- No new tables, no new Electric collections, no new sync shapes

V1 -> V2 is a server-side scoring upgrade: add an embedding column, add a `content_similarity` term to the same query. Client code doesn't change.

## When to split into score tables later

Keep affinity inline for now. Split to `feed_scores` / `tag_scores` only if needed:

- You need multiple windows (`7d`, `30d`) at the same time
- You need multiple score types (click vs dwell vs favorite)
- You need model versioning or score history/auditing
- Feeds/tags become shared across users

## Recommended rollout

### Phase A (ship now)

- Add interaction columns to `articles` (`impression_count`, `open_count`, `dwell_seconds`, `last_impression_at`, `recommendation_score`, `score_computed_at`) <!-- DONE -->
- Add affinity columns to `feeds` and `tags` (exclude from Electric shapes) <!-- DONE (columns added; Electric shape exclusion TODO) -->
- Extend article `onUpdate` handler to sync interaction fields to server <!-- DONE -->
- Build BullMQ scoring job (affinity computation + score UPDATE) <!-- DONE -->
- Client "Recommended" view: `orderBy(recommendationScore, 'desc')` <!-- TODO — no UI yet -->
- Track quality with simple metrics (CTR on recommended, hide/archive rate) <!-- TODO -->
- Client-side impression tracking (viewport observer + cooldown) <!-- TODO -->
- Client-side dwell time tracking (accumulate + periodic flush) <!-- TODO -->
- Client-side open_count tracking (increment on article open) <!-- TODO -->

### Phase B (signal quality)

- Improve affinity math (decay + priors + impression cooldown tuning)
- Improve explicit-positive tag behavior weighting (for example, user-created "favorites" tag)
- Optionally add lightweight intent signals (see below)

### Phase B.5 (optional manual controls)

If users want direct influence over recommendations:

- Add `upvote` / `downvote` on articles
- Treat votes as high-weight explicit signals in affinity updates
- Keep optional; do not block v1 rollout on this

### Phase C (vectors)

- Add embeddings and content similarity
- Keep the same client-side consumption model

## Optional intent signals (add later, low weight)

These can be useful but should be weaker than direct article actions:

- User opens a feed page (`feed_view`)
- User opens a tag page (`tag_view`)

Interpretation:

- Good as mild positive prior for that feed/tag
- Do not overweight: navigation intent is weaker than opening/reading an article

If an article is opened from feed/tag/inbox context, keep context as metadata for analysis, but avoid making large ranking changes from source context alone in v1.
