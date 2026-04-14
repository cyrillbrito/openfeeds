# AI Chat E2E Testing Plan

## Strategy: Real LLM Calls

**Use real Anthropic API** with a cheap model (`claude-haiku-4` via `AI_MODEL` env var) for tests that need AI responses. Non-determinism managed with loose assertions (`toContainText`, "response has some text") rather than exact matching.

**UI-only tests** (popover, navigation, keyboard shortcuts) need no LLM at all.

### TODO: CI Setup

- [ ] Add `AI_MODEL` env var to `apps/web/src/env.ts` (optional server var) and wire into `api/chat.ts`
- [ ] Add `ANTHROPIC_API_KEY` as CI secret
- [ ] Set `AI_MODEL=claude-haiku-4` in CI env for e2e runs
- [ ] Gate LLM tests: `test.skip(!process.env.ANTHROPIC_API_KEY, 'needs API key')`

---

## Test Structure

```
apps/e2e/tests/ai-chat/
  popover.spec.ts       # Popover + FAB UI interactions (no LLM)
  fullscreen.spec.ts    # Full-page /ai navigation and layout (no LLM)
  messaging.spec.ts     # Send message + receive response (LLM)
  sessions.spec.ts      # Session persistence, switching, deletion (LLM)
  tool-calling.spec.ts  # Tool-based queries with seeded data (LLM)
```

Page Object Model:

```
apps/e2e/lib/
  AiChat.ts             # All chat locators + actions (popover, page, input, messages, switcher)
```

---

## E2E Test Suites

### 1. Popover + FAB (`popover.spec.ts`) — No LLM

| # | Test | Notes |
|---|------|-------|
| 1 | FAB visible on authenticated pages | Assert button with `title="Open AI chat"` exists |
| 2 | Clicking FAB opens popover | Click FAB, assert `role="complementary"` panel visible |
| 3 | FAB hidden while popover is open | After opening, FAB disappears |
| 4 | Popover shows empty state | "How can I help?" text visible |
| 5 | Close button closes popover | Click `title="Close"`, assert panel hidden |
| 6 | Backdrop click closes popover | Click backdrop scrim, assert closed |
| 7 | Expand navigates to /ai | Click `title="Expand to full page"`, assert URL is `/ai` |
| 8 | Cmd+J toggles popover | Press shortcut, assert open; press again, assert closed |

### 2. Full-Page Chat (`fullscreen.spec.ts`) — No LLM

| # | Test | Notes |
|---|------|-------|
| 1 | /ai renders full-page chat | Navigate, check header + input visible |
| 2 | FAB hidden on /ai route | Navigate to `/ai`, assert FAB not visible |
| 3 | Sidebar "AI Chat" link navigates to /ai | Click nav item, assert URL |
| 4 | Empty state shows on fresh chat | "How can I help?" visible |
| 5 | New chat button visible in header | Assert `title="New chat"` button in header |

### 3. Messaging (`messaging.spec.ts`) — LLM, 30s+ timeout

| # | Test | Notes |
|---|------|-------|
| 1 | Send message and receive response | Type, send, wait for AI prose response. Assert user bubble + AI response both visible |
| 2 | User message appears immediately | After send, user bubble visible before AI responds |
| 3 | Input clears and disables during generation | After send, textarea empty + disabled, placeholder changes to "Generating response..." |
| 4 | Stop button visible during generation | While streaming, assert `title="Stop generating"` visible |
| 5 | Error state on server failure | Mock 500 on `/api/chat` via `page.route()`, send message, assert error message visible |
| 6 | Multiple messages in sequence | Send, wait for response, send again, assert both exchanges visible |

### 4. Session Management (`sessions.spec.ts`) — LLM, 30s+ timeout

| # | Test | Notes |
|---|------|-------|
| 1 | Session persists after reload | Send message, reload, open switcher — session appears |
| 2 | Session title derived from first message | Assert switcher shows truncated first user message |
| 3 | Can switch between sessions | Create 2 sessions, switch via switcher, verify messages change |
| 4 | Can delete a session | Create session, delete via switcher, assert removed |
| 5 | Deleting active session starts new chat | Delete current, assert "How can I help?" + title "New chat" |
| 6 | Expand from popover preserves session | Send in popover, expand, assert `/ai/$sessionId` URL + same messages |
| 7 | Empty switcher shows "No conversations yet" | Fresh user, open switcher, assert empty text |

### 5. Tool Calling (`tool-calling.spec.ts`) — LLM + seeded data, 30s+ timeout

**Setup:** Extend auth fixture with seeded feeds (mock server) and tags.

| # | Test | Notes |
|---|------|-------|
| 1 | Ask about feeds | "What feeds do I follow?" — response mentions seeded feed title, tool indicator appears |
| 2 | Ask about articles | "Show my latest articles" — response mentions article titles |
| 3 | Write action: follow a feed | "Follow http://localhost:9999/news-feed.xml" — assert success response |

---

## Covered by Storybook (not E2E)

These are component-level concerns already tested via Storybook stories in `apps/web/src/components/chat/*.stories.tsx`:

- **Input behavior:** Enter sends, Shift+Enter newline, empty/whitespace blocked, auto-resize
- **Message rendering:** Markdown formatting, tool call indicators (spinner → checkmark), error message formatting, empty response warning
- **Visual states:** Loading placeholder, disabled input opacity, streaming class
- **Accessibility attributes:** ARIA roles, button titles, placeholder text
- **Component isolation:** AiFab tooltip, AiPopover transitions, ConversationSwitcher grouping/empty state, ChatTitleSwitcher sizes

---

## Test Data Seeding

For tool-calling tests:

1. **Auth fixture** — existing: fresh user via sign-up + sign-in
2. **Feed seeding** — after auth, follow `http://localhost:9999/tech-blog.xml` via server function
3. **Tag seeding** — create tag via server function / `page.evaluate()`
4. **Wait for sync** — poll for Electric SQL collection to populate

Shared `ai-chat-fixture.ts` extending auth fixture with seeded data.

---

## Open Questions

1. **Session persistence timing** — server persists via `ctx.defer()`. After sending a message, Electric sync delay means the session may not appear in the switcher immediately. May need polling.
2. **Visual regression** — defer `toHaveScreenshot()` until UI stabilizes.
3. **Parallel execution** — LLM tests are slow. Run serial to avoid rate limits, or parallel for speed?
