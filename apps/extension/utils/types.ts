export interface DiscoveredFeed {
  url: string;
  title: string;
  type?: string;
}

export type MessageType =
  | { type: "GET_FEEDS" }
  | { type: "FEEDS_RESULT"; feeds: DiscoveredFeed[] }
  | { type: "FOLLOW_FEED"; feed: DiscoveredFeed }
  | { type: "FOLLOW_RESULT"; success: boolean; error?: string };

export interface StorageData {
  apiUrl: string;
}

export const DEFAULT_API_URL = "http://localhost:3001";
