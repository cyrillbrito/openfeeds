# End-to-End Testing

## Technology Choice

**Playwright** - Selected for TypeScript support, cross-browser testing, and excellent API testing capabilities.

## Zero-Trace Testing Philosophy

**Core Principle**: E2E tests must be able to run against any environment (development, staging, production) without leaving any persistent data or traces.

### Key Requirements

- **Complete Self-Cleanup**: Every test must clean up all data it creates
- **Environment Agnostic**: Tests should work safely against live environments
- **No Test Pollution**: No leftover users, sessions, articles, feeds, or database files
- **Deterministic State**: Each test run starts with a known clean state
- **Parallel Safety**: Multiple test runs should not interfere with each other

### Implementation Strategy

- **Dynamic Test Data**: Generate unique test users with timestamp-based emails (e.g., `test-1672531200000@e2e.local`)
- **Comprehensive Cleanup**: Remove auth records, user databases, and any created content
- **Verification**: Confirm all test data was successfully removed
- **Safety Mechanisms**: Prevent accidental cleanup of non-test data

### Benefits

- **Production-Safe**: Developers and CI/CD can run tests against any environment
- **Maintainable**: No manual cleanup between test runs required
- **Scalable**: Multiple developers can run tests simultaneously without conflicts
- **Reliable**: Consistent starting state eliminates flaky tests due to data pollution

### Cleanup Commands

```bash
# Verify if cleanup is needed
bun cleanup:verify

# See what would be cleaned (dry run)
bun cleanup:dry-run

# Actually perform cleanup
bun cleanup

# Manual cleanup verification
bun scripts/verify-cleanup.ts --help
```

### Automatic Cleanup

Tests automatically clean up after themselves using Playwright fixtures:

- **Global Setup**: Cleans existing test data before test suite starts
- **Global Teardown**: Cleans all test data after test suite completes
- **Per-Test Cleanup**: Each test cleans its own data automatically
- **Verification**: Ensures cleanup was successful

### Manual Cleanup

If tests are interrupted or cleanup fails, use manual cleanup:

```bash
# Check what needs cleaning
bun cleanup:verify

# Preview cleanup actions
bun cleanup:dry-run

# Perform cleanup
bun cleanup
```

## Project Structure

```
apps/e2e/
├── tests/
├── lib/                   # Page Object Models (flat structure)
│   ├── LoginPage.ts
│   ├── SignupPage.ts
│   ├── FeedListPage.ts
│   ├── AddFeedModal.ts
│   ├── ImportOpmlModal.ts
│   ├── ArticleListPage.ts
│   ├── ArticleDetailPage.ts
│   ├── ReadStatusToggle.ts
│   ├── TagModal.ts
│   └── Navigation.ts
├── mocks/                 # MSW mock server setup
│   ├── handlers.ts
│   ├── server.ts
│   ├── index.ts
│   ├── rss-feeds/
│   │   ├── tech-blog.xml
│   │   ├── news-feed.xml
│   │   ├── youtube-feed.xml
│   │   └── malformed.xml
│   └── opml/
│       └── sample-import.opml
├── playwright.config.ts
└── package.json
```

**Rationale**: E2E tests are final consumers that orchestrate and test other apps. They belong in `apps/` since they're never imported as dependencies, only executed.

## Third-Party RSS Feed Mocking Strategy

### Approach: MSW (Mock Service Worker) Server

Since RSS fetching happens in the backend (Hono API), not the frontend, we need to mock at the Node.js level using MSW:

**File Structure:**

```typescript
// apps/e2e/mocks/handlers.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { http, HttpResponse } from 'msw';
// apps/e2e/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const handlers = [
  http.get('https://feeds.example.com/rss.xml', () => {
    const rssContent = readFileSync(join(__dirname, './rss-feeds/tech-blog.xml'), 'utf8');
    return HttpResponse.text(rssContent, {
      headers: { 'Content-Type': 'application/rss+xml' },
    });
  }),

  http.get('https://feeds.youtube.com/feeds/videos.xml', () => {
    const youtubeContent = readFileSync(join(__dirname, './rss-feeds/youtube-feed.xml'), 'utf8');
    return HttpResponse.text(youtubeContent, {
      headers: { 'Content-Type': 'application/rss+xml' },
    });
  }),
];

export const mockServer = setupServer(...handlers);

// apps/e2e/mocks/index.ts
export { mockServer } from './server';
export { handlers } from './handlers';
```

**Integration with Playwright:**

```typescript
// apps/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { mockServer } from './mocks';

export default defineConfig({
  globalSetup: async () => {
    mockServer.listen({ onUnhandledRequest: 'error' });
  },
  globalTeardown: async () => {
    mockServer.close();
  },
});
```

### Mock Data Structure

All mock data lives within the mocks directory for better isolation:

```
apps/e2e/mocks/
├── handlers.ts            # MSW request handlers
├── server.ts              # MSW server setup
├── index.ts               # Export barrel
├── rss-feeds/
│   ├── tech-blog.xml      # Sample tech RSS feed
│   ├── news-feed.xml      # Sample news RSS feed
│   ├── youtube-feed.xml   # YouTube channel feed
│   └── malformed.xml      # Invalid RSS for error testing
└── opml/
    └── sample-import.opml  # OPML import test data
```

### Benefits

- No real external requests during tests
- Consistent, reproducible test data
- Fast test execution
- Can simulate error conditions (404, timeout, malformed XML)

## Core Test Scenarios

### 1. Authentication Flow

- Login/logout with Better Auth
- Protected route access verification
- Session persistence

### 2. RSS Feed Management

