import { Readability } from '@mozilla/readability';
import { Browser, BrowserErrorCaptureEnum } from 'happy-dom';

const NAVIGATION_TIMEOUT_MS = 30_000;

export async function fetchAndProcessArticleBatch(
  urls: string[],
): Promise<Map<string, string | null>> {
  const browser = new Browser({
    settings: {
      errorCapture: BrowserErrorCaptureEnum.disabled,
      disableJavaScriptEvaluation: true,
    },
  });

  const results = new Map<string, string | null>();

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
          results.set(url, null);
          continue;
        }

        console.log(
          `[${url}] Extracted: "${article.title}" (${article.content?.length || 0} chars)`,
        );
        results.set(url, article.content || null);
      } catch (error) {
        console.error(
          `[${url}] Article extraction failed:`,
          error instanceof Error ? error.message : String(error),
        );
        results.set(url, null);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
