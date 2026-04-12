# AI Chat

AI assistant integrated into OpenFeeds. Uses TanStack AI with Anthropic (Claude Sonnet) for streaming chat with tool calling. Conversations are persisted server-side and synced to clients via Electric SQL.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (SolidJS)                     │
│  ChatProvider → ChatClient              │
│  Popover / Full-page / FAB              │
│  Electric SQL ← chat_sessions sync      │
└──────────────┬──────────────────────────┘
               │ SSE stream (POST /api/chat)
               │ body: { messages, sessionId, context }
               ▼
┌─────────────────────────────────────────┐
│  /api/chat route handler                │
│  Auth: Better Auth session cookie       │
│  chat() + anthropicText() adapter       │
│  Middleware: persistence + analytics     │
│  Tools: 10 server-side tool definitions │
└──────────────┬──────────────────────────┘
               │ tool execute() calls
               ▼
┌─────────────────────────────────────────┐
│  @repo/domain + @repo/db                │
│  Write tools → withTransaction()        │
│  Read tools → direct Drizzle queries    │
└──────────────┬──────────────────────────┘
               ▼
         PostgreSQL
```

## Packages

- `@tanstack/ai` — core chat engine, SSE streaming, tool definitions
- `@tanstack/ai-solid` — SolidJS SSE client (`fetchServerSentEvents`)
- `@tanstack/ai-anthropic` — Anthropic adapter (`anthropicText`)
- `@tanstack/ai-client` — `ChatClient` class (used directly for session control)

## API Endpoint

**`POST /api/chat`** — `apps/web/src/routes/api/chat.ts`

SSE streaming endpoint. Uses TanStack Start file route with raw request/response handlers (not `createServerFn`) because TanStack AI needs SSE control.

**Request body:**

| Field | Type | Description |
|---|---|---|
| `messages` | `ModelMessage[]` | Conversation history |
| `sessionId` | `string` | UUID for the conversation session |
| `context` | `object?` | Current page context (feed, article, route) |

**Auth:** `authRequestMiddleware` — reads Better Auth session from request headers. Returns 401 if unauthenticated.

**Env guard:** Returns 503 if `ANTHROPIC_API_KEY` is not configured.

**Model:** `anthropicText('claude-sonnet-4-5')`, max 4096 tokens.

**Context injection:** The base system prompt is extended with per-request page context (which feed/article the user is currently viewing). This lets the AI understand "this feed" or "this article" references.

**Middleware pipeline:** Two `ChatMiddleware` instances are attached to every `chat()` call:

1. **Persistence middleware** (`ai-persistence.server.ts`) — saves conversation on finish/error/abort
2. **Analytics middleware** (`ai-analytics.server.ts`) — captures PostHog `$ai_generation` events

Both use `ctx.defer()` so they never block the SSE stream.

## Server-Side Persistence

**File:** `apps/web/src/server/ai-persistence.server.ts`

Messages are saved to the database **on the server**, not the client. The persistence middleware hooks into three lifecycle events:

- `onFinish` — normal completion, saves full message array
- `onError` — saves partial conversation (what was received before the error)
- `onAbort` — saves partial conversation (user cancelled)

Saves via `withTransaction` → `saveChatSession(ctx, { id, title, messages })`. Title is derived from the first user message (truncated to 80 chars).

The server is the **single source of truth**. The client sees persisted sessions only after Electric SQL syncs the change back.

## Analytics

**File:** `apps/web/src/server/ai-analytics.server.ts`

Captures PostHog `$ai_generation` events with:

- Model, provider, latency
- Input/output message counts, token usage (prompt + completion)
- Tool calls: name, duration, success/failure
- Finish reason, errors

Collected via `onAfterToolCall` (per-tool metrics) and fired on `onFinish` or `onError`.

## Tools

**File:** `apps/web/src/server/ai-tools.server.ts`

`createTools(userId, plan)` — factory returning tools scoped to the authenticated user. Each tool uses `toolDefinition().server()` from `@tanstack/ai` with Zod input schemas.

### Write Tools (use `withTransaction`)

| Tool | Purpose | Domain function |
|---|---|---|
| `follow_feeds` | Subscribe to feeds, optionally with tags | `followFeedsWithTags` |
| `unfollow_feeds` | Unsubscribe (requires confirmation) | `deleteFeeds` |
| `update_articles` | Mark read/unread, archive/unarchive | `updateArticles` |
| `manage_tags` | Create, rename, delete tags | `createTags`, `updateTags`, `deleteTags` |
| `manage_feed_tags` | Assign/remove tags on feeds | `createFeedTags`, `deleteFeedTags` |

### Read Tools (direct Drizzle queries)

| Tool | Purpose | Notes |
|---|---|---|
| `discover_feeds` | Find RSS/Atom feeds at a URL | Uses `discoverRssFeeds` from `@repo/domain` |
| `list_feeds` | Query user's feeds | Optional search filter |
| `list_articles` | Query articles with filtering + pagination | Selective `fields` param, HTML stripping, description truncation |
| `list_tags` | List all user tags | — |
| `get_usage` | Check plan limits and usage | Uses `getUserUsage` |

`list_articles` is the most sophisticated — it accepts a `fields` parameter so the AI can request only needed columns, strips HTML from descriptions, and truncates based on batch size to manage token usage.

## System Prompt

**File:** `apps/web/src/server/ai-system-prompt.server.ts`

`getSystemPrompt()` returns a dynamic string (injects today's date). Key directives:

- Identity and capabilities overview
- Context awareness: use per-message page context to resolve "this feed" / "this article"
- Data guidance: use `fields` parameter on `list_articles`, max 2 pagination rounds, prefer date ranges
- Response style: concise, markdown, brief confirmations after tool calls
- Links: in-app routes only (`/feeds/:id`, `/articles/:id`, etc.), never external URLs
- Scope: OpenFeeds assistant only — decline unrelated questions (exception: questions about the article being viewed)
- Safety: confirm destructive actions, never fabricate URLs

## Database

### Schema

**Table:** `chat_sessions` — `packages/db/src/schema/schema.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, UUIDv7 default |
| `user_id` | `text` | FK → `user.id`, ON DELETE CASCADE, indexed |
| `title` | `text` | Not null |
| `messages` | `jsonb` | Full `ModelMessage[]` array, default `[]` |
| `created_at` | `timestamp` | Default now |
| `updated_at` | `timestamp` | Auto-updated via `$onUpdate` |

