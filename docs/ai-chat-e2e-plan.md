# AI Chat E2E Testing Plan

## The Big Question: Real LLM Calls vs Mocking

### Option 1: Real Anthropic API calls on CI

Run tests against the actual Anthropic API with a cheap model (e.g. `claude-haiku-4`).

**Pros:**
- Tests the real thing end-to-end — streaming, tool calling, persistence, the full pipeline
- Catches integration bugs that mocks can never surface (malformed tool call args, unexpected model output, SSE framing issues)
- Simple — no mock infrastructure to build or maintain

**Cons:**
- Costs money per CI run (Haiku is ~$0.25/M input, $1.25/M output — probably $0.01–0.05/run for a small test suite, but it adds up with retries and flaky re-runs)
- Non-deterministic — the model may produce different tool calls or phrasing, making assertions fragile
- Slow — even Haiku takes 1-5s per response, multiplied by tool-call round-trips
- Flaky — Anthropic rate limits, transient 500s, or overloaded APIs will fail your CI for reasons outside your control
- Requires storing `ANTHROPIC_API_KEY` as a CI secret

### Option 2: Mock the SSE endpoint at the network level

Intercept `POST /api/chat` with `page.route()` and return canned SSE responses.

**Pros:**
- Fast, deterministic, free
- Can test exact tool-call sequences with known outputs
- No external dependency — CI never fails due to Anthropic outages
- Can simulate edge cases that are hard to trigger with a real model (errors mid-stream, empty responses, malformed tool results)

**Cons:**
- Hard to do correctly. The `/api/chat` endpoint returns a TanStack AI SSE stream, not a simple JSON response. You'd need to replicate the exact SSE event format (`data: {"type":"text-delta",...}\n\n`, tool call events, finish events, etc.). If the TanStack AI wire format changes, your mocks silently diverge.
- Doesn't test the server at all — skips auth middleware, tool execution, persistence middleware, analytics middleware
- Doesn't test that actual domain functions work when called via AI tools
- High mock maintenance burden — every time you add a tool or change the prompt, you need to update the canned responses

### Option 3: Mock at the Anthropic SDK level (server-side)

Swap the Anthropic adapter in the server with a fake that returns scripted responses. This could be done via an env var (`AI_MOCK=true`) or by intercepting the outbound HTTP call to `api.anthropic.com` from the server process.

**Pros:**
- Tests the full server pipeline (auth, tools, persistence, streaming) — everything except the actual LLM
- Deterministic tool call sequences
- Free, fast

**Cons:**
- Requires instrumenting the server code to support a mock mode — either a conditional adapter swap or a mock HTTP interceptor in the server process (not in the browser). This is non-trivial to set up cleanly.
- The mock needs to understand the Anthropic messages API format (not just SSE) to produce realistic tool_use blocks
- If using env-based switching: you need a separate server config for test runs
- Still doesn't test that the model actually calls the right tools for a given prompt

### Decision: Real API with configurable model

**Use Option 1 (real API) with a small, focused test suite**, and accept the cost and non-determinism for the core flows. Here's why:

1. The value of AI e2e tests is testing the integration — if you mock the LLM, you're mostly testing your own mock fidelity.
2. Haiku is cheap enough that a 5-10 test suite costs pennies per run.
3. Non-determinism can be managed with loose assertions ("response contains some text" rather than "response equals X"), `toContainText`, and retry-friendly test design.
4. For the UI-only flows (popover open/close, backdrop click, maximize navigation, keyboard shortcuts), **no LLM is needed at all** — these can be tested without sending any messages.

### Configurable model via env var

The model is currently hardcoded as `claude-sonnet-4-5` in `apps/web/src/routes/api/chat.ts:69`. To use a cheaper model in CI/tests, add a `AI_MODEL` env var with a fallback to the production default:

```ts
// In apps/web/src/routes/api/chat.ts
adapter: anthropicText(env.AI_MODEL ?? 'claude-sonnet-4-5'),
```

Add `AI_MODEL` to the web app's `env.ts` (t3-env) as an optional server var. This keeps production unchanged (falls back to Sonnet) while CI sets `AI_MODEL=claude-haiku-4` for cheaper, faster test runs.

