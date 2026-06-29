import { Check, Trash2 } from 'lucide-react';
import { useChatContext } from './chat-context.shared';
import type { SessionSummary } from './chat-context.shared';
import { groupByTimePeriod } from './chat-utils';

interface ConversationSwitcherProps {
  onClose: () => void;
  /** Called after a session is selected — used to sync URL in full-page mode */
  onSessionSelected?: (id: string) => void;
  /** Extra classes for the dropdown container (e.g. max-w constraint) */
  className?: string;
}

export function ConversationSwitcher({ onClose, onSessionSelected, className }: ConversationSwitcherProps) {
  const chat = useChatContext();

  const groups = chat.sessions ? groupByTimePeriod(chat.sessions) : [];

  return (
    <div
      className={`border-base-300 bg-base-100 absolute top-full left-0 z-50 max-h-72 min-w-72 overflow-y-auto rounded-b-lg border shadow-md ${className ?? ''}`}
    >
      {groups.length === 0 ? (
        <p className="text-base-content/40 py-6 text-center text-sm">No conversations yet</p>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <div className="text-base-content/50 bg-base-100 sticky top-0 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
              {group.label}
            </div>
            {group.items.map((session) => (
              <ConversationItem
                key={session.id}
                session={session}
                isActive={session.id === chat.sessionId}
                onSelect={() => {
                  chat.loadSession(session.id);
                  onSessionSelected?.(session.id);
                  onClose();
                }}
                onDelete={() => chat.deleteSession(session.id)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function ConversationItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      className={`hover:bg-base-200 group flex w-full items-center gap-2 px-4 py-2 text-left transition-colors${isActive ? ' bg-base-200/50' : ''}`}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm${isActive ? ' font-medium' : ''}`}>{session.title}</p>
      </div>
      <div className="flex size-6 shrink-0 items-center justify-center">
        {isActive ? (
          <Check size={14} className="text-primary" />
        ) : (
          <button
            className="btn btn-ghost btn-xs btn-circle opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </button>
  );
}
