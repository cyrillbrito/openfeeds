import { Bot, History, Plus, X } from 'lucide-solid';
import { createEffect, on, onCleanup, Show } from 'solid-js';
import { ChatProvider, useChatContext } from './chat-context';
import { ChatHistory } from './ChatHistory';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDrawer(props: ChatDrawerProps) {
  return (
    <ChatProvider>
      <ChatDrawerInner open={props.open} onClose={props.onClose} />
    </ChatProvider>
  );
}

function ChatDrawerInner(props: ChatDrawerProps) {
  const chat = useChatContext();

  // Refetch sessions when panel opens
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          chat.refetchSessions();
        }
      },
    ),
  );

  // Handle Escape to close
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      if (chat.showHistory()) {
        chat.setShowHistory(false);
      } else {
        props.onClose();
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  }

  return (
    <div
      class="bg-base-100 border-base-300 fixed top-0 right-0 z-20 flex h-dvh w-full flex-col border-l shadow-lg transition-transform duration-200 sm:w-[26rem]"
      classList={{
        'translate-x-0': props.open,
        'translate-x-full': !props.open,
      }}
      // biome-ignore lint/a11y/useSemanticElements: chat panel is not a dialog
      role="complementary"
      aria-label="AI Chat"
    >
      {/* Header */}
      <div class="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div class="flex items-center gap-2">
          <Bot size={18} class="text-primary" />
          <span class="text-sm font-semibold">AI Assistant</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-ghost btn-sm btn-circle"
            onClick={() => chat.startNewChat()}
            title="New chat"
          >
            <Plus size={16} />
          </button>
          <button
            class="btn btn-ghost btn-sm btn-circle"
            classList={{ 'btn-active': chat.showHistory() }}
            onClick={() => chat.setShowHistory(!chat.showHistory())}
            title="Chat history"
          >
            <History size={16} />
          </button>
          <button
            class="btn btn-ghost btn-sm btn-circle"
            onClick={() => props.onClose()}
            title="Close chat (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Session history overlay */}
      <Show when={chat.showHistory()}>
        <ChatHistory />
      </Show>

      {/* Messages */}
      <Show when={!chat.showHistory()}>
        <ChatMessages />
      </Show>

      {/* Input */}
      <Show when={!chat.showHistory()}>
        <ChatInput />
      </Show>
    </div>
  );
}
