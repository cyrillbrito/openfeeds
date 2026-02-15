import type { Page } from '@playwright/test';

/**
 * Add network delay to specific endpoints for testing loading states
 */
export async function addNetworkDelay(page: Page, url: string, delayMs: number = 1000) {
  await page.route(url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/**
 * Simulate network failure for specific endpoints
 */
export async function simulateNetworkFailure(
  page: Page,
  url: string,
  errorType: 'failed' | 'disconnected' | 'timeout' = 'failed',
) {
  await page.route(url, async (route) => {
    await route.abort(errorType);
  });
}

/**
 * Clear all network routes to restore normal behavior
 */
// export async function clearNetworkRoutes(page: Page, pattern?: string) {
//   if (pattern) {
//     await page.unroute(pattern);
//   } else {
//     await page.unroute('**/*');
//   }
// }