- Add feed by URL (with mocked RSS response)
- OPML import functionality
- Feed list display and basic management

### 3. Article Reading Experience

- Article listing and navigation
- Read/unread status toggling
- YouTube video/shorts detection and display
- Basic tagging functionality

## Out of Scope

- Backend API testing (separate concern)
- Performance testing (separate concern)
- Cross-browser compatibility (initial focus on Chromium)

## Page Object Model (POM) Structure

### Concept

Page Object Model creates a higher-level API for test authoring by encapsulating page-specific interactions and locators in reusable classes. This improves maintainability and reduces code duplication.

### Page Object Guidelines

**OpenFeeds Specific Components:**

**Pages** (full page views):

- `LoginPage.ts` - Better Auth login flow
- `SignupPage.ts` - User registration
- `FeedListPage.ts` - Display and manage RSS feeds
- `ArticleListPage.ts` - Browse articles, pagination
- `ArticleDetailPage.ts` - Read article content, YouTube embeds

**Modals** (dialog components):

- `AddFeedModal.ts` - Add new RSS feed by URL dialog
- `ImportOpmlModal.ts` - OPML import dialog
- `TagModal.ts` - Article tagging dialog

**Components** (reusable UI elements):

- `ReadStatusToggle.ts` - Read/unread status toggle
- `Navigation.ts` - Shared navigation elements

### Implementation Pattern

```typescript
// Example: lib/FeedListPage.ts
export class FeedListPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Locators - found when accessed, not pre-cached
  getAddFeedButton() {
    return this.page.getByRole('button', { name: 'Add Feed' });
  }

  getFeedList() {
    return this.page.getByTestId('feed-list');
  }

  getImportOpmlButton() {
    return this.page.getByRole('button', { name: 'Import OPML' });
  }

  // Actions
  async goto() {
    await this.page.goto('/feeds');
  }

  async clickAddFeed() {
    await this.getAddFeedButton().click();
  }

  async getFeedCount() {
    return await this.getFeedList().locator('[data-testid="feed-item"]').count();
  }
}
```

**Implementation Notes:**

- Only implement page objects when needed for specific tests (don't pre-build everything)
- Component helpers can also live in `lib/` for reusable UI components across pages

### Benefits for OpenFeeds

- **Maintainability**: Changes to SolidJS components only require updates to corresponding page objects
- **Reusability**: Common actions (login, navigation) shared across tests
- **Readability**: Tests read like user workflows rather than low-level DOM interactions
- **Component Focus**: Mirrors SolidJS component structure for intuitive organization

## Best Practices

### Selector Strategy

- **Prefer semantic selectors**: Use `getByRole()`, `getByLabel()`, `getByText()` over CSS selectors
- **Use data-testid for components**: Add `data-testid` attributes to SolidJS components for reliable targeting
- **Avoid dynamic selectors**: Stay away from auto-generated class names or IDs

### Test Organization

- **Use Playwright fixtures** for setup/teardown operations (database seeding, authentication)
- **Test isolation**: Each test runs in a fresh browser context (automatic in Playwright)
- **Setup projects**: Use for shared authentication states and app initialization
- **Parallelize tests**: Configure workers in `playwright.config.ts` for faster execution
- **Group related tests**: Organize tests by feature area (auth, feeds, articles)

### Authentication Strategy

- **Reuse authenticated states**: Use `storageState` to save login sessions across tests
- **Setup projects**: Create shared authentication for different user types
- **API authentication**: Log in via API calls for faster test setup than UI-based login

### Debugging & Maintenance

- **Enable tracing** in CI for failed tests: `trace: 'on-first-retry'`
- **Use VS Code extension**: Install Playwright extension for live debugging and test generation
- **Use screenshots/videos** for debugging complex interactions
- **Monitor test flakiness**: Investigate and fix unstable tests rather than adding retries

### Test Data Management

- **Dynamic test data**: Generate test data through API calls rather than static fixtures
- **Isolated test state**: Each test should create and clean up its own data
- **Realistic scenarios**: Use data that mirrors real RSS feeds and user behavior

## Implementation Notes

### Test Database

- Use separate test database instance
- Reset state between test runs via Playwright fixtures
- Seed test data dynamically per test when needed

### Server Management

- Playwright will start both web and api servers
- Use different ports for test environment
- Ensure clean shutdown after tests

### Visual Regression Testing

**Screenshot Testing Strategy:**

- Use `toHaveScreenshot()` for visual regression detection
- Add screenshots to existing functional tests (no duplication)
- Mask dynamic content (emails, timestamps) to prevent false failures
- Generate baseline images with `--update-snapshots`

**Implementation:**

```typescript
// Add to existing functional tests
test('should display signin page elements', async ({ page }) => {
  // ... existing assertions
  await expect(page).toHaveScreenshot(); // Clean initial state
});

test('should handle errors', async ({ page }) => {
  // ... trigger error state
  await expect(page).toHaveScreenshot({
    mask: [page.getByTestId('email-input')], // Mask dynamic content
  });
});
```

### Configuration

```typescript
// playwright.config.ts example additions
export default defineConfig({
  workers: process.env.CI ? 1 : undefined, // Parallel locally, serial in CI
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  snapshotPathTemplate: './screenshots/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  projects: [
    // Setup project for authentication
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
```

**OpenFeeds Specific Implementation:**

```typescript
// Example: tests/auth.setup.ts - for Better Auth login state
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  // Login via API or UI
  await page.goto('/login');
  // ... Better Auth login flow
  await page.context().storageState({ path: 'auth-state.json' });
});
```
