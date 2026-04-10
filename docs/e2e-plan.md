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

## Test Data Strategy

### Option A: Fresh user per test (current approach, recommended)
- Auth fixture creates a new user via signup for each test
- **Pros**: No cleanup needed, full isolation, simple, Playwright-recommended
- **Cons**: Accumulates garbage users in DB, can't run against production

### Option B: Zero-trace testing (cleanup after each test)

Each test cleans up all data it creates via API calls.

**Pros:**
- Can run against any environment including staging/production
- No data accumulation, DB stays clean
- Forces well-defined API boundaries (delete endpoints exist for everything)
- Catches cascade/orphan bugs early

**Cons:**
- Need cleanup API endpoints for every entity (don't exist yet)
- More complex fixtures — every fixture needs teardown logic
- Cleanup failures leave orphaned data and cause cascading test failures
- Cleanup bugs are silent — one test breaks, a different test fails (hardest debugging pattern)
- "Impossible to clean up" some things (e.g. visited links, audit logs, analytics events)
- Cleanup code is untested code that rots
- Every new entity/relationship requires updating cleanup routines
- Parallel test interference — two tests cleaning up concurrently can step on each other

**Effort estimate:**
- Build `deleteUser` server function + API endpoint (~1-2 hours)
- Since all tables have `ON DELETE CASCADE` from `user_id`, deleting the user cascades everything — so per-entity cleanup isn't needed IF we always create isolated users
- Add teardown to auth fixture (~30 min)
- But: if tests create data without the auth fixture (e.g. OAuth API tests), each needs its own cleanup
- Ongoing maintenance: every new entity/flow needs cleanup consideration

**What Playwright officially says:**
> "There are two different strategies: start from scratch or cleanup in between. The problem with cleaning up is that it can be easy to forget to clean up and some things are impossible to clean up. State from one test can leak into the next test which could cause your test to fail and make debugging harder as the problem comes from another test."
> — [Playwright Isolation docs](https://playwright.dev/docs/browser-contexts)

**Playwright recommends "start from scratch", not "cleanup after".**

Martin Fowler agrees: *"If a test fails because it didn't build up the initial state properly, it's easy to see which test contains the bug. With clean-up, one test will contain the bug, but another test will fail — so it's hard to find the real problem."*

**Industry reality:** No major framework or authority recommends per-test cleanup as the primary isolation strategy. Successful teams use fresh DB, fresh users, transaction rollback, or test containers — not per-test teardown.

### Option C: Dedicated test database (reset per run)
- Separate DB for e2e, wiped/seeded before each test run
- **Pros**: Clean slate every time, no cleanup code needed, fastest tests
- **Cons**: Can't test against production, need DB management in CI, different from real environment

### Option D: Hybrid — fresh users + periodic batch cleanup
- Keep fresh-user-per-test for simplicity
- Add a periodic cleanup: `DELETE FROM "user" WHERE email LIKE '%@e2e-test.local' AND created_at < NOW() - INTERVAL '24 hours'`
- All tables cascade from `user_id`, so one query cleans everything
- **Pros**: Simple test code, no per-test cleanup, works in CI, DB stays clean over time
- **Cons**: Still can't safely run against production, needs a cleanup script/cron

### Recommendation

Start with **Option A** (fresh user per test) — it's what Playwright recommends, it's simple, and it's already partially implemented. Add **Option D** (periodic batch cleanup) when data accumulation becomes a problem — it's a single SQL query thanks to cascade deletes.

Zero-trace (Option B) is explicitly discouraged by Playwright and the effort/fragility ratio is poor. The only scenario where it matters is testing against production, which we shouldn't be doing with e2e tests anyway.

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

### Playwright Test Agents (official)

Playwright now ships **three official AI test agents** via `npx playwright init-agents`:

| Agent | Purpose |
|---|---|
| **Planner** | Explores the app via browser, produces a Markdown test plan in `specs/` |
| **Generator** | Transforms the Markdown plan into Playwright test files in `tests/` |
| **Healer** | Runs failing tests, inspects UI, auto-repairs locators/waits/assertions |

Setup: `npx playwright init-agents --loop=opencode`

This generates agent definitions (instructions + MCP tools) that OpenCode can use. The workflow is:
1. Write a **seed test** (`seed.spec.ts`) that sets up auth/navigation
2. **Planner** explores the app and writes `specs/*.md` test plans
3. **Generator** converts specs into `tests/*.spec.ts` files
4. **Healer** runs tests and auto-fixes failures

This is the official Playwright approach for AI-assisted test writing. Agent definitions should be regenerated whenever Playwright is updated.

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

### What to set up

- [ ] Run `npx playwright init-agents --loop=opencode` to install official test agent definitions
- [ ] Remove or deprecate `.opencode/skills/playwright-cli/` (redundant with agent-browser + Playwright agents)
- [ ] Create a `seed.spec.ts` that handles auth setup for the planner/generator
- [ ] Update `apps/e2e/AGENTS.md` with the new agent workflow and best practices
- [ ] Upgrade `@playwright/test` to latest (currently 1.58.2) to get agent support

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
