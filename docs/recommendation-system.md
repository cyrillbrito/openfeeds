# Recommendation System

**Date:** April 2026
**Status:** Exploration / Research

## Problem

Users receive a chronological list of articles from their subscribed feeds. There's no ranking — a niche post from a rarely-read feed sits alongside content the user would immediately click. We want a "Recommended" or "For You" view that surfaces articles the user is most likely to engage with.

The ranking must be **fuzzy** — not keyword-based. A user who reads a lot of Minecraft content should see Minecraft articles ranked higher, even when no single keyword would catch all of them. Same for broad topics like "politics" or "AI research". This requires understanding content meaning, not just string matching.

## Core Concepts

### What is an Embedding?

An embedding is a list of numbers (a vector) that represents the **meaning** of a piece of text. You send text to a model, it returns a fixed-size array of floats:

```
"How to build a Minecraft farm" → [0.12, -0.34, 0.56, ..., 0.23]  (384 numbers)
"Minecraft redstone tutorial"   → [0.11, -0.31, 0.58, ..., 0.21]  (very similar)
"US election polling analysis"  → [0.87, 0.12, -0.45, ..., -0.67] (very different)
```

Texts about similar topics produce vectors that are **close together** in vector space. You measure closeness with cosine similarity (a number from -1 to 1, where 1 = identical meaning).

One embedding per article, generated from `title + description` (or `clean_content`), computed once at ingestion time.

### User Taste Vector

A single vector representing what a user likes. Computed as a weighted average of embeddings from articles the user has interacted with:

```
taste_vector = weighted_average(
  3 × embeddings of favorited articles,
  2 × embeddings of articles read for 30s+,
  1 × embeddings of clicked articles,
  -0.5 × embeddings of skipped articles
)
```

This vector sits in the "region" of vector space matching the user's interests. A Minecraft reader gets a taste vector near the Minecraft cluster. A politics reader gets one near the politics cluster.

**Limitation of one vector:** If a user likes Minecraft AND politics (unrelated topics), the average lands somewhere between them — a midpoint that doesn't represent either interest well. The fix is **multiple taste vectors per user**, each representing a cluster of interest (see "Multiple Taste Vectors" below).

### Feed Affinity

Content similarity alone doesn't capture creator preference. A user might love Minecraft videos from Creator A but ignore Creator B's — even though the content embeddings are similar. Feed affinity is a separate signal:

```
feed_affinity = articles_clicked_from_feed / total_articles_from_feed
```

This is combined with content similarity in the final scoring formula, not baked into the embedding.

### Tag Affinity

Users apply tags to feeds (which auto-apply to articles) and directly to articles. Tags represent explicit user-declared interests. Tag affinity measures how much a user engages with content under each tag:

```
tag_affinity = articles_read_with_tag / total_articles_with_tag
```

Articles inheriting tags from highly-engaged tags get a ranking boost. This is especially useful for cold-start (new articles from a feed the user just subscribed to — if they tagged it "Tech", and they engage heavily with other "Tech"-tagged content, rank it higher).

## Scoring Formula

The final article score combines three independent signals:

```
final_score =
    content_weight * content_similarity     -- embedding cosine similarity
  + feed_weight    * feed_affinity          -- creator/source preference
  + tag_weight     * tag_affinity           -- explicit category preference
  + recency_weight * recency_score          -- freshness decay
```

Starting weights (tunable):

| Signal | Weight | What it captures |
|--------|--------|------------------|
| Content similarity | 0.50 | Fuzzy topic matching (the "Minecraft" problem) |
| Feed affinity | 0.25 | Creator/source preference |
| Tag affinity | 0.10 | Explicit user categorization |
| Recency | 0.15 | Freshness (exponential decay from pub_date) |

These weights are a starting point. They can be tuned based on user feedback or A/B testing.

## Multiple Taste Vectors

When a user has diverse interests (Minecraft + politics + cooking), a single taste vector averages them into a meaningless midpoint. The fix:

