import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const articlesDir = join(fixturesDir, 'articles');
const rssTemplate = readFileSync(join(fixturesDir, 'rss-template.xml'), 'utf-8');

const articleFixtures = readdirSync(articlesDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => readFileSync(join(articlesDir, f), 'utf-8'));

let articleIndex = 0;

function getNextArticle(): string {
  const html = articleFixtures[articleIndex % articleFixtures.length];
  articleIndex++;
  return html ?? '';
}

function generateRssItem(feedId: string, articleNum: number, baseUrl: string): string {
  const now = new Date();
  const oneHourMs = 3600000;
  const pubDate = new Date(now.getTime() - articleNum * oneHourMs);

  return `
    <item>
      <title>Article ${articleNum} from Feed ${feedId}</title>
      <link>${baseUrl}/article/${feedId}-${articleNum}</link>
      <description>This is article ${articleNum} from benchmark feed ${feedId}</description>
      <guid isPermaLink="false">${feedId}-article-${articleNum}</guid>
      <pubDate>${pubDate.toUTCString()}</pubDate>
    </item>`;
}

function generateRssFeed(feedId: string, articleCount: number, baseUrl: string): string {
  const items = Array.from({ length: articleCount }, (_, i) =>
    generateRssItem(feedId, i + 1, baseUrl),
  ).join('\n');

  return rssTemplate
    .replace('{{FEED_TITLE}}', `Benchmark Feed ${feedId}`)
    .replace('{{FEED_LINK}}', `${baseUrl}/feed/${feedId}`)
    .replace('{{FEED_ID}}', feedId)
    .replace('{{BUILD_DATE}}', new Date().toUTCString())
    .replace('{{ITEMS}}', items);
}

interface MockServerConfig {
  port: number;
  articlesPerFeed: number;
  delay?: number;
}

interface MockServer {
  url: string;
  close: () => void;
}

export function startMockServer(config: MockServerConfig): MockServer {
  const { port, articlesPerFeed, delay = 0 } = config;
  const baseUrl = `http://localhost:${port}`;

  const server = Bun.serve({
    port,
    fetch: async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;

      if (delay > 0) {
        await Bun.sleep(delay);
      }

      const feedMatch = path.match(/^\/feed\/([^/]+)\.xml$/);
      if (feedMatch) {
        const feedId = feedMatch[1];
        const articleCount = parseInt(url.searchParams.get('articles') ?? '') || articlesPerFeed;
        const rss = generateRssFeed(feedId ?? '', articleCount, baseUrl);
        return new Response(rss, {
          headers: { 'Content-Type': 'application/xml' },
        });
      }

      const articleMatch = path.match(/^\/article\/(.+)$/);
      if (articleMatch) {
        const queryDelay = parseInt(url.searchParams.get('delay') ?? '');
        if (queryDelay > 0) {
          await Bun.sleep(queryDelay);
        }
        const html = getNextArticle();
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Mock server started at ${baseUrl}`);

  return {
    url: baseUrl,
    close: () => {
      server.stop();
      console.log('Mock server stopped');
    },
  };
}
