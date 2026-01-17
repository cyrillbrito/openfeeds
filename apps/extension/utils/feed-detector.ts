import { discoverFeedsFromDocument } from '@repo/discovery/browser';
import type { DiscoveredFeed } from './types';

export function detectFeedsFromPage(): DiscoveredFeed[] {
  return discoverFeedsFromDocument(document);
}
