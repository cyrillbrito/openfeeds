# AI Chat: TanStack AI Integration Plan

## Overview

Add an AI assistant to OpenFeeds that can perform actions on behalf of the user — subscribe to feeds, organize tags, mark articles, etc. Uses **TanStack AI** (`@tanstack/ai`) with the **Anthropic adapter** and the SolidJS-specific `@tanstack/ai-solid` package.

TanStack AI is headless (no pre-built UI). We build the chat interface ourselves using DaisyUI's [`chat` component](https://daisyui.com/components/chat/) classes.

## Architecture

```
┌─────────────────────────────────────┐
│  AiChat component (SolidJS)         │
│  useChat() hook from @tanstack/ai-solid │
│  DaisyUI chat bubbles + input       │
└──────────────┬──────────────────────┘
               │ SSE stream (POST /api/ai/chat)
               ▼
┌─────────────────────────────────────┐
│  /api/ai/chat route handler         │
│  TanStack Start file route          │
│  auth via authMiddleware pattern     │
│  chat() + anthropicText() adapter   │
│  tools = server tool definitions    │
└──────────────┬──────────────────────┘
               │ tool execute() calls
               ▼
┌─────────────────────────────────────┐
│  @repo/domain functions (existing)  │
│  withTransaction / createDomainContext │
│  No changes needed                  │
└──────────────┬──────────────────────┘
               ▼
         PostgreSQL / BullMQ
```

## Packages to Install

```bash
bun add @tanstack/ai @tanstack/ai-solid @tanstack/ai-anthropic
```

## New Files

```
apps/web/src/
  routes/api/ai/chat.ts          # SSE endpoint (TanStack Start route)
  ai/
    tools.ts                      # Tool definitions (wires to @repo/domain)
    system-prompt.ts              # System prompt with app context
  components/AiChat.tsx           # Chat panel UI (DaisyUI chat bubbles)
```

Estimated: **~200-350 lines of new code**, near-zero changes to existing code.

## Server: API Route

`apps/web/src/routes/api/ai/chat.ts`

```ts
import { chat, toServerSentEventsResponse } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { createFileRoute } from '@tanstack/solid-router';
import { tools } from '~/ai/tools';
import { SYSTEM_PROMPT } from '~/ai/system-prompt';

export const Route = createFileRoute('/api/ai/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic import for server-only deps (import-protection)
        const { auth } = await import('~/server/auth.server');
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        const { messages } = await request.json();

        // Build tools bound to this user's context
        const userTools = tools(session.user.id, session.user.plan ?? 'free');

        return toServerSentEventsResponse(
          chat({
            adapter: anthropicText(),
            model: 'claude-sonnet-4-20250514',
            systemPrompts: [SYSTEM_PROMPT],
            messages,
            tools: userTools,
          }),
        );
      },
    },
  },
});
```

> **Note:** This uses the API route pattern (not `createServerFn`) because TanStack AI needs raw request/response control for SSE streaming.

## Server: Tool Definitions

`apps/web/src/ai/tools.ts`

Tools are defined with `toolDefinition()` from `@tanstack/ai`. Each tool has a Zod schema for input/output and a `.server()` execute function that calls existing `@repo/domain` functions.

```ts
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

// Factory: returns tools bound to the authenticated user
export function tools(userId: string, plan: string) {
  const discoverFeeds = toolDefinition({
    name: 'discover_feeds',
    description: 'Find RSS/Atom feeds at a given URL. Use when the user wants to subscribe to a website.',
    inputSchema: z.object({ url: z.string().url() }),
    outputSchema: z.object({
      feeds: z.array(z.object({ url: z.string(), title: z.string().optional() })),
    }),
  }).server(async ({ url }) => {
    const { discoverRssFeeds } = await import('@repo/domain');
    const result = await discoverRssFeeds(url);
    return { feeds: result.feeds };
  });

  const followFeed = toolDefinition({
    name: 'follow_feed',
    description: 'Subscribe to an RSS feed. Optionally assign tags. Use after discover_feeds.',
    inputSchema: z.object({
      feedUrl: z.string().url(),
      tagNames: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({ success: z.boolean() }),
  }).server(async ({ feedUrl, tagNames }) => {
    const { followFeedsWithTags } = await import('@repo/domain');
    const { db } = await import('@repo/db');
    const { withTransaction } = await import('@repo/domain');
    await withTransaction(db, userId, plan, async (ctx) => {
      await followFeedsWithTags(ctx, {
        feeds: [{ url: feedUrl }],
        tags: tagNames?.map((name) => ({ name })) ?? [],
      });
    });
    return { success: true };
  });

  const markArticlesRead = toolDefinition({
    name: 'mark_articles_read',
    description: 'Mark articles as read or unread.',
    inputSchema: z.object({
      articleIds: z.array(z.string()),
      isRead: z.boolean(),
    }),
    outputSchema: z.object({ count: z.number() }),
  }).server(async ({ articleIds, isRead }) => {
    const { updateArticles } = await import('@repo/domain');
    const { db } = await import('@repo/db');
    const { withTransaction } = await import('@repo/domain');
    await withTransaction(db, userId, plan, async (ctx) => {
      await updateArticles(ctx, articleIds.map((id) => ({ id, isRead })));
    });
    return { count: articleIds.length };
  });

  // ... more tools

  return [discoverFeeds, followFeed, markArticlesRead];
}
```

