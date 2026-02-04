import { feeds, getDb } from '@repo/db';
import { attemptAsync } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { type Feed } from './entities/feed';
import { assert } from './errors';
import { fetchRss, type ParseFeedResult } from './rss-fetch';

function parseWebpageUrl(feedResult: ParseFeedResult): string | undefined {
  if (feedResult.format === 'rss') {
    return feedResult.feed.link;
  } else if (feedResult.format === 'atom') {
    const alternateLink =
      feedResult.feed.links?.find((link) => link.rel !== 'self') ?? feedResult.feed.links?.[0];
    return alternateLink?.href;
  } else {
    throw new Error('Other feed type');
  }
}

interface SocialMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

// HTML entities map
const htmlEntities: Record<string, string> = {
  nbsp: ' ',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  apos: "'",
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text.replace(/&([^;]+);/g, (match, entity) => {
    // Named entities
    if (htmlEntities[entity]) {
      return htmlEntities[entity];
    }
    // Numeric entities (&#123;)
    if (entity.startsWith('#')) {
      const code = entity.startsWith('#x')
        ? parseInt(entity.substring(2), 16)
        : parseInt(entity.substring(1), 10);
      return String.fromCharCode(code);
    }
    return match;
  });
}

async function extractSocialMetadata(url: string): Promise<SocialMetadata> {
  const metadata: SocialMetadata = {};
  const response = await fetch(url);

  const rewriter = new HTMLRewriter()
    // Extract Open Graph meta tags
    .on('meta[property^="og:"]', {
      element(el) {
        const property = el.getAttribute('property');
        const content = el.getAttribute('content');
        if (property && content) {
          // Convert "og:image" to "image" etc.
          const key = property.replace('og:', '') as keyof SocialMetadata;
          metadata[key] = decodeHtmlEntities(content);
        }
      },
    })
    // Extract Twitter Card meta tags as fallback
    .on('meta[name^="twitter:"]', {
      element(el) {
        const name = el.getAttribute('name');
        const content = el.getAttribute('content');
        if (name && content) {
          const key = name.replace('twitter:', '') as keyof SocialMetadata;
          // Only use Twitter Card data if we don't have OG data
          if (!metadata[key]) {
            metadata[key] = decodeHtmlEntities(content);
          }
        }
      },
    })
    // Fallback to regular meta tags
    .on('meta[name="description"]', {
      element(el) {
        const content = el.getAttribute('content');
        if (content && !metadata.description) {
          metadata.description = decodeHtmlEntities(content);
        }
      },
    })
    // Fallback to title tag
    .on('title', {
      text(text) {
        if (!metadata.title) {
          metadata.title = decodeHtmlEntities(text.text);
        }
      },
    });

  // Process the response
  await rewriter.transform(response).blob();

  // Convert relative image URLs to absolute
  if (metadata.image && !metadata.image.startsWith('http')) {
    try {
      metadata.image = new URL(metadata.image, url).href;
    } catch {
      // Keep the original URL if parsing fails
    }
  }

  return metadata;
}

export async function fetchFeedMetadata(feed: ParseFeedResult): Promise<Partial<Feed>> {
  const websiteUrl = parseWebpageUrl(feed);
  if (!websiteUrl) {
    // TODO If not website is found, try to get information from the feed itself
    return {};
  }

  const metadata = await extractSocialMetadata(websiteUrl);
  console.log(metadata);
  return {
    url: websiteUrl,
    icon: metadata.image,
    title: metadata.title || metadata.siteName,
    description: metadata.description,
  };
}

export async function updateFeedMetadata(userId: string, feedId: string) {
  const db = getDb();

  const [feedErr, feed] = await attemptAsync(
    db.query.feeds.findFirst({
      columns: { feedUrl: true },
      where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    }),
  );
  if (feedErr) {
    // logger.error(feedErr);
    throw feedErr;
  }

  assert(feed);

  const parseFeedResult = await fetchRss(feed.feedUrl);
  const partialFeedWithMetadata = await fetchFeedMetadata(parseFeedResult);

  // Only update fields that are safe to update
  const updateData: {
    url?: string;
    icon?: string | null;
    title?: string;
    description?: string | null;
  } = {};

  if (partialFeedWithMetadata.url) updateData.url = partialFeedWithMetadata.url;
  if (partialFeedWithMetadata.icon !== undefined) updateData.icon = partialFeedWithMetadata.icon;
  if (partialFeedWithMetadata.title) updateData.title = partialFeedWithMetadata.title;
  if (partialFeedWithMetadata.description !== undefined)
    updateData.description = partialFeedWithMetadata.description;

  const [updateErr] = await attemptAsync(
    db
      .update(feeds)
      .set(updateData)
      .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId))),
  );
  if (updateErr) {
    throw updateErr;
  }
}
