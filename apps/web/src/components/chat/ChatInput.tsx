import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useChatContext } from './chat-context.shared';

interface ChatInputProps {
  autoFocus?: boolean;
}

export function ChatInput({ autoFocus }: ChatInputProps) {
  const chat = useChatContext();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (text && !chat.isLoading) {
      void chat.sendMessage(text);
      setInput('');
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const canSend = input.trim() && !chat.isLoading;

  return (
    <form onSubmit={handleSubmit} className="border-base-300 border-t px-3 py-3">
      <div
        className={`flex items-end gap-2 rounded-xl px-3 py-2${chat.isLoading ? ' bg-base-200/30' : ' bg-base-200/50'}`}
      >
        <textarea
          ref={textareaRef}
          className={`max-h-40 min-h-[1.5rem] flex-1 resize-none bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-sm placeholder:leading-6${chat.isLoading ? ' opacity-50' : ''}`}
          placeholder={chat.isLoading ? 'Generating response...' : 'Ask me anything...'}
          value={input}
          onChange={(e) => {
            setInput(e.currentTarget.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        {chat.isLoading && (
          <button
            type="button"
            className="btn btn-error btn-circle btn-xs shrink-0"
            title="Stop generating"
            onClick={() => chat.stop()}
          >
            <Square size={10} fill="currentColor" />
          </button>
        )}
        {canSend && (
          <button
            type="submit"
            className="btn btn-primary btn-circle btn-xs shrink-0"
            title="Send"
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </form>
  );
}
