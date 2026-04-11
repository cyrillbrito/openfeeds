# E2E Testing Plan

## Current State

**Result: 18 passing, 82 failing, 2 skipped out of 102 tests.**

Most failures are timeout errors — page object locators don't match the current UI (e.g. `getByRole('button', { name: 'Sign In' })` not found). The app has changed significantly since these tests were written.

### What passes
- 1 auth-signin test (navigate to signup link)
- 2 import-opml tests (import success, cancel)
- All 5 OAuth discovery tests (API-only, no UI)
- All 3 dynamic registration tests (API-only)
- 2 OAuth flow tests (skip login, consent deny)
- 2 MCP access control tests (reject no/invalid token)
- 1 OAuth security test (unknown client_id)
- 1 OAuth userinfo test (reject no token)
- 5 tags tests (empty name validation, backdrop close, prevent empty, color feedback, whitespace)

### What fails
- Nearly all auth tests (signin/signup) — button/form locators don't match current UI
- All feed tests (add/edit/delete/list) — likely same locator drift
- Most tags tests — tests needing a logged-in user fail (auth fixture broken?)
- Most OAuth tests that require consent flow / token exchange
- Import OPML tests that need auth

### Root causes
1. **Locator drift**: UI changed, page object models weren't updated
2. **Auth fixture likely broken**: Tests needing a logged-in user all timeout
3. **5s timeout too tight**: Even working tests cut it close
4. **No CI**: Tests were never enforced, so they rotted

---

## Test Data Strategy: Fresh User Per Test

**Decision: fresh user per test, no cleanup.** Each test creates a unique user via the auth fixture. Tests are fully isolated because each user can only see their own data (all queries filter by `user_id`).

This is the Playwright-recommended approach ("start from scratch" over "cleanup in between") and is already partially implemented in the auth fixture. Playwright explicitly warns against per-test cleanup: *"it can be easy to forget to clean up and some things are impossible to clean up. State from one test can leak into the next test."*

**Data accumulation:** Not a problem in CI (ephemeral DB). For local dev, if it ever matters, a single batch cleanup query handles everything thanks to cascade deletes: `DELETE FROM "user" WHERE email LIKE '%@e2e-test.local' AND created_at < NOW() - INTERVAL '24 hours'`. All tables cascade from `user_id`.

