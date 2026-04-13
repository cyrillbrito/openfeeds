import type { ToolCallPart, UIMessage } from '@tanstack/ai';
import { AlertTriangle, Sparkles } from 'lucide-solid';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { createEffect, createMemo, Index, on, Show, Switch, Match } from 'solid-js';
import { SolidMarkdown } from 'solid-markdown';
import { useChatContext } from './chat-context.shared';

/** Extract a human-readable error message from API errors. */
function friendlyError(err: Error): string {
  const raw = err.message || '';

  // Try to parse embedded JSON from Anthropic API errors (e.g. "429 {"type":"error","error":{...}}")
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

  // Common HTTP status prefixes
  if (raw.includes('429')) return 'Rate limited — too many requests. Try again in a moment.';
  if (raw.includes('413')) return 'Request too large — try a simpler question or start a new chat.';
  if (raw.includes('500') || raw.includes('502') || raw.includes('503'))
    return 'Server error — please try again.';

  return raw || 'Something went wrong';
}

export function ChatMessages() {
  const chat = useChatContext();
  let messagesEndRef: HTMLDivElement | undefined;

  createEffect(
    on(
      () => {
        const msgs = chat.messages();
        // Track both message count and total parts count to scroll on content updates
        const partsCount = msgs.reduce((sum, m) => sum + m.parts.length, 0);
        return `${msgs.length}:${partsCount}`;
      },
      (key) => {
        if (key === '0:0') return;
        requestAnimationFrame(() => {
          messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
        });
      },
    ),
  );

  const lastAssistantId = createMemo(() => {
    const msgs = chat.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]!.role === 'assistant') return msgs[i]!.id;
    }
    return null;
  });

  const emptyLastAssistant = createMemo(() => {
    const msgs = chat.messages();
    if (msgs.length === 0) return false;
    const last = msgs[msgs.length - 1]!;
    if (last.role !== 'assistant') return false;
    // Check if the last assistant message has no text parts with content
    return !last.parts.some(
      (p) => p.type === 'text' && 'content' in p && (p as { content: string }).content.trim(),
    );
  });

  return (
    <div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain py-4 pr-2 pl-4">
      <Show when={chat.messages().length === 0}>
        <div class="flex h-full items-center justify-center">
          <div class="text-base-content/60 text-center">
            <Sparkles size={28} class="mx-auto mb-3 opacity-50" />
            <p class="text-sm font-medium">How can I help?</p>
            <p class="text-base-content/50 mt-1 text-xs">
              Subscribe to feeds, organize tags, manage articles, and more.
            </p>
          </div>
        </div>
      </Show>

      <Index each={chat.messages()}>
        {(message) => (
          <Message
            message={message()}
            isStreaming={chat.isLoading() && message().id === lastAssistantId()}
          />
        )}
      </Index>

      <Show when={chat.isLoading()}>
        <div class="text-base-content/40 flex items-center gap-1.5 text-xs">
          <span class="loading loading-spinner loading-xs" />
          <span>Thinking...</span>
        </div>
      </Show>

      <Show when={chat.error()}>
        {(err) => (
          <div class="text-error/80 flex items-start gap-1.5 text-xs">
            <AlertTriangle size={14} class="mt-0.5 shrink-0" />
            <span>{friendlyError(err())}</span>
          </div>
        )}
      </Show>

      <Show when={!chat.isLoading() && !chat.error() && emptyLastAssistant()}>
        <div class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} class="mt-0.5 shrink-0" />
          <span>
            Response was empty — the model may have hit a limit. Try rephrasing or starting a new
            chat.
          </span>
        </div>
      </Show>

      <Show when={chat.messages().length > 0}>
        <div ref={(el) => (messagesEndRef = el)} />
      </Show>
    </div>
  );
}

function Message(props: { message: UIMessage; isStreaming: boolean }) {
  const isUser = () => props.message.role === 'user';

  return (
    <Show
      when={isUser()}
      fallback={<AiMessage message={props.message} isStreaming={props.isStreaming} />}
    >
      <UserMessage message={props.message} />
    </Show>
  );
}

/** User message — right-aligned bubble */
function UserMessage(props: { message: UIMessage }) {
  const textContent = () => {
    const parts = props.message.parts.filter((p) => p.type === 'text' && 'content' in p);
    return parts
      .map((p) => (p as { content: string }).content)
      .join('')
      .trim();
  };

  return (
    <Show when={textContent()}>
      <div class="flex justify-end">
        <div class="bg-primary text-primary-content max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
          <span class="break-words whitespace-pre-wrap">{textContent()}</span>
        </div>
      </div>
    </Show>
  );
}

/** AI message — full-width prose, no bubble. Parts rendered in order. */
function AiMessage(props: { message: UIMessage; isStreaming: boolean }) {
  return (
    <div class="space-y-1">
      <Index each={props.message.parts}>
        {(part) => (
          <Switch>
            <Match when={part().type === 'tool-call'}>
              <ToolCallIndicator part={part() as ToolCallPart} />
            </Match>
            <Match
              when={
                part().type === 'text' &&
                'content' in part() &&
                (part() as { content: string }).content.trim()
              }
            >
              <MarkdownPart
                content={(part() as { content: string }).content}
                isStreaming={props.isStreaming}
              />
            </Match>
          </Switch>
        )}
      </Index>
    </div>
  );
}

const remarkPlugins = [remarkGfm, remarkBreaks];

function MarkdownPart(props: { content: string; isStreaming: boolean }) {
  return (
    <div
      class="prose prose-sm prose-chat text-base-content prose-headings:text-base-content prose-a:text-primary prose-code:text-base-content max-w-none break-words"
      classList={{ 'markdown-streaming': props.isStreaming }}
    >
      <SolidMarkdown renderingStrategy="reconcile" remarkPlugins={remarkPlugins}>
        {props.content}
      </SolidMarkdown>
    </div>
  );
}

function ToolCallIndicator(props: { part: ToolCallPart }) {
  const isDone = () => props.part.output != null || props.part.state === 'input-complete';
  const label = () => props.part.name.replace(/_/g, ' ');

  return (
    <div class="text-base-content/50 mt-2 flex items-center gap-1.5 text-xs">
      <Show when={isDone()} fallback={<span class="loading loading-spinner loading-xs" />}>
        <span class="text-success">&#10003;</span>
      </Show>
      <span>{label()}</span>
    </div>
  );
}
