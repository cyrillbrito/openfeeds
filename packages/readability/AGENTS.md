# Readability Package

Article content extraction using Defuddle + JSDOM (server) / Defuddle (browser).

## Usage

**Server (Node/Bun with JSDOM):**

```typescript
import { fetchArticleContent, fetchArticleContentBatch } from '@repo/readability/server';

const article = await fetchArticleContent('https://example.com/article');
// { title, excerpt, content, author, published, image, wordCount }

const articles = await fetchArticleContentBatch(['url1', 'url2']);
// Map<url, ArticleContent>
```

**Browser (native Document):**

```typescript
import { extractFromPage } from '@repo/readability/browser';

const article = extractFromPage(); // uses current document
const article = extractFromPage(someDocument);
```

## Exports

**`@repo/readability/server`:**

- `fetchArticleContent(url)` - Fetch and extract single article
- `fetchArticleContentBatch(urls)` - Batch fetch multiple articles
- `ArticleContent` type

**`@repo/readability/browser`:**

- `extractFromPage(doc?)` - Extract from Document
- `ArticleContent` type

## ArticleContent

```typescript
interface ArticleContent {
  title: string | null;
  excerpt: string | null;
  content: string | null;
  author: string | null;
  published: string | null;
  image: string | null;
  wordCount: number | null;
}
```