See [appendix](#appendix-test-data-strategy-options-considered) for the full comparison of strategies considered.

---

## Existing Tests: Fix vs Rewrite

### Assessment

**Recommendation: fix, don't rewrite.** The infrastructure (auth fixture, utils, mock server, POM pattern, config) is solid and reusable. The failures are locator drift and invalid assumptions about local-first behavior, not structural problems.

### What's salvageable

| Component | Status | Effort to fix |
|---|---|---|
| Auth fixture (`auth-fixture.ts`) | **Works** — `page.evaluate` calls to `/api/auth/sign-up/email` and `/api/auth/sign-in/email` are still valid | None |
| Utils (creds, network, oauth, auth-client) | **All work** | None |
| Mock RSS server | **Works** | None |
| POM pattern/structure | **Good** — matches AGENTS.md conventions | None |
| `SigninPage.ts` | 2 string changes: "Sign In" → "Log In", "Signing In..." → "Logging In..." | 15 min |
| `SignupPage.ts` | 1 string change: "Sign in" → "Log in" link text | 10 min |
| `Drawer.ts` | Nav items changed: "All Articles" gone, "Manage Feeds" → "Feeds", new "Discover"/"AI Chat" | 1 hr |
| `TagsPage.ts` | Tags are now list rows (not `.card`), tag name is `<span>` not heading, `modal-open` → `dialog[open]`, dropdown structure changed | 2 hr |
| `FeedsPage.ts` | Feed rows instead of cards, "Add Feed" button gone (now `/discover` route), empty state text changed, "Delete" → "Unfollow" | 2 hr |
| `AddFeedModal.ts` | **Delete entirely** — feed adding moved to `/discover` route. Replace with `DiscoverPage.ts` | 2 hr |
| `EditFeedModal.ts` | Title "Edit Feed" → "Edit", no save/reset buttons (auto-save), checkboxes → MultiSelectTag | 1 hr |
| `DeleteFeedModal.ts` | "Delete Feed" → "Unfollow Feed", confirm text changed, no loading state (local-first) | 1 hr |

### Tests to delete (no longer valid)

These test scenarios are invalid due to the local-first architecture shift:
- All **loading state** assertions for tags/feeds (local-first operations are instant, no async)
- All **network error** tests for tags/feeds (no API calls — data goes to local TanStack DB)
- **Duplicate tag name detection** tests (no client-side validation for this)
- Everything using `AddFeedModal` (the modal doesn't exist; feed discovery is a separate route)

### Estimated effort

- **Fix approach:** ~2-3 days (update POMs, prune invalid tests, verify)
- **Rewrite approach:** ~5-7 days for the same end result, plus risk of losing edge case coverage

### Action plan

1. Fix `SigninPage`/`SignupPage` POMs (30 min) — gets auth tests green
2. Update `Drawer.ts` for new nav structure (1 hr)
3. Rewrite `FeedsPage.ts` for list-row layout (2 hr)
4. Replace `AddFeedModal.ts` with `DiscoverPage.ts` (2 hr)
5. Update `TagsPage.ts` selectors + delete invalid tests (3 hr)
6. Update `EditFeedModal.ts` / `DeleteFeedModal.ts` (2 hr)
7. Fix all test files referencing changed POMs (2 hr)
8. Update screenshots (`--update-snapshots`)

---

## Plan to Get Green

### Step 1: Triage — skip all failing tests
- Add `test.skip` to every failing test
- Get to a passing suite immediately
- This gives us a green baseline to add to CI

### Step 2: Fix auth fixture
- The auth fixture is the foundation — most tests depend on it
- Investigate why user creation/login is timing out
- Update to match current signup/signin UI or use API-only auth

### Step 3: Update page object models
- Use `agent-browser` to snapshot current UI and discover correct selectors
- Update POMs in `lib/` one by one: SigninPage, SignupPage, FeedsPage, TagsPage, etc.
- Unskip auth tests → fix → unskip feed tests → fix → etc.

### Step 4: Fix playwright config
- Uncomment dev server startup or add proper setup
- Increase timeout from 5s to something reasonable (15-30s)
- Consider adding `webServer` config for the main app

### Step 5: Add to CI
- Add a GitHub Actions workflow that:
  - Starts the app
  - Runs `bunx playwright test`
  - Uploads test report as artifact
  - Fails the build on test failure
- Start with just the passing tests, expand as we fix more

### Step 6: Unskip and fix tests incrementally
- Work through skipped tests file by file
- Priority: auth → tags → feeds → import → oauth
- Delete tests that are no longer relevant rather than fixing them

---

## AI Skills & Tools

### Browser automation: agent-browser only

We use **`agent-browser`** (v0.25.3, installed via Homebrew) as our single browser interaction tool for AI agents. No need for `playwright-cli` CLI — both tools serve the same purpose (snapshot-based browser automation for AI), and having two creates confusion. `agent-browser` is already installed and works.

`agent-browser` is for **exploring the app interactively** — discovering selectors, verifying flows, debugging failures. The actual test code is standard Playwright (`@playwright/test`).

### Playwright Test Agents (installed)

`bunx playwright init-agents --loop=opencode` has been run. It generated:

**Files created in `apps/e2e/`:**
- `.opencode/prompts/playwright-test-planner.md` — planner agent instructions
- `.opencode/prompts/playwright-test-generator.md` — generator agent instructions
- `.opencode/prompts/playwright-test-healer.md` — healer agent instructions
- `opencode.json` — MCP server config + agent definitions with tool permissions
- `tests/seed.spec.ts` — empty seed test (needs our auth setup)
- `specs/README.md` — directory for test plans

**How it works:**
- Registers a `playwright-test` MCP server (`npx playwright run-test-mcp-server`) that provides browser automation tools
- Defines 3 OpenCode agents as subagents with scoped tool access:
  - **Planner**: browser navigation + snapshot tools + `planner_save_plan`
  - **Generator**: browser interaction tools + `generator_setup_page` + `generator_write_test`
  - **Healer**: browser inspection tools + `test_run` + `test_debug` + file edit tools

**What still needs to happen:**
- [x] Run `bunx playwright init-agents --loop=opencode`
- [ ] Update `seed.spec.ts` with our auth fixture (so planner/generator start authenticated)
- [ ] Remove `.opencode/skills/playwright-cli/` (replaced by Playwright Test Agents)
- [ ] Update `apps/e2e/AGENTS.md` with the new agent workflow
- [ ] Test the planner/generator/healer workflow end-to-end
- [ ] Consider: does `opencode.json` in `apps/e2e/` get picked up by OpenCode at the repo root? May need to move or merge config.

### Playwright best practices (from official docs)

Key practices to encode in our AGENTS.md / skills:
- **User-facing locators**: `getByRole`, `getByText`, `getByLabel` — not CSS selectors
- **Web-first assertions**: `await expect(x).toBeVisible()` — not `expect(await x.isVisible()).toBe(true)`
- **Test isolation**: Each test gets its own browser context (Playwright default), fresh user per test
- **No floating promises**: Lint with `@typescript-eslint/no-floating-promises`
- **Trace on first retry**: For CI debugging (already configured)
- **Parallel by default**: Tests in a single file can run in parallel with `test.describe.configure({ mode: 'parallel' })`
- **Mock third-party dependencies**: Use `page.route()` for external APIs
- **Chromium-only on CI is fine**: Faster, cheaper, cross-browser is optional

### Remaining setup

- [ ] Update `seed.spec.ts` with auth fixture
- [ ] Remove `.opencode/skills/playwright-cli/`
- [ ] Verify `opencode.json` in `apps/e2e/` is picked up by OpenCode
- [ ] Update `apps/e2e/AGENTS.md` with new workflow + fresh-user-per-test decision
- [ ] Test the planner → generator → healer pipeline end-to-end
- [ ] Upgrade `@playwright/test` if needed (currently 1.58.2, agents may need newer)

---

## Improvements to Consider

### Testing infrastructure
- [ ] Add `webServer` config to auto-start the app (currently commented out)
- [ ] Set up Playwright HTML reporter in CI with artifact upload
- [ ] Configure trace recording on first retry (already set, verify it works)

### Test quality
- [ ] Increase global timeout to 15s (30s for OAuth)
- [ ] Add retry logic in CI (already configured: 2 retries)
- [ ] Use web-first assertions everywhere
- [ ] Use user-facing locators (role, text, label) not CSS selectors
- [ ] Lint tests with `@typescript-eslint/no-floating-promises`

### Missing test coverage
- [ ] Article reading experience (core feature, zero tests)
- [ ] Read/unread status
- [ ] Keyboard shortcuts
- [ ] Feed refresh / sync
- [ ] Error states (server down, network offline)
- [ ] Onboarding flow

### Developer experience
- [ ] Add `bun test:e2e` script to root package.json
- [ ] Document how to run e2e locally in README
- [ ] Update e2e AGENTS.md with current patterns and agent workflow

---

## Open Questions

1. Should we keep visual regression testing (`toHaveScreenshot`)? High-maintenance with UI changes. Maybe defer until UI stabilizes.
2. Is the mock RSS server approach still right, or should we use Playwright's built-in route mocking?
3. Should OAuth tests live in e2e or be integration tests in the domain package?
4. How important is cross-browser testing? Chromium-only is much faster.
5. Do we want to test against a real running app or mock the backend?

---

## Appendix: Test Data Strategy Options Considered

### Zero-trace testing (cleanup after each test)

Each test cleans up all data it creates via API calls.

**Pros:** Can run against any environment including staging/production. No data accumulation. Forces well-defined API boundaries. Catches cascade/orphan bugs early.

**Cons:** Need cleanup API endpoints for every entity (don't exist yet). More complex fixtures. Cleanup failures leave orphaned data and cause cascading test failures. Cleanup bugs are silent — one test breaks, a different test fails. "Impossible to clean up" some things (visited links, audit logs). Cleanup code is untested code that rots. Every new entity/relationship requires updating cleanup routines. Parallel test interference.

**Effort:** ~2-3 hours initial (deleteUser endpoint + fixture teardown) since cascade deletes handle most entities. But ongoing maintenance for every new entity/flow.

**Rejected because:** Playwright explicitly recommends against it. Martin Fowler agrees: *"With clean-up, one test will contain the bug, but another test will fail."* No major framework recommends this as primary isolation strategy.

### Dedicated test database (reset per run)

Separate DB for e2e, wiped/seeded before each test run.

**Pros:** Clean slate every time. No cleanup code. Fastest tests.

**Cons:** Can't test against production. Need DB management in CI. Different from real environment.

**Rejected because:** Adds infrastructure complexity. Fresh-user-per-test achieves the same isolation with less setup.
