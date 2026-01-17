import type { DiscoveredFeed } from "./types";

const FEED_MIME_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json",
  "application/xml",
  "text/xml",
];

/**
 * Detect RSS/Atom feeds from the current page's <link> tags
 */
export function detectFeedsFromPage(): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];
  const seenUrls = new Set<string>();

  // Method 1: Check <link> tags with rel="alternate"
  const linkElements = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="alternate"]'
  );

  for (const link of linkElements) {
    const type = link.type?.toLowerCase() || "";
    const href = link.href;

    if (!href || seenUrls.has(href)) continue;

    const isFeedType = FEED_MIME_TYPES.some((mimeType) =>
      type.includes(mimeType)
    );

    if (isFeedType) {
      seenUrls.add(href);
      feeds.push({
        url: href,
        title: link.title || extractTitleFromUrl(href),
        type: type,
      });
    }
  }

  // Method 2: Check for common feed link patterns in <a> tags
  const anchorElements = document.querySelectorAll<HTMLAnchorElement>("a");

  for (const anchor of anchorElements) {
    const href = anchor.href?.toLowerCase() || "";
    const text = anchor.textContent?.toLowerCase() || "";

    if (!anchor.href || seenUrls.has(anchor.href)) continue;

    const looksLikeFeed =
      href.includes("/feed") ||
      href.includes("/rss") ||
      href.includes("/atom") ||
      href.endsWith(".xml") ||
      href.endsWith(".rss") ||
      text.includes("rss") ||
      text.includes("feed") ||
      text.includes("subscribe");

    if (looksLikeFeed && isValidFeedUrl(anchor.href)) {
      seenUrls.add(anchor.href);
      feeds.push({
        url: anchor.href,
        title: anchor.textContent?.trim() || extractTitleFromUrl(anchor.href),
        type: "potential",
      });
    }
  }

  return feeds;
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Extract meaningful name from path
    const parts = pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || "Feed";

    return lastPart
      .replace(/\.(xml|rss|atom|json)$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Feed";
  }
}

function isValidFeedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}