### Proposed Initial Tools

| Tool | Domain function | Purpose |
|---|---|---|
| `discover_feeds` | `discoverRssFeeds(url)` | Find feeds at a URL |
| `follow_feed` | `followFeedsWithTags(ctx, data)` | Subscribe + tag |
| `unfollow_feeds` | `deleteFeeds(ctx, ids)` | Unsubscribe |
| `create_tags` | `createTags(ctx, data)` | Create new tags |
| `tag_feeds` | `createFeedTags(ctx, data)` | Assign tags to feeds |
| `mark_articles_read` | `updateArticles(ctx, data)` | Mark read/unread |
| `save_article` | `createArticles(ctx, [{url}])` | Save from URL |
| `get_usage` | `getUserUsage(userId, plan)` | Check plan limits |
| `create_filter_rule` | `createFilterRules(ctx, data)` | Auto-read rules |

## Client: Chat UI

`apps/web/src/components/AiChat.tsx`

DaisyUI has a built-in [`chat` component](https://daisyui.com/components/chat/) with `chat-start`, `chat-end`, `chat-bubble`, `chat-header`, `chat-footer` classes. This covers bubbles, alignment, colors, and avatars — no custom CSS needed for the basic layout.

```tsx
import { createSignal, For, Show } from 'solid-js';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-solid';

export function AiChat() {
  const [input, setInput] = createSignal('');

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents('/api/ai/chat'),
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const text = input().trim();
    if (text && !isLoading()) {
      sendMessage(text);
      setInput('');
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <For each={messages()}>
          {(message) => (
            <div class={`chat ${message.role === 'user' ? 'chat-end' : 'chat-start'}`}>
              <div class="chat-header">{message.role === 'user' ? 'You' : 'AI'}</div>
              <div class={`chat-bubble ${message.role === 'assistant' ? 'chat-bubble-primary' : ''}`}>
                <For each={message.parts}>
                  {(part) => (
                    <Show when={part.type === 'text'}>{part.content}</Show>
                    {/* Tool call states — see section below */}
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
        <Show when={isLoading()}>
          <div class="chat chat-start">
            <div class="chat-bubble chat-bubble-primary">
              <span class="loading loading-dots loading-sm" />
            </div>
          </div>
        </Show>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} class="p-4 border-t border-base-300">
        <div class="flex gap-2">
          <input
            type="text"
            class="input input-bordered flex-1"
            placeholder="Ask me anything..."
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            disabled={isLoading()}
          />
          <button type="submit" class="btn btn-primary" disabled={isLoading()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

### Tool Call Display States

TanStack AI streams tool call lifecycle states. Each tool call part has a `state`:

| State | Meaning | UI suggestion |
|---|---|---|
| `awaiting-input` | LLM started a tool call | Show spinner + tool name |
| `input-streaming` | Arguments streaming in | Show tool name + "preparing..." |
| `input-complete` | Arguments ready, executing | Show tool name + "running..." |
| (has `output`) | Execution finished | Show success/result badge |

```tsx
function ToolCallBubble(props: { part: ToolCallPart }) {
  return (
    <div class="flex items-center gap-2 text-sm opacity-70">
      <Show when={!props.part.output}>
        <span class="loading loading-spinner loading-xs" />
      </Show>
      <Show when={props.part.output}>
        <span class="badge badge-success badge-xs">done</span>
      </Show>
      <span>{props.part.name}</span>
    </div>
  );
}
```

## Where to Place the Chat Panel

Options to decide:

1. **Drawer/sidebar** — slide-in panel from the right (like a support chat). Uses DaisyUI `drawer` component. Non-intrusive.
2. **Modal** — full-screen or large modal. Follows existing `LazyModal` pattern.
3. **Dedicated page** — `/ai` route. Simplest to build but least integrated.
4. **Floating button + popover** — FAB in the corner that expands into a chat panel.

> **Question:** Which approach fits the app's UX best? Option 1 (drawer) feels most natural for an assistant that operates alongside the feed reader.

## System Prompt

`apps/web/src/ai/system-prompt.ts`

The system prompt tells the AI what it can do and gives it context about the app:

```ts
export const SYSTEM_PROMPT = `You are an AI assistant for OpenFeeds, an RSS reader application.
You can help users manage their feeds, articles, and tags.

Available actions:
- Discover and subscribe to RSS feeds from URLs
- Organize feeds with tags
- Mark articles as read/unread
- Save articles from URLs
- Create filter rules to auto-mark articles
- Check usage and plan limits

Guidelines:
- When the user asks to subscribe to a feed, first use discover_feeds, then confirm which feed to follow.
- Be concise — this is a chat panel, not a document.
- If a tool call fails, explain the error clearly and suggest alternatives.
- Never fabricate feed URLs or article content.
`;
```

## Env Changes

`apps/web/src/env.ts` — add:

```ts
ANTHROPIC_API_KEY: z.string().min(1),
```

## Open Questions

### Architecture

- **Auth in the SSE endpoint:** The example above does manual session checking. Should this use a shared auth helper, or is the raw `auth.api.getSession()` pattern fine for API routes?
- **Rate limiting:** AI calls are expensive. Need per-user rate limiting. Where? Middleware in the route? A domain-level check? A separate rate limit service?
- **Plan gating:** Should AI chat be free-tier or pro-only? If pro-only, where to enforce — route-level or show a disabled state in the UI?
- **Conversation persistence:** TanStack AI's `useChat` is ephemeral (in-memory). Should conversations be persisted to the database? If yes, that's a new entity (conversations + messages tables). Could be a v2 feature.
- **Streaming vs. batched tool calls:** TanStack AI supports parallel tool calls (LLM can call multiple tools at once). The tool factory pattern above handles this, but the UI needs to render multiple in-flight tool calls simultaneously.

### Tools & Data Access

- **Read tools need new domain functions.** Currently, lists of feeds/articles/tags are synced to the client via Electric SQL — there are no server-side `listFeeds(userId)` or `searchArticles(userId, query)` functions. For the AI to answer "what feeds am I subscribed to?" or "show me unread articles about AI", we need to either:
  1. Add read/query functions to `@repo/domain` (preferred — keeps domain as single source of truth)
  2. Query `@repo/db` directly in tool execute functions (faster to build, bypasses domain)
  3. Use client-side tools that query TanStack DB collections (avoids server roundtrip but moves logic to client)
- **Tool context pattern:** The factory function `tools(userId, plan)` closes over user info. Is there a cleaner pattern? Could use a middleware-like approach or a context object.
- **Which tools first?** The table above lists 9 tools. For MVP, probably just: `discover_feeds`, `follow_feed`, `mark_articles_read`, `get_usage`. Expand from there.
- **Tool error handling:** Domain functions throw typed errors (see `docs/error-handling.md`). How should these surface in the chat? Catch and return a friendly message? Let TanStack AI handle the error?

### Frontend

- **No pre-built chat UI exists for SolidJS.** We have to build it. DaisyUI `chat` classes cover the bubble layout (alignment, colors, avatars, headers/footers). What we still need to build manually:
  - Scrolling container with auto-scroll to bottom
  - Tool call progress indicators (spinner/badge inline in bubbles)
  - Markdown rendering in assistant messages (we already have `@tailwindcss/typography` — use `prose` class)
  - Keyboard shortcuts (Enter to send, Shift+Enter for newline)
  - Chat panel open/close state
  - Empty state ("Ask me anything about your feeds")
- **Panel placement:** Drawer vs. modal vs. floating? See options above.
- **Mobile:** A drawer sidebar works on desktop but may need full-screen on mobile.

### Cost & Operations

- **Token costs:** Claude Sonnet with tool calling. Each conversation could be 1-5k tokens. At scale, this adds up. Need monitoring.
- **Anthropic API key management:** Single shared key? Per-user keys? (Almost certainly single shared key.)
- **Error states:** What happens when Anthropic is down? Rate limited? Show a toast? Disable the chat?
- **Logging/observability:** Log conversations for debugging? Privacy implications?

### Relationship to Existing MCP Endpoint

The project already has an MCP endpoint at `/api/mcp/` (OAuth 2.1, external clients). The AI chat is a **separate, internal** feature:

| | MCP endpoint | AI chat |
|---|---|---|
| Consumer | External MCP clients | Built-in chat UI |
| Auth | OAuth 2.1 JWT | Session cookie |
| Protocol | MCP SDK (JSON-RPC) | TanStack AI (SSE) |
| Tools | MCP `registerTool()` | TanStack AI `toolDefinition()` |

The tool definitions could share schemas/logic, but the wiring is different. Consider extracting shared tool schemas to `apps/web/src/ai/shared-tools.ts` if both endpoints grow.

## Implementation Order

1. Install packages, add `ANTHROPIC_API_KEY` to env
2. Create `/api/ai/chat` route with 1-2 tools (discover + follow)
3. Build minimal chat component with DaisyUI bubbles
4. Add tool call state display
5. Add more tools incrementally
6. Polish UI (markdown, auto-scroll, keyboard shortcuts)
7. Add rate limiting and plan gating
8. Consider conversation persistence (v2)
