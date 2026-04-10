import type { ChatSessionSummary } from '@repo/domain/client';
import { Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { useChatContext } from './chat-context';
import { formatRelativeDate } from './chat-utils';

export function ChatHistory() {
  const chat = useChatContext();

  return (
    <div class="border-base-300 flex-1 overflow-y-auto border-b">
      <div class="p-3">
        <p class="text-base-content/50 mb-2 text-xs font-medium tracking-wide uppercase">
          Recent chats
        </p>
        <Show
          when={chat.sessions() && chat.sessions()!.length > 0}
          fallback={
            <p class="text-base-content/40 py-8 text-center text-sm">No chat history yet</p>
          }
        >
          <ul class="space-y-1">
            <For each={chat.sessions()}>
              {(session) => (
                <SessionItem
                  session={session}
                  isActive={session.id === chat.sessionId()}
                  onSelect={() => void chat.loadSession(session.id)}
                  onDelete={() => void chat.deleteSession(session.id)}
                />
              )}
            </For>
          </ul>
        </Show>
      </div>
    </div>
  );
}

function SessionItem(props: {
  session: ChatSessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      class="hover:bg-base-200 group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors"
      classList={{ 'bg-base-200': props.isActive }}
      onClick={() => props.onSelect()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onSelect();
      }}
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm" classList={{ 'font-medium': props.isActive }}>
          {props.session.title}
        </p>
        <p class="text-base-content/40 text-xs">{formatRelativeDate(props.session.updatedAt)}</p>
      </div>
      <button
        class="btn btn-ghost btn-xs btn-circle opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete();
        }}
        title="Delete chat"
      >
        <Trash2 size={12} />
      </button>
    </li>
  );
}
