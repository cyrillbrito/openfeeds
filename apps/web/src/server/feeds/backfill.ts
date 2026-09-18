// One-time enrichment of articles that predate the media columns.
//
// Inserts are `onConflictDoNothing`, which is right for dedup and means an
// existing row is NEVER updated by a re-fetch. So without this, every article
// already in the database would sit at NULL excerpt and NULL image forever
// while only newly-published items got the new list treatment.
//
// It is deliberately best-effort and works from STORED COLUMNS ONLY — no
// re-fetching of every feed, which is what the same job would cost done the
// obvious way. That puts a ceiling on what it can recover: an image from the
// body HTML or a YouTube link, a kind from the link and the title. A podcast
// enclosure is not in any stored column, so old episodes stay 'article' until
// they fall out of the feed — an acceptable price for not re-downloading
// every feed on a schema change.
import 'server-only';

import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  classifyItem,
  excerptLimitFor,
  showsExcerpt,
} from '../../lib/article-kind';
import { youtubeThumbnailUrl, youtubeVideoId } from '../../lib/youtube';
import { db } from '../db';
import { articles } from '../db/schema';
import { deriveExcerpt, firstImageUrl } from './excerpt';

/**
 * Rows per pass.
 *
 * Batched rather than done in one statement because this runs at boot on the
 * request path's process, and a reader with years of history should not stall
 * its first sweep behind one enormous transaction.
 */
const BATCH = 500;

/**
 * `excerpt IS NULL` is the marker for "never enriched".
 *
 * Which is why the writers below — here and in sync.ts — store the empty
 * string for an item that HAS no excerpt (a video, a note, a body that
 * reduced to nothing). Without that distinction this scan would re-examine
 * the same excerptless rows on every boot, forever.
 */
export async function backfillArticleMetadata(): Promise<number> {
  let total = 0;

  for (;;) {
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        summary: articles.summary,
        content: articles.content,
        kind: articles.kind,
        imageUrl: articles.imageUrl,
      })
      .from(articles)
      .where(isNull(articles.excerpt))
      .limit(BATCH);

    if (rows.length === 0) break;

    for (const row of rows) {
      const videoId = youtubeVideoId(row.url);

      // Only ever WIDEN a stored kind. 'short' was classified by the same
      // rule this would apply, and re-deriving 'note' from a stored title is
      // unsound: normalize.ts substitutes 'Untitled' for a missing one, so
      // the absence that defines a note is no longer visible from here.
      const kind =
        row.kind === 'article' && videoId
          ? classifyItem({ url: row.url ?? undefined, feedTitle: row.title })
          : row.kind;

      await db
        .update(articles)
        .set({
          excerpt:
            (showsExcerpt(kind)
              ? deriveExcerpt(row.summary, row.content, excerptLimitFor(kind))
              : '') ?? '',
          imageUrl:
            row.imageUrl ??
            (videoId ? youtubeThumbnailUrl(videoId) : undefined) ??
            bodyImage(row.content, row.url) ??
            bodyImage(row.summary, row.url) ??
            null,
          kind,
        })
        .where(eq(articles.id, row.id));
    }

    total += rows.length;
    if (rows.length < BATCH) break;
  }

  return total;
}

/**
 * An image out of stored body HTML.
 *
 * Skipped entirely when the row has no link: without one there is no base to
 * resolve a relative `src` against, and a made-up base would turn a relative
 * path into a confidently wrong absolute URL — a broken image rather than an
 * absent one.
 */
function bodyImage(
  html: string | null,
  articleUrl: string | null,
): string | undefined {
  return articleUrl ? firstImageUrl(html, articleUrl) : undefined;
}

/** How much work is outstanding — used to skip the log line when there is none. */
export async function countUnenrichedArticles(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(articles)
    .where(and(isNull(articles.excerpt)));
  return row?.value ?? 0;
}
