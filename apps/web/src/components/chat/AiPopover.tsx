import { useNavigate } from '@tanstack/solid-router';
import { ChevronDown, Maximize2, Plus, Sparkles, X } from 'lucide-solid';
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import { useClickOutside } from '~/utils/useClickOutside';
import { useChatContext } from './chat-context';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ConversationSwitcher } from './ConversationSwitcher';

interface AiPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function AiPopover(props: AiPopoverProps) {
  const chat = useChatContext();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = createSignal(false);
  const [switcherRef, setSwitcherRef] = createSignal<HTMLDivElement>();

  useClickOutside(switcherRef, () => {
    if (switcherOpen()) setSwitcherOpen(false);
  });

  // Refetch sessions when popover opens
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

  // Handle Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      if (switcherOpen()) {
        setSwitcherOpen(false);
      } else {
        props.onClose();
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  }

  const handleExpand = () => {
    props.onClose();
    const id = chat.sessionId();
    const hasMessages = chat.messages().length > 0;
    if (hasMessages) {
      void navigate({ to: '/ai/$sessionId', params: { sessionId: id } });
    } else {
      void navigate({ to: '/ai' });
    }
  };

  return (
    <>
      {/* Backdrop scrim — click outside to close */}
      <div
        class="fixed inset-0 z-30 bg-black/20 transition-opacity duration-200"
        classList={{
          'opacity-100': props.open,
          'opacity-0 pointer-events-none': !props.open,
        }}
        onClick={() => props.onClose()}
      />

      <div
        class="bg-base-100 border-base-300 fixed right-4 bottom-4 z-30 flex w-[28rem] flex-col overflow-hidden rounded-xl border shadow-2xl transition-all duration-200"
        classList={{
          'opacity-100 scale-100 translate-y-0': props.open,
          'opacity-0 scale-95 translate-y-4 pointer-events-none': !props.open,
        }}
        style={{ height: '65vh', 'max-height': '680px', 'min-height': '400px' }}
        // biome-ignore lint/a11y/useSemanticElements: chat panel is not a dialog
        role="complementary"
        aria-label="AI Chat"
      >
        {/* Title bar */}
        <div class="border-base-300 relative flex items-center justify-between border-b px-3 py-2">
          <div ref={setSwitcherRef} class="relative">
            <button
              class="hover:bg-base-200 flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
              onClick={() => {
                setSwitcherOpen(!switcherOpen());
              }}
              title="Switch conversation"
            >
              <Sparkles size={14} class="text-primary shrink-0" />
              <span class="max-w-48 truncate text-sm font-medium">{chat.currentTitle()}</span>
              <ChevronDown
                size={14}
                class="text-base-content/50 shrink-0 transition-transform"
                classList={{ 'rotate-180': switcherOpen() }}
              />
            </button>

            {/* Conversation switcher dropdown */}
            <Show when={switcherOpen()}>
              <ConversationSwitcher onClose={() => setSwitcherOpen(false)} class="max-w-[calc(28rem-1.5rem)]" />
            </Show>
          </div>

          <div class="flex items-center gap-0.5">
            <button
              class="btn btn-ghost btn-xs btn-circle"
              onClick={() => chat.startNewChat()}
              title="New chat"
            >
              <Plus size={14} />
            </button>
            <button
              class="btn btn-ghost btn-xs btn-circle"
              onClick={handleExpand}
              title="Expand to full page"
            >
              <Maximize2 size={14} />
            </button>
            <button
              class="btn btn-ghost btn-xs btn-circle"
              onClick={() => props.onClose()}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatMessages />

        {/* Input */}
        <ChatInput />
      </div>
    </>
  );
}
