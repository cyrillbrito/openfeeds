import type { ChatSession } from '@repo/domain/client';
import { Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { TimeAgo } from '~/components/TimeAgo';
import { useChatContext } from './chat-context';
import { groupByTimePeriod } from './chat-utils';

/** Grouped chat history list (for full-page sidebar) */
export function ChatHistory() {
  const chat = useChatContext();

  const groups = () => {
    const s = chat.sessions();
    if (!s) return [];
    return groupByTimePeriod(s);
  };

  return (
    <div class="flex-1 overflow-y-auto">
      <Show
        when={groups().length > 0}
        fallback={<p class="text-base-content/40 py-8 text-center text-sm">No chat history yet</p>}
      >
        <For each={groups()}>
          {(group) => (
            <div class="py-1">
              <p class="text-base-content/50 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
                {group.label}
              </p>
              <For each={group.items}>
                {(session) => (
                  <SessionItem
                    session={session}
                    isActive={session.id === chat.sessionId()}
                    onSelect={() => chat.loadSession(session.id)}
                    onDelete={() => chat.deleteSession(session.id)}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

function SessionItem(props: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      class="hover:bg-base-200 group flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left transition-colors"
      classList={{ 'bg-base-200': props.isActive }}
      onClick={() => props.onSelect()}
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm" classList={{ 'font-medium': props.isActive }}>
          {props.session.title}
        </p>
        <TimeAgo date={props.session.updatedAt} class="text-base-content/40 text-xs" />
      </div>
      <button
        class="btn btn-ghost btn-xs btn-circle shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete();
        }}
        title="Delete chat"
      >
        <Trash2 size={12} />
      </button>
    </button>
  );
}
