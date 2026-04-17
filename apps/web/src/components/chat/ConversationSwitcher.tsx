import { Check, Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { useChatContext } from './chat-context.shared';
import type { SessionSummary } from './chat-context.shared';
import { groupByTimePeriod } from './chat-utils';

interface ConversationSwitcherProps {
  onClose: () => void;
  /** Called after a session is selected — used to sync URL in full-page mode */
  onSessionSelected?: (id: string) => void;
  /** Extra classes for the dropdown container (e.g. max-w constraint) */
  class?: string;
}

export function ConversationSwitcher(props: ConversationSwitcherProps) {
  const chat = useChatContext();

  const groups = () => {
    const s = chat.sessions();
    if (!s) return [];
    return groupByTimePeriod(s);
  };

  return (
    <div
      class={`border-base-300 bg-base-100 absolute top-full left-0 z-50 max-h-72 min-w-72 overflow-y-auto rounded-b-lg border shadow-md ${props.class ?? ''}`}
    >
      <Show
        when={groups().length > 0}
        fallback={<p class="text-base-content/40 py-6 text-center text-sm">No conversations yet</p>}
      >
        <For each={groups()}>
          {(group) => (
            <div>
              <div class="text-base-content/50 bg-base-100 sticky top-0 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
                {group.label}
              </div>
              <For each={group.items}>
                {(session) => (
                  <ConversationItem
                    session={session}
                    isActive={session.id === chat.sessionId()}
                    onSelect={() => {
                      chat.loadSession(session.id);
                      props.onSessionSelected?.(session.id);
                      props.onClose();
                    }}
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

function ConversationItem(props: {
  session: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      class="hover:bg-base-200 group flex w-full items-center gap-2 px-4 py-2 text-left transition-colors"
      classList={{ 'bg-base-200/50': props.isActive }}
      onClick={() => props.onSelect()}
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm" classList={{ 'font-medium': props.isActive }}>
          {props.session.title}
        </p>
      </div>
      <div class="flex size-6 shrink-0 items-center justify-center">
        <Show when={!props.isActive} fallback={<Check size={14} class="text-primary" />}>
          <button
            class="btn btn-ghost btn-xs btn-circle opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </Show>
      </div>
    </button>
  );
}
