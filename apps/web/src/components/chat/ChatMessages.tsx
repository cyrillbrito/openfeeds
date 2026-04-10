import type { MessagePart, ToolCallPart, UIMessage } from '@tanstack/ai';
import { Bot } from 'lucide-solid';
import { createEffect, For, on, Show } from 'solid-js';
import { useChatContext } from './chat-context';
import { renderMarkdown } from './chat-utils';

export function ChatMessages() {
  const chat = useChatContext();
  let messagesEndRef: HTMLDivElement | undefined;

  // Auto-scroll when messages change
  createEffect(
    on(
      () => chat.messages().length,
      () => {
        requestAnimationFrame(() => {
          messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
        });
      },
    ),
  );

  return (
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <Show when={chat.messages().length === 0}>
        <div class="flex h-full items-center justify-center">
          <div class="text-base-content/40 text-center">
            <Bot size={28} class="mx-auto mb-3 opacity-30" />
            <p class="text-sm font-medium">How can I help?</p>
            <p class="mt-1 text-xs">
              Subscribe to feeds, organize tags, manage articles, and more.
            </p>
          </div>
        </div>
      </Show>

      <For each={chat.messages()}>{(message) => <MessageBubble message={message} />}</For>

      <Show when={chat.isLoading()}>
        <div class="flex items-start gap-2">
          <div class="bg-base-200 rounded-2xl rounded-tl-sm px-3 py-2">
            <span class="loading loading-dots loading-xs" />
          </div>
        </div>
      </Show>

      <div ref={(el) => (messagesEndRef = el)} />
    </div>
  );
}

function MessageBubble(props: { message: UIMessage }) {
  const isUser = () => props.message.role === 'user';

  const hasText = () =>
    props.message.parts.some(
      (p) => p.type === 'text' && 'content' in p && (p as { content: string }).content.trim(),
    );

  const toolCalls = () =>
    props.message.parts.filter((p): p is ToolCallPart => p.type === 'tool-call');

  return (
    <div>
      <Show when={!isUser() && toolCalls().length > 0}>
        <div class="mb-1 space-y-0.5">
          <For each={toolCalls()}>{(tc) => <ToolCallIndicator part={tc} />}</For>
        </div>
      </Show>

      <Show when={hasText()}>
        <div classList={{ 'flex justify-end': isUser() }}>
          <div
            class="max-w-[88%] rounded-2xl px-3 py-2 text-sm"
            classList={{
              'bg-primary text-primary-content rounded-br-sm': isUser(),
              'bg-base-200 text-base-content rounded-tl-sm': !isUser(),
            }}
          >
            <For each={props.message.parts}>
              {(part) => <PartContent part={part} isUser={isUser()} />}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function PartContent(props: { part: MessagePart; isUser: boolean }) {
  return (
    <Show when={props.part.type === 'text' && 'content' in props.part}>
      <div
        class="prose-chat break-words whitespace-pre-wrap"
        innerHTML={renderMarkdown((props.part as { content: string }).content)}
      />
    </Show>
  );
}

function ToolCallIndicator(props: { part: ToolCallPart }) {
  const isDone = () => props.part.output != null || props.part.state === 'input-complete';
  const label = () => props.part.name.replace(/_/g, ' ');

  return (
    <div class="text-base-content/50 flex items-center gap-1.5 text-xs">
      <Show when={isDone()} fallback={<span class="loading loading-spinner loading-xs" />}>
        <span class="text-success">&#10003;</span>
      </Show>
      <span>{label()}</span>
    </div>
  );
}
