import { useLocation, useNavigate, useParams } from '@tanstack/solid-router';
import { Menu, Plus } from 'lucide-solid';
import { createEffect, on, Show } from 'solid-js';
import { useChatContext } from './chat-context.shared';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatTitleSwitcher } from './ChatTitleSwitcher';

/** Full-page AI chat — centered column with max-width */
export function ChatPage() {
  const chat = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });

  const sessionIdParam = () => (params() as { sessionId?: string }).sessionId;

  // Load session from URL param on mount / when param changes
  createEffect(
    on(sessionIdParam, (sessionId) => {
      if (sessionId && sessionId !== chat.sessionId()) {
        chat.loadSession(sessionId);
      } else if (!sessionId && chat.messages().length > 0) {
        // Navigated to /ai without a session ID — start fresh
        chat.startNewChat();
      }
    }),
  );

  // Update URL when session has messages but URL has no session ID
  createEffect(
    on(
      () => [chat.sessionId(), chat.messages().length] as const,
      ([sessionId, msgCount]) => {
        if (
          msgCount > 0 &&
          sessionId !== sessionIdParam() &&
          location().pathname.startsWith('/ai')
        ) {
          void navigate({ to: '/ai/$sessionId', params: { sessionId }, replace: true });
        }
      },
    ),
  );

  // Sessions are synced automatically via Electric

  const handleNewChat = () => {
    chat.startNewChat();
    void navigate({ to: '/ai', replace: true });
  };

  return (
    <div class="flex h-dvh flex-col" data-testid="chat-page">
      {/* Header */}
      <header class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow">
        <div class="content-container flex items-center justify-between py-3">
          <div class="flex items-center gap-3">
            <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
              <Menu size={24} />
            </label>

            <ChatTitleSwitcher
              onSessionSelected={(id) => {
                void navigate({
                  to: '/ai/$sessionId',
                  params: { sessionId: id },
                  replace: true,
                });
              }}
            />
          </div>

          <Show when={chat.messages().length > 0}>
            <button
              class="btn btn-ghost btn-sm btn-circle"
              onClick={handleNewChat}
              title="New chat"
            >
              <Plus size={18} />
            </button>
          </Show>
        </div>
      </header>

      {/* Chat area */}
      <div class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <ChatMessages />
        <ChatInput autoFocus />
      </div>
    </div>
  );
}
