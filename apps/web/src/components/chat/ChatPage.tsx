import { useLocation, useNavigate, useParams } from '@tanstack/solid-router';
import { ChevronDown, Menu, Plus, Sparkles } from 'lucide-solid';
import { createEffect, createSignal, on, Show } from 'solid-js';
import { useClickOutside } from '~/utils/useClickOutside';
import { useChatContext } from './chat-context';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ConversationSwitcher } from './ConversationSwitcher';

/** Full-page AI chat — centered column with max-width */
export function ChatPage() {
  const chat = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
  const [switcherOpen, setSwitcherOpen] = createSignal(false);
  const [switcherRef, setSwitcherRef] = createSignal<HTMLDivElement>();

  useClickOutside(switcherRef, () => {
    if (switcherOpen()) setSwitcherOpen(false);
  });

  const sessionIdParam = () => (params() as { sessionId?: string }).sessionId;

  // Load session from URL param on mount / when param changes
  createEffect(
    on(sessionIdParam, (sessionId) => {
      if (sessionId && sessionId !== chat.sessionId()) {
        void chat.loadSession(sessionId);
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

  // Refetch sessions when page mounts
  chat.refetchSessions();

  const handleNewChat = () => {
    chat.startNewChat();
    void navigate({ to: '/ai', replace: true });
  };

  return (
    <div class="flex h-dvh flex-col">
      {/* Header */}
      <header class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow">
        <div class="content-container flex items-center justify-between py-3">
          <div class="flex items-center gap-3">
            <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
              <Menu size={24} />
            </label>

            {/* Conversation switcher */}
            <div ref={setSwitcherRef} class="relative">
              <button
                class="hover:bg-base-200 flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
                onClick={() => setSwitcherOpen(!switcherOpen())}
                title="Switch conversation"
              >
                <Sparkles size={16} class="text-primary shrink-0" />
                <span class="max-w-64 truncate text-lg font-semibold">{chat.currentTitle()}</span>
                <ChevronDown
                  size={16}
                  class="text-base-content/50 shrink-0 transition-transform"
                  classList={{ 'rotate-180': switcherOpen() }}
                />
              </button>

              <Show when={switcherOpen()}>
                <ConversationSwitcher
                  onClose={() => setSwitcherOpen(false)}
                  onSessionSelected={(id) => {
                    void navigate({
                      to: '/ai/$sessionId',
                      params: { sessionId: id },
                      replace: true,
                    });
                  }}
                />
              </Show>
            </div>
          </div>

          <button class="btn btn-ghost btn-sm btn-circle" onClick={handleNewChat} title="New chat">
            <Plus size={18} />
          </button>
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
