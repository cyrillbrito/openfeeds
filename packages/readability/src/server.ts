import { Readability } from '@mozilla/readability';
import { Browser, BrowserErrorCaptureEnum } from 'happy-dom';
import type { ArticleContent } from './types.js';

export type { ArticleContent } from './types.js';

const NAVIGATION_TIMEOUT_MS = 30_000;

/**
 * Fetch a URL and extract readable content using happy-dom + Readability
 */
export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const browser = new Browser({
    settings: {
      errorCapture: BrowserErrorCaptureEnum.disabled,
      disableJavaScriptEvaluation: true,
    },
  });

  try {
    const page = browser.newPage();

    try {
      await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS });
      await page.waitUntilComplete();

      const reader = new Readability(page.mainFrame.document as any);
      const article = reader.parse();

      if (!article) {
        console.error(`[${url}] Readability parse returned null`);
        return { title: null, excerpt: null, content: null };
      }

      console.log(`[${url}] Extracted: "${article.title}" (${article.content?.length || 0} chars)`);

      return {
        title: article.title || null,
        excerpt: article.excerpt || null,
        content: article.content || null,
      };
    } catch (error) {
      console.error(
        `[${url}] Article extraction failed:`,
        error instanceof Error ? error.message : String(error),
      );
      return { title: null, excerpt: null, content: null };
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

/**
 * Batch fetch multiple URLs and extract readable content
 * More efficient for multiple URLs as it reuses the browser instance
 */
export async function fetchArticleContentBatch(
  urls: string[],
): Promise<Map<string, ArticleContent>> {
  const browser = new Browser({
    settings: {
      errorCapture: BrowserErrorCaptureEnum.disabled,
      disableJavaScriptEvaluation: true,
    },
  });

  const results = new Map<string, ArticleContent>();

  try {
    for (const url of urls) {
      const page = browser.newPage();

      try {
        await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS });
        await page.waitUntilComplete();

        const reader = new Readability(page.mainFrame.document as any);
        const article = reader.parse();

        if (!article) {
          console.error(`[${url}] Readability parse returned null`);
          results.set(url, { title: null, excerpt: null, content: null });
          continue;
        }

        console.log(
          `[${url}] Extracted: "${article.title}" (${article.content?.length || 0} chars)`,
        );
        results.set(url, {
          title: article.title || null,
          excerpt: article.excerpt || null,
          content: article.content || null,
        });
      } catch (error) {
        console.error(
          `[${url}] Article extraction failed:`,
          error instanceof Error ? error.message : String(error),
        );
        results.set(url, { title: null, excerpt: null, content: null });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
