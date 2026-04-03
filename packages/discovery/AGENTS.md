# Discovery Package - RSS Feed Discovery

Discovers RSS/Atom feeds from URLs. Detects known services (YouTube, Reddit, GitHub, GitLab, Medium, etc.), parses HTML `<link>` tags, and tries common feed paths as fallback.

## Usage

```typescript
import { discoverFeeds } from '@repo/discovery';

const feeds = await discoverFeeds('https://example.com', { timeout: 5000 });
// Returns: Array<{ url: string, title: string, type?: string }>
```

Individual service checkers available via `services` export.

## Development

```bash
bun test
bun test src/services.test.ts
```

Follow existing patterns when adding new service detectors. Test thoroughly.
