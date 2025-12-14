# E2E Testing Rules

## TypeScript Guidelines

Return types should be auto-inferred, not explicitly typed:

```typescript
// Good
getNameInput() {
  return this.page.getByPlaceholder('Enter your full name');
}

// Bad
getNameInput(): Locator {
  return this.page.getByPlaceholder('Enter your full name');
}
```

## Testing Philosophy

**Zero-trace testing:** Tests must clean up all data they create - can run safely against any environment.

## Key Patterns

**Page Object Model:**

- Flat structure in `lib/` directory
- Locators as methods (not cached properties)
- Actions return meaningful values when needed
- Encapsulates page interactions and locators in reusable classes
- Improves maintainability and reduces code duplication
- Pages (full views), Modals (dialogs), Components (reusable elements)
- Only implement when needed - don't pre-build everything

**Visual Regression Testing:**

- Add `toHaveScreenshot()` to existing functional tests
- Mask dynamic content (emails, timestamps) to prevent false failures
- Use `--update-snapshots` to generate baselines

**Test Data:**

- Clean up via API calls, not UI interactions
- Use Mock Server for reliable RSS feed testing

## Commands

```bash
bunx playwright test                     # Run all tests
bunx playwright test --update-snapshots  # Generate screenshot baselines
bunx playwright test --ui                # Debug mode

# Run specific test file
bunx playwright test tests/import-opml.spec.ts
```

## Mock Server

Provides reliable mock RSS feeds on `http://localhost:9999` - auto-starts/stops with Playwright via `webServer` config.

**Structure:**

```
mock-server/
├── server.ts        # HTTP server (port 9999)
├── start-server.ts  # Entry point for webServer
└── feeds/*.xml      # Mock RSS responses
```

**Adding Mock Feeds:**

1. Create `mock-server/feeds/my-feed.xml` with RSS content
2. Add route in `mock-server/server.ts`:
   ```typescript
   if (url.pathname === '/my-feed.xml') {
     res.writeHead(200, { 'Content-Type': 'application/xml' });
     res.end(myFeedXML);
   }
   ```
3. Use in tests: `http://localhost:9999/my-feed.xml`

**Benefits:**

- No network failures
- Instant responses
- Consistent test data

## Best Practices

- Always clean up test data via API
- Use mock server for RSS feeds
- Mask dynamic content in screenshots
- Use Page Object Model for reusable interactions
- Auto-infer return types
- Test against any environment safely
