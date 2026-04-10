import { Send } from 'lucide-solid';
import { createSignal } from 'solid-js';
import { useChatContext } from './chat-context';

export function ChatInput() {
  const chat = useChatContext();
  const [input, setInput] = createSignal('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const text = input().trim();
    if (text && !chat.isLoading()) {
      void chat.sendMessage(text);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="border-base-300 border-t px-3 py-3">
      <div class="flex items-center gap-2">
        <input
          type="text"
          class="input input-bordered input-sm flex-1"
          placeholder="Ask me anything..."
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={chat.isLoading()}
        />
        <button
          type="submit"
          class="btn btn-primary btn-sm btn-circle"
          disabled={chat.isLoading() || !input().trim()}
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </form>
  );
}

/** Variant for full-screen: focus on mount */
export function ChatInputAutoFocus() {
  const chat = useChatContext();
  const [input, setInput] = createSignal('');
  let inputRef: HTMLInputElement | undefined;

  // Focus on mount
  requestAnimationFrame(() => inputRef?.focus());

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const text = input().trim();
    if (text && !chat.isLoading()) {
      void chat.sendMessage(text);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="border-base-300 border-t px-3 py-3">
      <div class="flex items-center gap-2">
        <input
          ref={(el) => (inputRef = el)}
          type="text"
          class="input input-bordered input-sm flex-1"
          placeholder="Ask me anything..."
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={chat.isLoading()}
        />
        <button
          type="submit"
          class="btn btn-primary btn-sm btn-circle"
          disabled={chat.isLoading() || !input().trim()}
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </form>
  );
}
