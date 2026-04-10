# AI Chat v2: Master Plan

Supersedes [ai-chat.md](./ai-chat.md) (v1 was the proof-of-concept). This doc covers the full AI UX strategy: surfaces, interaction patterns, layout modes, message rendering, and future capabilities.

## Design Principles

1. **Two surfaces** — popover (quick/lightweight) and full-page (deep/focused)
2. **Steal the best** — Linear's popover chrome, Notion's conversation switcher, Google's right-panel layout
3. **Mobile-first degradation** — popover is hard on small screens; redirect to full-page on mobile
4. **AI responses are content, not chat bubbles** — user messages get bubbles, AI renders full-width prose

## UI Surfaces

### 1. Popover (Desktop)

Floating panel anchored to bottom-right, similar to Linear's AI chat.

**Chrome controls (top bar):**

| Button | Behavior | Inspiration |
|---|---|---|
| Title dropdown | Switch between conversations (Notion-style — click title, shows grouped list: Today / Previous 7 days / Older) | Notion |
| Minimize (`-`) | Collapse to FAB | Linear |
| Expand (`arrows-expand`) | Open full-page view | Linear |
| Close (`x`) | Close chat entirely | Linear |
| New chat (`+`) | Start fresh conversation | Both |

**Sizing:** ~400-480px wide, ~60-70vh tall. Draggable resize is out of scope for now.