1. Gather embeddings from all articles the user interacted with (rolling 30-day window)
2. Run k-means clustering (k=3-5) to find interest clusters
3. Each cluster centroid becomes a taste vector, weighted by interaction volume
4. At ranking time, score against **all** taste vectors and take the **best match**

```sql
SELECT a.id,
       MAX(1 - (a.embedding <=> utv.embedding)) AS best_content_score
FROM articles a
CROSS JOIN user_taste_vectors utv
WHERE utv.user_id = $1 AND a.is_read = false
GROUP BY a.id
```

Start with one vector. Switch to multiple when users with diverse interests get poor recommendations.

## User Interaction Signals

Current signals available in the schema:

| Signal | Currently tracked | Recommendation weight |
|--------|------------------|----------------------|
| Feed subscription | Yes | Implicit positive for all articles from feed |
| `is_read` | Yes | Weak positive (may be auto-marked by filter rules) |
| `is_archived` | Yes | Neutral (cleanup action, not quality signal) |
| Tags applied | Yes | Explicit categorization signal |
| Filter rules | Yes | Implicit negative (user hides matching content) |

**Signals to add:**

| Signal | How to collect | Weight |
|--------|---------------|--------|
| Article clicked/opened | Track click event (new) | 1x positive |
| Time spent reading > 30s | Client-side beacon (new) | 2x positive |
| Favorite / bookmark | New feature: `is_favorited` on articles | 3x positive |
| Mark read without opening | Derivable: `is_read` without click event | -0.5x negative |

The click and time-spent signals are the most important additions. Without them, we can't distinguish "user saw the title and was interested" from "article was auto-marked read by a filter rule."

## Architecture

### Where Things Live

```
Server-side only (not synced to client via Electric):
├── articles.embedding vector(384)           -- content embedding, computed once at ingestion
├── user_taste_vectors                       -- per-user interest clusters
│   ├── user_id, embedding vector(384), weight, computed_at
├── feed_scores                              -- per-user per-feed engagement ratio
│   ├── user_id, feed_id, affinity float, computed_at
└── tag_scores                               -- per-user per-tag engagement ratio
    ├── user_id, tag_id, affinity float, computed_at

Synced to client via Electric (new collection):
└── article_rankings                         -- precomputed scores
    ├── user_id, article_id, score float, computed_at
```

Embeddings and vector math are invisible to the frontend. The client only sees the final score per article.

### Data Flow

**At article ingestion (existing feed sync BullMQ job, modified):**

1. Parse RSS → save article → call embedding API → store embedding on article row
2. One API call per new article. ~10 lines of new code.

**Recurring BullMQ job (new, every 30-60 minutes):**

1. Recompute `user_taste_vectors` — weighted average (or k-means clusters) of interacted-article embeddings
2. Recompute `feed_scores` — `clicked / total` per feed per user
3. Recompute `tag_scores` — `clicked / total` per tag per user
4. Score all unread articles per user using the scoring formula
5. Write top N results to `article_rankings`

**Electric syncs `article_rankings` to client.**

**Client "Recommended" view:**

```ts
const ranked = useLiveQuery((q) =>
  q.articles
    .join(q.articleRankings, 'inner', (a, r) => a.id.eq(r.articleId))
    .where((a) => a.isRead.eq(false))
    .orderBy((_, r) => r.score, 'desc')
    .limit(50)
)
```

### Why This Fits the Local-First Architecture

The existing pattern is: server computes, Electric syncs, client queries locally. Recommendations follow the same pattern — `article_rankings` is just another synced collection. Rankings are available offline. The client doesn't need to call the server to display recommendations.

Staleness is acceptable — recommendations don't need to be real-time. A 30-60 minute refresh cycle is fine for an RSS reader.

## Embedding Model Options

| Model | Dimensions | Cost | Quality | Notes |
|-------|-----------|------|---------|-------|
| OpenAI `text-embedding-3-small` | 1536 | ~$0.02/1M tokens | Good | Best cost/quality ratio, API call |
| OpenAI `text-embedding-3-large` | 3072 | ~$0.13/1M tokens | Best | Overkill for short RSS content |
| `all-MiniLM-L6-v2` (local) | 384 | Free | Decent | Runs on CPU, ~200MB memory, no API dependency |
| `nomic-embed-text` (local) | 768 | Free | Good | Newer, better quality than MiniLM |
| Cohere `embed-v3` | 1024 | Free tier | Good | 100 req/min free tier |