**Practical setup:**
- Add `ANTHROPIC_API_KEY` as a CI secret
- Set `AI_MODEL=claude-haiku-4` in CI env for e2e runs
- Set generous timeouts for LLM tests (30s+ per test)
- Keep the LLM test count small — only test flows that _require_ a real response
- Gate LLM tests behind a tag/annotation so they can be skipped locally if no key is present

---

## Test Structure

```
apps/e2e/tests/ai-chat/
  popover.spec.ts          # Popover UI interactions (no LLM needed)
  fullscreen.spec.ts       # Full-page chat navigation and layout
  messaging.spec.ts        # Send message + receive response (needs LLM)
  tool-calling.spec.ts     # Tool-based queries: feeds, articles, tags (needs LLM)
  sessions.spec.ts         # Session switching, persistence, multi-session (needs LLM)
  keyboard-shortcuts.spec.ts  # Cmd+J, Escape, Enter/Shift+Enter (no LLM needed)
```

Page Object Model:

```
apps/e2e/lib/
  AiPopover.ts             # Popover locators + actions
  AiChatPage.ts            # Full-page /ai locators + actions
  ChatInput.ts             # Shared input locators (textarea, send/stop buttons)
  ChatMessages.ts          # Message list locators (user bubbles, AI responses, tool indicators)
  ConversationSwitcher.ts  # Session dropdown locators
```

---

## Test Suites

### 1. Popover UI (`popover.spec.ts`)

No LLM needed — these test the popover shell, not message content.

| # | Test | Notes |
|---|------|-------|
| 1 | FAB is visible on authenticated pages | Check sparkles button exists at bottom-right |
| 2 | FAB is hidden on /ai route | Navigate to `/ai`, assert FAB not visible |
| 3 | Clicking FAB opens popover | Click FAB, assert popover panel visible with `role="complementary"` and `aria-label="AI Chat"` |
| 4 | FAB is hidden while popover is open | After opening, FAB should disappear |
| 5 | Popover has correct structure | Title bar, messages area, input area all present |
| 6 | Clicking close button closes popover | Click X button (`title="Close"`), assert popover hidden |
| 7 | Clicking backdrop closes popover | Click the backdrop scrim div, assert popover closed |
| 8 | Pressing Escape closes popover | Open popover, press Escape, assert closed |
| 9 | Expand button navigates to /ai (no messages) | Click maximize button (`title="Expand to full page"`), assert URL is `/ai` |
| 10 | Expand button navigates to /ai/$sessionId (with messages) | Send a message first, then expand — URL should be `/ai/{sessionId}` |
| 11 | Popover shows empty state initially | "Ask me anything" or equivalent empty state text |
| 12 | New chat button resets the conversation | Click plus button (`title="New chat"`), assert messages cleared |

### 2. Full-Page Chat (`fullscreen.spec.ts`)

| # | Test | Notes |
|---|------|-------|
| 1 | /ai route renders full-page chat | Navigate, check header + input visible |
| 2 | /ai/$sessionId loads existing session | Create a session first, navigate directly, check messages load |
| 3 | Sidebar "AI Chat" link navigates to /ai | Click nav item, assert URL |
| 4 | New chat button in header works | Click, assert URL changes to `/ai` and messages clear |
| 5 | Title updates after first message | Send message, assert title in header changes from "New chat" |
| 6 | Visual regression (optional) | `toHaveScreenshot()` on the full-page layout — defer until UI stabilizes |

### 3. Keyboard Shortcuts (`keyboard-shortcuts.spec.ts`)

No LLM needed.

| # | Test | Notes |
|---|------|-------|
| 1 | Cmd+J opens popover (desktop) | Press Cmd+J, assert popover visible |
| 2 | Cmd+J closes popover if already open | Open, press again, assert closed |
| 3 | Cmd+J navigates to /ai on mobile viewport | Set viewport <1024px, press Cmd+J, assert URL is `/ai` |
| 4 | Enter sends message | Type text, press Enter, assert message sent |
| 5 | Shift+Enter adds newline | Type text, Shift+Enter, assert textarea has newline and no message sent |
| 6 | Escape closes popover | Open popover, press Escape, assert closed |

### 4. Messaging (`messaging.spec.ts`)

Needs LLM. Use generous timeouts (30s+).

