import type { Feed } from '@repo/discovery/browser';

export type DiscoveredFeed = Feed;

export type MessageType =
  | { type: 'GET_FEEDS' }
  | { type: 'FEEDS_RESULT'; feeds: DiscoveredFeed[] }
  | { type: 'FOLLOW_FEED'; feed: DiscoveredFeed }
  | { type: 'FOLLOW_RESULT'; success: boolean; error?: string };

export interface StorageData {
  apiUrl?: string;
  theme?: 'light' | 'dark' | 'system';
}

export const DEFAULT_API_URL = 'https://openfeeds.app';
