import { Maximize2, Plus, X } from 'lucide-react';
import { useEffect } from 'react';
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

export function AiPopover({ open, onClose, onExpand }: AiPopoverProps) {
  const chat = useChatContext();

  // Handle Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleExpand = () => {
    onClose();
    onExpand?.(chat.sessionId, chat.messages.length > 0);
  };

  return (
    <>
      {/* Backdrop scrim — click outside to close */}
      <div
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity duration-200${open ? ' opacity-100' : ' opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`bg-base-100 border-base-300 fixed right-4 bottom-4 z-30 flex w-[28rem] flex-col overflow-hidden rounded-xl border shadow-2xl transition-all duration-200${open ? ' opacity-100 scale-100 translate-y-0' : ' opacity-0 scale-95 translate-y-4 pointer-events-none'}`}
        style={{ height: '65vh', maxHeight: '680px', minHeight: '400px' }}
        role="complementary"
        aria-label="AI Chat"
      >
        {/* Title bar */}
        <div className="border-base-300 relative flex items-center justify-between border-b px-3 py-2">
          <ChatTitleSwitcher size="sm" dropdownClass="max-w-[calc(28rem-1.5rem)]" />

          <div className="flex items-center gap-0.5">
            {chat.messages.length > 0 && (
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => chat.startNewChat()}
                title="New chat"
              >
                <Plus size={14} />
              </button>
            )}
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={handleExpand}
              title="Expand to full page"
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={onClose}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatMessages />

        {/* Input */}
        <ChatInput autoFocus={open} />
      </div>
    </>
  );
}