| # | Test | Notes |
|---|------|-------|
| 1 | Can send a message and receive a response | Type message, send, wait for AI response to appear. Assert user bubble on right, AI response on left with some text content |
| 2 | User message appears immediately | After sending, user bubble should be visible before AI responds (optimistic) |
| 3 | Loading indicator shows during generation | After send, assert loading state visible (disabled input, "Generating response..." placeholder) |
| 4 | Stop button appears during generation | While AI is responding, assert stop button visible |
| 5 | Stop button cancels generation | Click stop mid-stream, assert loading stops. Partial response may remain |
| 6 | Input is disabled during generation | While loading, textarea should be disabled |
| 7 | Input clears after sending | After send, textarea should be empty |
| 8 | Error state renders if chat fails | Mock a 500 response on `/api/chat` via `page.route()` for this specific test — assert error message visible |
| 9 | Can send multiple messages in sequence | Send message, wait for response, send another, wait. Assert both exchanges visible |

### 5. Tool Calling (`tool-calling.spec.ts`)

Needs LLM + seeded test data. These tests require the test user to have feeds, articles, and tags already set up.

**Setup:** Before each test, seed the user with 1-2 feeds (via the mock RSS server + follow API/server function), a tag, and wait for articles to sync.

| # | Test | Notes |
|---|------|-------|
| 1 | Can ask about feeds and get feed info | Ask "what feeds do I follow?", assert response mentions the seeded feed title. Look for tool call indicator (spinner → checkmark) |
| 2 | Can ask about articles | Ask "show me my latest articles", assert response mentions article titles from seeded feeds |
| 3 | Can ask about tags | Ask "what tags do I have?", assert response mentions the seeded tag name |
| 4 | Can ask about usage/plan info | Ask "what's my usage?", assert response contains usage-related info (feed count, etc.) |
| 5 | Tool call indicator shows during execution | When a tool is called, assert the tool indicator UI appears (spinner while running, checkmark when done) |
| 6 | Can perform a write action (follow a feed) | Ask "follow https://localhost:9999/tech-blog.xml", confirm if prompted, assert success. Optionally verify the feed appears in the user's feed list |
| 7 | Can manage tags via chat | Ask "create a tag called test-tag", assert success response. Verify tag appears in the tag list |

### 6. Session Management (`sessions.spec.ts`)

Needs LLM for creating sessions with real messages.

| # | Test | Notes |
|---|------|-------|
| 1 | Sending a message creates a persisted session | Send message, wait for response. Reload page, open conversation switcher — session should appear with derived title |
| 2 | Can switch between sessions | Create 2 sessions (send message in each). Open switcher, click the other session — messages should change to that session's history |
| 3 | Active session shows checkmark in switcher | Open switcher, assert current session has checkmark icon |
| 4 | Can delete a session | Create a session, open switcher, hover and click delete. Assert session removed from list |
| 5 | Deleting active session starts new chat | Delete the current session, assert messages clear and title resets to "New chat" |
| 6 | Session title derived from first message | Send "What feeds do I have?", assert session title in switcher matches (truncated first message) |
| 7 | Both sessions respond correctly after switching | Create session A (ask about feeds), switch, create session B (ask about tags). Switch back to A — messages should show feed discussion. Switch to B — messages should show tag discussion |
| 8 | Expand from popover opens correct session | In popover, send a message. Click expand. Assert `/ai/$sessionId` URL matches the session, and messages are the same |
| 9 | Sessions grouped by time period in switcher | Create sessions, open switcher — assert "Today" group label visible |
| 10 | Conversation switcher shows "No conversations yet" when empty | Fresh user, open switcher — assert empty state text |

---

## Proposed Additional Tests

### Accessibility (`accessibility.spec.ts`)

| # | Test | Notes |
|---|------|-------|
| 1 | Popover has correct ARIA attributes | `role="complementary"`, `aria-label="AI Chat"` |
| 2 | FAB has accessible title | `title="Open AI chat (⌘J)"` or equivalent |
| 3 | Close/expand/new buttons have titles | Assert `title` attributes on all icon-only buttons |
| 4 | Input has placeholder text | "Ask me anything..." when idle, "Generating response..." when loading |
| 5 | Send button has accessible title | `title="Send"` |
| 6 | Stop button has accessible title | `title="Stop generating"` |
| 7 | Focus management on popover open | When popover opens, focus should move to the textarea (or be trappable within the popover) |
| 8 | axe accessibility scan on popover | Run `@axe-core/playwright` on the popover — catch color contrast, missing labels, etc. |
| 9 | axe accessibility scan on full-page | Run axe on `/ai` |

