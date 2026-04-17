import { ChevronDown, Sparkles } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
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

/** Title button + conversation switcher dropdown with click-outside handling */
export function ChatTitleSwitcher(props: ChatTitleSwitcherProps) {
  const chat = useChatContext();
  const [open, setOpen] = createSignal(false);
  const [ref, setRef] = createSignal<HTMLDivElement>();
  const sm = () => (props.size ?? 'md') === 'sm';

  useClickOutside(ref, () => {
    if (open()) setOpen(false);
  });

  return (
    <div ref={setRef} class="relative">
      <button
        class="hover:bg-base-200 flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
        onClick={() => setOpen(!open())}
        title="Switch conversation"
      >
        <Sparkles size={sm() ? 14 : 16} class="text-primary shrink-0" />
        <span
          class="truncate"
          classList={{
            'max-w-48 text-sm font-medium': sm(),
            'max-w-64 text-lg font-semibold': !sm(),
          }}
        >
          {chat.currentTitle()}
        </span>
        <ChevronDown
          size={sm() ? 14 : 16}
          class="text-base-content/50 shrink-0 transition-transform"
          classList={{ 'rotate-180': open() }}
        />
      </button>

      <Show when={open()}>
        <ConversationSwitcher
          onClose={() => setOpen(false)}
          onSessionSelected={props.onSessionSelected}
          class={props.dropdownClass}
        />
      </Show>
    </div>
  );
}
