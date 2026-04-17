import { Maximize2, Plus, X } from 'lucide-solid';
import { onCleanup } from 'solid-js';
import { useChatContext } from './chat-context.shared';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatTitleSwitcher } from './ChatTitleSwitcher';

interface AiPopoverProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user clicks "Expand" with session info so the caller can navigate */
  onExpand?: (sessionId: string, hasMessages: boolean) => void;
}

export function AiPopover(props: AiPopoverProps) {
  const chat = useChatContext();

  // Handle Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      props.onClose();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  }

  const handleExpand = () => {
    props.onClose();
    props.onExpand?.(chat.sessionId(), chat.messages().length > 0);
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
        role="complementary"
        aria-label="AI Chat"
      >
        {/* Title bar */}
        <div class="border-base-300 relative flex items-center justify-between border-b px-3 py-2">
          <ChatTitleSwitcher size="sm" dropdownClass="max-w-[calc(28rem-1.5rem)]" />

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
        <ChatInput autoFocus={props.open} />
      </div>
    </>
  );
}
