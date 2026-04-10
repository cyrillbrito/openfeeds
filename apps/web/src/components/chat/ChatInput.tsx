import { ArrowUp } from 'lucide-solid';
import { createSignal, onMount, Show } from 'solid-js';
import { useChatContext } from './chat-context';

interface ChatInputProps {
  autoFocus?: boolean;
}

export function ChatInput(props: ChatInputProps) {
  const chat = useChatContext();
  const [input, setInput] = createSignal('');
  let textareaRef: HTMLTextAreaElement | undefined;

  const resize = () => {
    const el = textareaRef;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  onMount(() => {
    if (props.autoFocus) {
      requestAnimationFrame(() => textareaRef?.focus());
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const text = input().trim();
    if (text && !chat.isLoading()) {
      void chat.sendMessage(text);
      setInput('');
      // Reset textarea height after send
      requestAnimationFrame(() => {
        if (textareaRef) {
          textareaRef.style.height = 'auto';
        }
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = () => input().trim() && !chat.isLoading();

  return (
    <form onSubmit={handleSubmit} class="border-base-300 border-t px-3 py-3">
      <div class="bg-base-200/50 flex items-end gap-2 rounded-xl px-3 py-2">
        <textarea
          ref={(el) => (textareaRef = el)}
          class="max-h-40 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-sm"
          placeholder="Ask me anything..."
          value={input()}
          onInput={(e) => {
            setInput(e.currentTarget.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          disabled={chat.isLoading()}
          rows={1}
        />
        <Show when={canSend()}>
          <button type="submit" class="btn btn-primary btn-circle btn-xs shrink-0" title="Send">
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </Show>
      </div>
    </form>
  );
}
