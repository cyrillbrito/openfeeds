import { Link } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export type ReadStatus = 'unread' | 'all' | 'read';

const STATUS_OPTIONS: { value: ReadStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'all', label: 'All' },
];

interface ReadStatusToggleProps {
  currentStatus: ReadStatus;
  class?: string;
}

export function ReadStatusToggle(props: ReadStatusToggleProps) {
  return (
    <div
      class={twMerge('bg-base-200 inline-flex rounded-lg p-1', props.class)}
      role="group"
      aria-label="Filter by read status"
    >
      <For each={STATUS_OPTIONS}>
        {(option) => {
          const isActive = () => props.currentStatus === option.value;

          return (
            <Link
              to="."
              search={(prev) => ({ ...prev, readStatus: option.value })}
              class={twMerge(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                isActive()
                  ? 'bg-base-100 text-base-content shadow-sm'
                  : 'text-base-content/60 hover:text-base-content',
              )}
              aria-pressed={isActive()}
            >
              {option.label}
            </Link>
          );
        }}
      </For>
    </div>
  );
}
