export interface RssItem {
  title: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  category?: string | string[];
  author?: string;
  enclosure?: {
    url: string;
    type: string;
    length?: string;
  };
}

export interface AtomEntry {
  title: string;
  link?:
    | {
        href: string;
        rel?: string;
        type?: string;
      }
    | string;
  summary?: string;
  content?: string;
  published?: string;
  updated?: string;
  id?: string;
  author?: {
    name: string;
    email?: string;
  };
}

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  language?: string;
  lastBuildDate?: string;
  pubDate?: string;
  item: RssItem | RssItem[];
}

export interface AtomFeed {
  title: string;
  link: {
    href: string;
    rel?: string;
    type?: string;
  };
  subtitle?: string;
  updated: string;
  id: string;
  entry: AtomEntry | AtomEntry[];
}

export interface RssDocument {
  rss?: {
    channel: RssChannel;
  };
}

export interface AtomDocument {
  feed?: AtomFeed;
}

export type FeedDocument = RssDocument | AtomDocument;

// Union type for feed entries that handles both RSS and Atom
export type FeedEntry = RssItem | AtomEntry;
