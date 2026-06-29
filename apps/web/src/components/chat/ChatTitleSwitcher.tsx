import { ChevronDown, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useClickOutside } from '~/utils/useClickOutside';
import { useChatContext } from './chat-context.shared';
import { ConversationSwitcher } from './ConversationSwitcher';

interface ChatTitleSwitcherProps {
  /** Icon/text size variant */
  size?: 'sm' | 'md';
  /** Extra classes on the ConversationSwitcher dropdown */
  dropdownClass?: string;
  /** Called after a session is selected (e.g. to sync URL) */
  onSessionSelected?: (id: string) => void;
}

export function ChatTitleSwitcher({ size, dropdownClass, onSessionSelected }: ChatTitleSwitcherProps) {
  const chat = useChatContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sm = (size ?? 'md') === 'sm';

  useClickOutside(ref, () => {
    if (open) setOpen(false);
  });

  return (
    <div ref={ref} className="relative">
      <button
        className="hover:bg-base-200 flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
        onClick={() => setOpen(!open)}
        title="Switch conversation"
      >
        <Sparkles size={sm ? 14 : 16} className="text-primary shrink-0" />
        <span
          className={`truncate${sm ? ' max-w-48 text-sm font-medium' : ' max-w-64 text-lg font-semibold'}`}
        >
          {chat.currentTitle}
        </span>
        <ChevronDown
          size={sm ? 14 : 16}
          className={`text-base-content/50 shrink-0 transition-transform${open ? ' rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ConversationSwitcher
          onClose={() => setOpen(false)}
          onSessionSelected={onSessionSelected}
          className={dropdownClass}
        />
      )}
    </div>
  );
}