Messages are stored as a single JSONB blob per session — no separate messages table. This simplifies sync and avoids per-message row overhead.

### Domain Layer

**File:** `packages/domain/src/entities/chat-session.ts`

- `saveChatSession(ctx, data)` — upsert (INSERT ... ON CONFLICT DO UPDATE)
- `deleteChatSession(ctx, id)` — delete, user-scoped

**File:** `packages/domain/src/entities/chat-session.schema.ts`

Client-safe schemas (exported from `@repo/domain/client`):

- `ChatSessionSchema` — full session with messages
- `ChatSessionSummarySchema` — session without messages (for listing)
- `SaveChatSessionSchema` — upsert input
- `StoredMessage` — `z.record(z.string(), z.unknown())` (loose typing, avoids coupling to `@tanstack/ai` wire format)

### Electric SQL Collection

**File:** `apps/web/src/entities/chat-sessions.ts`

`chatSessionsCollection` — Electric collection with:

- Shape: `/api/shapes/chat-sessions` (auth-protected, filtered by `user_id`)
- Custom JSONB parser (Electric sends JSONB as raw strings)
- `snakeCamelMapper()` for column names
- `onDelete` → calls `$$deleteChatSession` server function
- No `onInsert`/`onUpdate` — persistence is server-side; Electric syncs back automatically

### Server Functions

**File:** `apps/web/src/entities/chat-sessions.functions.ts`

