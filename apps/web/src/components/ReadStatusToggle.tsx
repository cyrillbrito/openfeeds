import { Link } from '@tanstack/solid-router';
import { For } from 'solid-js';

export type ReadStatus = 'unread' | 'all' | 'read';

const STATUS_OPTIONS: { value: ReadStatus; label: string; shortLabel: string }[] = [
  { value: 'unread', label: 'Unread', shortLabel: 'Unread' },
  { value: 'all', label: 'All', shortLabel: 'All' },
];

interface ReadStatusToggleProps {
  currentStatus: ReadStatus;
  class?: string;
}

export function ReadStatusToggle(props: ReadStatusToggleProps) {
  return (
    <div class={`join ${props.class || ''}`} role="group" aria-label="Filter by read status">
      <For each={STATUS_OPTIONS}>
        {(option) => {
          const getButtonClass = () => {
            const isActive = props.currentStatus === option.value;
            return `join-item btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline hover:btn-outline'}`;
          };

          return (
            <Link
              to="."
              search={(prev) => ({ ...prev, readStatus: option.value })}
              class={getButtonClass()}
              aria-pressed={props.currentStatus === option.value}
            >
              <span class="hidden sm:inline">{option.label}</span>
              <span class="sm:hidden">{option.shortLabel}</span>
            </Link>
          );
        }}
      </For>
    </div>
  );
}