For RSS content (titles + short descriptions), `text-embedding-3-small` or `nomic-embed-text` are both good. Quality differences matter less with short text.

**Cost estimate:** 10k new articles/day × ~500 tokens each = 5M tokens/day. With OpenAI small model: ~$0.10/day (~$3/mo).

## Database Changes

### New extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### New column on articles

```sql
ALTER TABLE articles ADD COLUMN embedding vector(384);
CREATE INDEX articles_embedding_idx ON articles USING hnsw (embedding vector_cosine_ops);
```

### New tables

```sql
CREATE TABLE user_taste_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_taste_vectors_user_id_idx ON user_taste_vectors(user_id);

CREATE TABLE feed_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  affinity REAL NOT NULL DEFAULT 0.0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, feed_id)
);
CREATE INDEX feed_scores_user_id_idx ON feed_scores(user_id);

CREATE TABLE tag_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  affinity REAL NOT NULL DEFAULT 0.0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag_id)
);
CREATE INDEX tag_scores_user_id_idx ON tag_scores(user_id);

CREATE TABLE article_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  score REAL NOT NULL DEFAULT 0.0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, article_id)
);
CREATE INDEX article_rankings_user_id_idx ON article_rankings(user_id);
CREATE INDEX article_rankings_score_idx ON article_rankings(user_id, score DESC);
```

### Interaction tracking (if adding click/time-spent signals)

```sql
CREATE TABLE article_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- 'click', 'read_30s', 'favorite'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX article_interactions_user_id_idx ON article_interactions(user_id);
CREATE INDEX article_interactions_lookup_idx ON article_interactions(user_id, article_id);
```

## Ranking Query (Server-Side)

The core query that the recurring BullMQ job runs per user:

```sql
WITH user_vectors AS (
  SELECT embedding, weight FROM user_taste_vectors WHERE user_id = $1
),
content_scores AS (
  SELECT
    a.id AS article_id,
    MAX((1 - (a.embedding <=> uv.embedding)) * uv.weight) AS content_score
  FROM articles a
  CROSS JOIN user_vectors uv
  WHERE a.user_id = $1
    AND a.is_read = false
    AND a.embedding IS NOT NULL
  GROUP BY a.id
),
scored AS (
  SELECT
    cs.article_id,
    cs.content_score * 0.50
    + COALESCE(fs.affinity, 0) * 0.25
    + COALESCE(MAX(ts.affinity), 0) * 0.10
    + (1.0 / (1 + EXTRACT(EPOCH FROM now() - a.pub_date) / 86400)) * 0.15
    AS final_score
  FROM content_scores cs
  JOIN articles a ON a.id = cs.article_id
  LEFT JOIN feed_scores fs ON fs.feed_id = a.feed_id AND fs.user_id = $1
  LEFT JOIN article_tags at ON at.article_id = a.id
  LEFT JOIN tag_scores ts ON ts.tag_id = at.tag_id AND ts.user_id = $1
  GROUP BY cs.article_id, cs.content_score, fs.affinity, a.pub_date
)
INSERT INTO article_rankings (user_id, article_id, score, computed_at)
SELECT $1, article_id, final_score, now()
FROM scored
ORDER BY final_score DESC
LIMIT 200
ON CONFLICT (user_id, article_id) DO UPDATE
SET score = EXCLUDED.score, computed_at = EXCLUDED.computed_at;
```

## Search

Search is a separate concern. The current architecture already supports basic search: articles are synced to the client via Electric SQL, and TanStack DB collections support local querying and filtering. A client-side `where` clause matching against `title` and `description` handles most search needs for an RSS reader.

If a dedicated search service is needed later (typo tolerance, faceted filtering, highlighting), Typesense is the best fit — see "Alternatives Evaluated" below. It would complement pgvector (Typesense for search UX, pgvector for recommendation ranking) without overlap.

## Alternatives Evaluated