- `$$saveChatSession` — upsert via `createServerFn` (used by client for explicit saves if needed)
- `$$deleteChatSession` — delete via `createServerFn` (called by collection's `onDelete`)

## Frontend

### Component Structure

```
apps/web/src/components/chat/
  chat-context.tsx         # ChatProvider — central state, ChatClient, session management
  ChatPage.tsx             # Full-page view at /ai and /ai/$sessionId
  ChatMessages.tsx         # Message rendering (markdown, tool calls, errors)
  ChatInput.tsx            # Auto-resizing textarea, send/stop buttons
  AiFab.tsx                # Floating action button (bottom-right)
  AiPopover.tsx            # Desktop popover panel (fixed, 28rem × 65vh)
  ChatTitleSwitcher.tsx    # Dropdown trigger showing current chat title
  ConversationSwitcher.tsx # Session list grouped by time period
  chat-utils.ts            # deriveTitle, storedToUi, groupByTimePeriod
```

### ChatProvider

**File:** `apps/web/src/components/chat/chat-context.tsx`

Wraps the entire `_frame` layout (single instance). Uses `ChatClient` directly (not `useChat`) to support per-message `sessionId` body overrides for session switching.

**Key state:**

- `viewSessionId` — which session the UI displays
- `streamSessionId` — which session owns the active SSE stream
- Allows viewing a past session while a stream runs in the background

**Message display logic:**

- If viewing the streaming session → live `streamMessages` from ChatClient
- If viewing a different session → `viewedMessages` from Electric SQL sync (`useLiveQuery`)

**Key methods:**

- `sendMessage(text)` — restores history into ChatClient buffer if switching sessions, sends with `sessionId` body override
- `stop()` — abort the current stream
- `loadSession(id)` — switch view, reactive query populates messages from Electric
- `deleteSession(id)` — optimistic delete via collection, starts new chat if deleting current
- `startNewChat()` — new UUID, clear messages, reset stream buffer if idle

### Surfaces

**Popover** (`AiPopover.tsx`) — desktop floating panel, bottom-right. Backdrop scrim, title bar with conversation switcher + expand/close controls. CSS transitions.

**Full page** (`ChatPage.tsx`) — at `/ai` and `/ai/$sessionId`. Centered column, syncs URL ↔ session ID bidirectionally. Header with conversation switcher + new chat button.

**FAB** (`AiFab.tsx`) — fixed bottom-right button. Mobile: navigates to `/ai`. Desktop: opens popover. Shows keyboard shortcut tooltip.

### Message Rendering

- **User messages:** right-aligned primary-colored bubbles
- **AI messages:** full-width prose (no bubble), markdown via `solid-markdown` + `remark-gfm` + `remark-breaks`
- **Tool calls:** inline indicators — spinner while running, checkmark when done, human-readable name
- **Errors:** parses Anthropic error JSON, friendly messages for 429/413/5xx
- **Empty responses:** detects empty assistant messages, suggests rephrasing

### Routes

- `/_frame/ai` → `ChatPage` (auth-guarded via `_frame` layout)
- `/_frame/ai_/$sessionId` → `ChatPage` with specific session

### Frame Integration

**File:** `apps/web/src/routes/_frame.tsx`

- `<ChatProvider>` wraps all frame children
- Keyboard shortcut: `Cmd+J` / `Ctrl+J` toggles popover (desktop) or navigates to `/ai` (mobile)
- `<AiFab>` visible when popover is closed and not on `/ai` route
- `<AiPopover>` always rendered (visibility toggled)
- Sidebar nav includes "AI Chat" link with sparkles icon

## Data Flow

### Sending a Message

1. User types in `ChatInput` → `sendMessage(text)` on context
2. `ChatProvider` restores history into ChatClient buffer if needed, sets `streamSessionId`
3. `ChatClient` POSTs to `/api/chat` with `{ messages, sessionId, context }`
4. Server authenticates via Better Auth session cookie
5. Server builds context-aware system prompt (base + page context)
6. `chat()` streams via `anthropicText('claude-sonnet-4-5')` with tools + middlewares
7. Tool calls execute against `@repo/domain` / `@repo/db`
8. SSE events stream back → `ChatClient.onMessagesChange` → `streamMessages` signal → UI re-renders
9. On finish/error/abort: persistence middleware saves full `ModelMessage[]` to `chat_sessions` (deferred)
10. Analytics middleware captures PostHog event (deferred)
11. Electric SQL detects DB change → syncs updated `chat_sessions` row to client
12. If viewing a different session, `useLiveQuery` updates `viewedMessages` reactively

### Loading a Past Session

1. User clicks session in `ConversationSwitcher` → `loadSession(id)`
2. `viewSessionId` updates → `useLiveQuery` re-filters for new session
3. Electric collection already has the data → `viewedMessages` populates
4. `messages()` memo returns `viewedMessages` (since view !== stream session)

### Deleting a Session

1. `deleteSession(id)` → `chatSessionsCollection.delete(id)` (optimistic)
2. Collection `onDelete` → `$$deleteChatSession` server function → `domain.deleteChatSession`
3. Electric syncs deletion to all connected clients

## MCP vs AI Chat

The project has a separate MCP endpoint at `/api/mcp/` for external clients. AI chat is an **internal** feature:

| | MCP endpoint | AI chat |
|---|---|---|
| Consumer | External MCP clients | Built-in chat UI |
| Auth | OAuth 2.1 JWT | Session cookie |
| Protocol | MCP SDK (JSON-RPC) | TanStack AI (SSE) |
| Tools | MCP `registerTool()` | TanStack AI `toolDefinition()` |

## Future Ideas

### Right Panel Layout

Side-by-side layout where AI panel sits to the right of the main content. Similar to Google Docs Gemini panel.

**When it could work:** Content area is narrow by design, so a right panel wouldn't steal too much space. Good for "ask about this article" contextual queries.

**When it doesn't work:** On narrower viewports (<~1200px), panel compresses main content too much.

**Trigger:** AI icon in top-right of app header. Toggles panel open/closed.

**Decision:** Ship both popover and right-panel behind a setting or test both. They share the same chat component — the difference is only the container.

**Implementation:**

- [ ] AI icon in app header/toolbar
- [ ] Resizable right panel container
- [ ] Panel toggle state (persisted in local storage)
- [ ] Responsive: auto-collapse below breakpoint
- [ ] Article context injection — "ask about this article" prefills context

### Smart UI Widgets

Interactive cards rendered by AI inside the chat — e.g., a feed subscription card with a "Subscribe" button, an article list with inline actions. Instead of the AI returning plain text describing feeds, it renders actionable UI.

### Reference System

`@mention` articles, feeds, tags in prompts. Autocomplete dropdown when typing `@`. Mentioned entities get injected into the message context for the AI.

### Contextual Awareness Improvements

AI knows what page/article the user is currently viewing (basic version exists via `context` field). Future: deeper awareness — selected text, scroll position, currently visible articles, recent navigation history.

### Code Mode for Digest Queries

For prompts like "give me a digest of the last month", the current approach dumps article data into context, causing token overflow. TanStack AI's [Code Mode](https://tanstack.com/blog/tanstack-ai-code-mode) could solve this: the model writes TypeScript that runs in a sandbox — fetching only relevant fields, filtering by date, aggregating in JS. Only the final result enters the context window.

**Fits OpenFeeds well for:**

- Digest/summary queries over large date ranges
- Feed analytics (article counts, read ratios, most active feeds)
- "What topics did I read most?" — parallel fetches + `.reduce()` in sandbox
- Skills: digest logic persists as reusable programs

**Blocked on:** `@tanstack/ai` is still alpha. Revisit when stable.

### Voice Input

Mobile voice input for sending messages. Useful on the full-page `/ai` view.

### Streaming Markdown Rendering

Progressive markdown rendering during streaming (render partial markdown as it arrives, not after complete). Current implementation renders complete messages with `solid-markdown`.

### Message Feedback

Thumbs up/down on AI responses. Could inform prompt tuning or model selection.

### Design References

- **Linear:** Popover with minimize/expand/close, conversation tabs
- **Notion:** FAB trigger, conversation switcher grouped by time
- **Google Docs:** Right-panel Gemini, full-width AI response, header icon trigger
- **PostHog:** Top-right AI icon triggering side panel
