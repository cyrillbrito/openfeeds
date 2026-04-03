import {
  checkKnownServices,
  dedupeFeeds,
  extractFeedLinks,
  extractHeuristicFeeds,
  isSupportedProtocol,
  type DiscoveredFeed,
} from './core/index.js';

export type { DiscoveredFeed, Feed, ServiceResult, ExtractOptions } from './core/index.js';
export { checkKnownServices, SERVICES } from './core/index.js';

export function discoverFeedsFromDocument(doc: Document = document): DiscoveredFeed[] {
  const baseUrl = doc.location?.href || '';

  if (!isSupportedProtocol(baseUrl)) {
    return [];
  }

  const knownServiceResult = checkKnownServices(baseUrl);
  if (knownServiceResult && knownServiceResult.feeds.length > 0) {
    return knownServiceResult.feeds;
  }

  const linkFeeds = extractFeedLinks(doc, { baseUrl });
  const heuristicFeeds = extractHeuristicFeeds(doc, { baseUrl });

  return dedupeFeeds([...linkFeeds, ...heuristicFeeds]);
}