**Opening trigger:** FAB button in bottom-right corner (Notion-style). Single AI icon, no mini-tabs (Linear's tab bar adds complexity without clear value for our use case).

### 2. Right Panel (Desktop — experimental)

Side-by-side layout where AI panel sits to the right of the main content. Similar to Google Docs Gemini panel.

**When it could work:** OpenFeeds content area is narrow by design, so a right panel wouldn't steal too much space. Good for "ask about this article" contextual queries.

**When it doesn't work:** On narrower viewports (< ~1200px), panel would compress the main content too much.

**Trigger:** AI icon button in top-right of the app header / toolbar (Google Docs / PostHog pattern). Toggles the right panel open/closed.

**Decision:** Ship both popover and right-panel behind a setting or just test both. Iterate based on feedback. They share the same chat component internally — the difference is only the container.

### 3. Full-Page (`/ai` route)

Dedicated page, maximum space. Centered content column with conversation.

**When used:**
- Mobile (always — FAB tap redirects here instead of opening popover)
- Desktop when user clicks "expand" from popover/panel
- Direct navigation

**Layout:** Single centered column, max-width ~720px. Input pinned to bottom. Conversation list in sidebar or dropdown.

### 4. Mobile

- **Trigger:** FAB in bottom-right (same as desktop, Notion-style)
- **Tap behavior:** Navigate to `/ai` full-page route (no popover)
- **FAB visibility:** Hide when keyboard is open or when already on `/ai` page

## Conversation Management

### Switching Conversations (Notion pattern)

The popover/panel title bar shows the current conversation title (auto-generated from first message). Clicking it opens a dropdown:

```
[Today]
  "Request for topic clarification"  ✓
─────────────────────────────────────
[Previous 7 days]
  "Summarize and add topic"          →
  "Referencing AIs in comments"      →
  "Notion workspace summary"         →
─────────────────────────────────────
[Older]
  ...
```

- Current conversation has a checkmark
- Clicking another loads it in-place
- Grouped by time period (Today / Previous 7 days / Older)
- Requires conversation persistence (see Backend section)

### Conversation Persistence

v1 was ephemeral (in-memory via `useChat`). v2 needs server-side persistence:

- New entities: `ai_conversations` and `ai_messages` tables
- Sync via Electric SQL so conversation list is available offline/fast
- Each conversation has: `id`, `user_id`, `title` (auto-generated), `created_at`, `updated_at`
- Messages stored with role, parts (text + tool calls), timestamps

## Message Rendering

### User Messages

- Right-aligned bubble (like current v1)
- Background color to distinguish from AI
- Standard chat bubble appearance

### AI Messages

- **No bubble.** Full-width, left-aligned prose content
- Rendered with `@tailwindcss/typography` (`prose` class)
- Markdown support (headings, lists, code blocks, bold/italic, links)
- Tool call indicators inline (spinner while running, success badge when done)
- Action buttons below each AI message: copy, thumbs up/down (feedback — future)

### Tool Call Display

Same as v1 — inline indicators showing tool name + state (running/done). But rendered inside the full-width AI message block, not inside a bubble.

## Entry Points Summary

| Surface | Trigger | Desktop | Mobile |
|---|---|---|---|
| FAB | Bottom-right floating button | Opens popover | Navigates to `/ai` |
| Header icon | Top-right AI icon in app bar | Toggles right panel | Navigates to `/ai` |
| Full page | Direct nav or expand button | `/ai` route | `/ai` route |
| Keyboard shortcut | `Cmd+J` or similar | Opens popover | N/A |

## Layout Modes Comparison

| | Popover | Right Panel | Full Page |
|---|---|---|---|
| Position | Floating, bottom-right | Docked right side | Standalone route |
| Content compression | None (overlays) | Yes (shrinks main) | None |
| Context awareness | Limited | Can see main content | None |
| Mobile | No | No | Yes |
| Resize | Fixed size | Adjustable split | Full viewport |
| Inspiration | Linear, Notion | Google Docs, PostHog | Standard |

## Phased Implementation

### Phase 1: Core Refactor

- [ ] Persist conversations + messages (new entities)
- [ ] Extract shared `<AiChatMessages>` component (used by all surfaces)
- [ ] Extract shared `<AiChatInput>` component
- [ ] Switch AI message rendering from bubble to full-width prose
- [ ] Keep user messages as right-aligned bubbles

### Phase 2: Popover

- [ ] FAB button component (bottom-right, Notion-style)
- [ ] Popover container with title bar (title dropdown, minimize, expand, close, new chat)
- [ ] Conversation switcher dropdown (Notion pattern)
- [ ] Mobile: FAB navigates to `/ai` instead of opening popover
- [ ] Keyboard shortcut to toggle

### Phase 3: Full Page

- [ ] `/ai` route with centered layout
- [ ] Conversation sidebar or dropdown
- [ ] Expand from popover navigates here

### Phase 4: Right Panel (Experimental)

- [ ] AI icon in app header/toolbar
- [ ] Resizable right panel container
- [ ] Panel toggle state (open/closed, persisted in local storage)
- [ ] Responsive: auto-collapse panel below breakpoint
- [ ] Article context injection — "ask about this article" prefills context

### Phase 5: Polish & Future

- [ ] Smart UI widgets (interactive cards rendered by AI — e.g., feed subscription card, article list card)
- [ ] Reference system — `@mention` articles, feeds, tags in prompts
- [ ] Contextual awareness — AI knows what page/article user is currently viewing
- [ ] Voice input (mobile)
- [ ] Streaming markdown rendering (progressive, not after-complete)

## Open Design Decisions

1. **Popover vs. right panel as default** — Ship both, test over time, gather feedback. Popover is the safer default (doesn't affect layout). Right panel is better for contextual use.

2. **FAB vs. header icon** — Could have both: FAB opens popover, header icon opens right panel. Or unify to a single trigger that opens the user's preferred surface.

3. **Conversation title generation** — Auto-generate from first user message (truncated)? Or ask the AI to generate a title after the first exchange?

4. **Right panel width** — Fixed 400px? Resizable? Percentage-based?

5. **Panel state persistence** — Remember last-used surface (popover vs. panel) and last conversation across sessions.

## Backend Changes from v1

- Conversation persistence entities (see new-entity skill)
- Rate limiting per user (enforce in route handler)
- Plan gating (pro-only? or limited free-tier messages?)
- Title auto-generation (after first AI response, ask model for a short title)
- Read tools for AI context (list feeds, search articles — domain functions needed)

## References

- **Linear:** Popover with minimize/expand/close, bottom-bar AI tabs for conversation history
- **Notion:** FAB trigger, conversation switcher dropdown grouped by time, popover with title bar
- **Google Docs:** Right-panel Gemini, user bubble + full-width AI response, header icon trigger
- **PostHog:** Top-right AI icon triggering side panel