### Typesense

Full-text search engine with native vector search (HNSW), hybrid search (keyword + vector with tunable alpha), and auto-embedding generation. Single C++ binary, simple to deploy.

**Strengths:** Typo tolerance, instant-as-you-type results, faceted filtering, highlighting. Official recommendation cookbook. Can generate embeddings internally (built-in models or OpenAI calls). Hybrid search combines keyword + semantic with rank fusion.

**Why not chosen for recommendations:** All indexed data must fit in RAM. Embeddings live inside Typesense and can't be extracted for custom scoring math (user taste vectors, feed affinity blending, k-means clustering). You'd need to call Typesense's API for all ranking logic instead of SQL. For recommendations, pgvector gives full control with zero new infrastructure.

**When to add:** When search UX becomes a priority (typo tolerance, faceted browsing). It complements pgvector — Typesense for search, pgvector for ranking.

### Gorse

Open-source recommendation engine (Go). Handles collaborative filtering + content-based. You push users, items, and feedback events via REST API. It trains models automatically in the background.

**Strengths:** Turnkey recommendation pipeline. Handles cold-start. Combines multiple recommendation strategies. Dashboard UI. TypeScript SDK available.

**Why not chosen:** Heavyweight deployment (master + worker + server + Redis). Mostly solo-developer project. Collaborative filtering needs ~1000+ active users to outperform content-based recommendations. The integration plumbing (syncing data to Gorse, getting results back into Electric sync pipeline) is roughly the same effort as the pgvector approach. Doesn't solve the fuzzy content understanding problem as well as embeddings — works on labels/categories rather than full semantic understanding.

**When to add:** When user count is large enough that "users who read similar articles also read X" signals outperform "articles similar to what you've read" signals (~1000+ active users).

### Recombee (Managed Service)

Fully managed recommendation API. Collaborative + content-based + reinforcement learning.

**Strengths:** Zero ops. Working in days. Free tier: 100k interactions/mo, 20k items.

**Why not chosen:** Free tier is small. Standard tier $99/mo. Vendor lock-in. Still need to build the integration layer and sync pipeline. Better suited for teams that want to avoid any ML/embedding work entirely.

### pgvector (Chosen Approach)

PostgreSQL extension for vector similarity search. HNSW indexes for fast approximate nearest-neighbor queries.

**Strengths:** Zero new infrastructure (already using Postgres). Full SQL control over scoring, joining with feed/tag scores, custom formulas. Mature (20k+ GitHub stars). Handles millions of rows. Disk-backed (unlike Typesense's RAM requirement).

**Tradeoff:** You own the embedding pipeline. But that's just one API call per article at ingestion time.

## Implementation Phases

### Phase 0: Interaction Tracking (prerequisite)

Add click tracking and optionally favorites. Without these signals, we can't distinguish genuine interest from passive consumption.

- Add `article_interactions` table
- Track click events from the client
- Optionally add `is_favorited` to articles or a dedicated favorites table

### Phase 1: Embeddings + pgvector

The core recommendation engine:

- Enable pgvector extension
- Add `embedding` column to articles with HNSW index
- Modify feed sync BullMQ job to generate embeddings at ingestion
- Create `user_taste_vectors`, `feed_scores`, `tag_scores`, `article_rankings` tables
- New recurring BullMQ job: `recompute-rankings`
- New Electric collection: `article_rankings`
- Client "Recommended" view using the rankings collection

### Phase 2: Multiple Taste Vectors

When single-vector recommendations feel off for users with diverse interests:

- Add k-means clustering to the ranking job
- Store multiple vectors per user in `user_taste_vectors`
- Ranking query already supports this (uses MAX across vectors)

### Phase 3: Search (if needed)

If client-side collection filtering isn't enough:

- Deploy Typesense
- Index articles into Typesense with content + embeddings
- Build search UI with typo tolerance, facets, highlighting

### Phase 4: Collaborative Filtering (at scale)

When user count justifies it:

- Evaluate Gorse or build lightweight collaborative filter
- "Users who read similar articles also read X"
- Blend collaborative signal into the scoring formula
