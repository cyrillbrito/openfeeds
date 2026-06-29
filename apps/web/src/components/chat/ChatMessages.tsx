import type { ToolCallPart, UIMessage } from '@tanstack/ai-client';
import DOMPurify from 'dompurify';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useMemo, useRef } from 'react';
import { useChatContext } from './chat-context.shared';

// GFM tables / strikethrough / task lists + treat single newlines as <br>.
marked.setOptions({ gfm: true, breaks: true });

function friendlyError(err: Error): string {
  const raw = err.message || '';

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const msg = parsed?.error?.message || parsed?.message;
      if (msg) return msg;
    } catch {
      // fall through
    }
  }

  if (raw.includes('429')) return 'Rate limited — too many requests. Try again in a moment.';
  if (raw.includes('413')) return 'Request too large — try a simpler question or start a new chat.';
  if (raw.includes('500') || raw.includes('502') || raw.includes('503'))
    return 'Server error — please try again.';

  return raw || 'Something went wrong';
}

export function ChatMessages() {
  const chat = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const msgKey = `${chat.messages.length}:${chat.messages.reduce((sum, m) => sum + m.parts.length, 0)}`;

  useEffect(() => {
    if (msgKey === '0:0') return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [msgKey]);

  const lastAssistantId = useMemo(() => {
    const msgs = chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i].id;
    }
    return null;
  }, [chat.messages]);

  const hasPendingToolCall = useMemo(() => {
    const msgs = chat.messages;
    if (msgs.length === 0) return false;
    const last = msgs[msgs.length - 1];
    if (last.role !== 'assistant') return false;
    return last.parts.some(
      (p) => p.type === 'tool-call' && p.output == null && p.state !== 'input-complete',
    );
  }, [chat.messages]);

  const emptyLastAssistant = useMemo(() => {
    const msgs = chat.messages;
    if (msgs.length === 0) return false;
    const last = msgs[msgs.length - 1];
    if (last.role !== 'assistant') return false;
    return !last.parts.some(
      (p) => p.type === 'text' && 'content' in p && (p as { content: string }).content.trim(),
    );
  }, [chat.messages]);

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain py-4 pr-2 pl-4">
      {chat.messages.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <div className="text-base-content/60 text-center">
            <Sparkles size={28} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">How can I help?</p>
            <p className="text-base-content/50 mt-1 text-xs">
              Subscribe to feeds, organize tags, manage articles, and more.
            </p>
          </div>
        </div>
      )}

      {chat.messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          isStreaming={chat.isLoading && message.id === lastAssistantId}
        />
      ))}

      {chat.isLoading && !hasPendingToolCall && (
        <div className="text-base-content/40 flex items-center gap-1.5 text-xs">
          <span className="loading loading-spinner loading-xs" />
          <span>Thinking...</span>
        </div>
      )}

      {chat.error && (
        <div className="text-error/80 flex items-start gap-1.5 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{friendlyError(chat.error)}</span>
        </div>
      )}

      {!chat.isLoading && !chat.error && emptyLastAssistant && (
        <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Response was empty — the model may have hit a limit. Try rephrasing or starting a new
            chat.
          </span>
        </div>
      )}

      {chat.messages.length > 0 && <div ref={messagesEndRef} />}
    </div>
  );
}

function Message({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }
  return <AiMessage message={message} isStreaming={isStreaming} />;
}

function UserMessage({ message }: { message: UIMessage }) {
  const textContent = message.parts
    .filter((p) => p.type === 'text' && 'content' in p)
    .map((p) => (p as { content: string }).content)
    .join('')
    .trim();

  if (!textContent) return null;

  return (
    <div className="flex justify-end">
      <div className="bg-primary text-primary-content max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
        <span className="break-words whitespace-pre-wrap">{textContent}</span>
      </div>
    </div>
  );
}

function AiMessage({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  return (
    <div className="space-y-1">
      {message.parts.map((part, i) => {
        if (part.type === 'tool-call') {
          return <ToolCallIndicator key={i} part={part as ToolCallPart} />;
        }
        if (
          part.type === 'text' &&
          'content' in part &&
          (part as { content: string }).content.trim()
        ) {
          return (
            <MarkdownPart
              key={i}
              content={(part as { content: string }).content}
              isStreaming={isStreaming}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function MarkdownPart({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content) as string),
    [content],
  );

  return (
    <div
      className={`prose prose-sm prose-chat text-base-content prose-headings:text-base-content prose-a:text-primary prose-code:text-base-content max-w-none break-words${isStreaming ? ' markdown-streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ToolCallIndicator({ part }: { part: ToolCallPart }) {
  const isDone = part.output != null || part.state === 'input-complete';
  const label = part.name.replace(/_/g, ' ');

  return (
    <div className="text-base-content/50 mt-2 flex items-center gap-1.5 text-xs">
      {isDone ? (
        <span className="text-success">&#10003;</span>
      ) : (
        <span className="loading loading-spinner loading-xs" />
      )}
      <span>{label}</span>
    </div>
  );
}
