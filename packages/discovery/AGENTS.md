# Discovery Package - RSS Feed Discovery Rules

RSS feed discovery package for automatically finding RSS/Atom feeds from various sources.

## Features

- **Known Service Detection**: Automatically detects RSS feeds for popular services
- **HTML Link Parsing**: Extracts RSS/Atom feed links from HTML `<link>` tags
- **Fallback Discovery**: Tries common RSS feed paths as fallback
- **TypeScript Support**: Full TypeScript types included
- **Comprehensive Testing**: 57 tests covering all functionality

## Usage Patterns

**Basic Discovery:**

```typescript
import { discoverFeeds } from '@repo/discovery';

// Discover feeds from any URL
const feeds = await discoverFeeds('https://www.reddit.com/r/javascript');
console.log(feeds);
// [{ url: 'https://www.reddit.com/r/javascript.rss', title: 'Subreddit Feed' }]
```

**Service-Specific Discovery:**

```typescript
import { services } from '@repo/discovery';

// Use individual service checkers
const result = services.GithubRepo('https://github.com/microsoft/typescript');
if (result.match) {
  console.log(result.feeds); // Releases, commits, tags feeds
}
```

**With Options:**

```typescript
const feeds = await discoverFeeds('https://example.com', {
  timeout: 5000, // Request timeout in ms
  userAgent: 'MyBot/1.0', // Custom user agent
  followRedirects: true, // Follow HTTP redirects
});
```

## Supported Services

- **YouTube**: Channels, playlists
- **Reddit**: Homepage, subreddits, users, post comments
- **GitHub**: Repositories (releases, commits, tags), user activity
- **GitLab**: Repositories, user activity
- **Medium**: Tag pages
- **Others**: Kickstarter, Vimeo, Itch.io, Mirror.xyz

## Type Definitions

```typescript
interface Feed {
  url: string; // Feed URL
  title: string; // Human readable title
  type?: string; // MIME type (e.g., 'application/rss+xml')
}

interface DiscoveryOptions {
  timeout?: number;
  followRedirects?: boolean;
  userAgent?: string;
}
```

## Development

```bash
# Run tests
bun test

# Run specific test file
bun test src/services.test.ts
```

## Best Practices

- Always handle errors when discovering feeds
- Use appropriate timeouts for external requests
- Test new service additions with comprehensive test cases
- Follow existing patterns when adding new service detectors