### Edge Cases (`edge-cases.spec.ts`)

| # | Test | Notes |
|---|------|-------|
| 1 | Sending empty message does nothing | Clear input, press Enter — no message sent, no network request |
| 2 | Whitespace-only message does nothing | Type spaces, press Enter — nothing happens |
| 3 | Very long message is handled | Send a 5000+ char message — assert it sends and renders (may scroll) |
| 4 | Rapid message sending | Send message, immediately try to send another while loading — second should be blocked (input disabled) |
| 5 | Popover state persists across navigation | Open popover, navigate to another page (e.g. feeds), assert popover stays open with same messages |
| 6 | Mobile viewport hides popover, shows /ai route | Set viewport <1024px, click FAB, assert navigated to `/ai` (not popover) |

### Markdown Rendering (`markdown.spec.ts`)

Needs LLM or canned responses.

| # | Test | Notes |
|---|------|-------|
| 1 | AI response renders markdown correctly | Ask a question likely to produce markdown (e.g. "list my feeds as a table"), assert rendered HTML contains expected elements (headers, lists, code blocks, etc.) |
| 2 | Links in AI responses are clickable | Assert `<a>` tags in responses have `href` attributes |

---

## Test Data Seeding

For tool-calling tests, users need pre-existing data. Strategy:

1. **Auth fixture** — same as existing: create a fresh user via `/api/auth/sign-up/email` + `/api/auth/sign-in/email`
2. **Feed seeding** — use the mock RSS server (already configured on port 9999). After auth, call the follow-feed server function or API to subscribe to `http://localhost:9999/tech-blog.xml`
3. **Tag seeding** — call the create-tag server function or use `page.evaluate()` to invoke it
4. **Wait for sync** — after seeding, wait for Electric SQL to sync the data to the client. This may need a short poll/wait for the collection to populate.

Consider a shared `ai-chat-fixture.ts` that extends the auth fixture with seeded data.

---

## CI Configuration

```yaml
# In the e2e CI job
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  AI_MODEL: claude-haiku-4
```

**Cost control:**
- CI uses Haiku via `AI_MODEL` env var; production defaults to Sonnet (no env var needed)
- Keep LLM-dependent tests to a minimum (~10 tests)
- Consider running LLM tests only on `main` merges and PRs, not on every push
- Set a monthly budget alert on the Anthropic account

**Skipping LLM tests locally:**
- If `ANTHROPIC_API_KEY` is not set, skip tests tagged `@llm` with a clear message
- All non-LLM tests (popover, shortcuts, accessibility) should always run

---

## Implementation Priority

| Priority | Suite | Effort | LLM needed |
|----------|-------|--------|------------|
| 1 | Popover UI | Low | No |
| 2 | Keyboard shortcuts | Low | No |
| 3 | Messaging (basic send/receive) | Medium | Yes |
| 4 | Session management | Medium | Yes |
| 5 | Tool calling | Medium-High | Yes |
| 6 | Accessibility | Low | No |
| 7 | Edge cases | Low | Partial |
| 8 | Markdown rendering | Low | Yes |

Start with suites 1-2 (no LLM, fast to write, validate the POM setup), then tackle 3-4 (core LLM integration), and add 5-8 incrementally.

---

## Open Questions

1. **Tool call assertions** — How strict should we be? "Response mentions feed title" is resilient but loose. "Tool indicator appears" is more concrete but doesn't verify content.
2. **Session persistence timing** — The server persists via `ctx.defer()` (non-blocking). After sending a message, how long should we wait before asserting the session appears in the switcher? May need to poll the Electric-synced collection.
3. **Visual regression** — Worth adding `toHaveScreenshot()` for the popover and full-page views, or defer until the UI stabilizes?
4. **Parallel execution** — LLM tests are slow. Should they run in parallel (faster but more API calls) or serial (safer for rate limits)?
