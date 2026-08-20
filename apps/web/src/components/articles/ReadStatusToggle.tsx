import { Link } from '@tanstack/react-router';
import { twMerge } from 'tailwind-merge';

export type ReadStatus = 'unread' | 'all' | 'read';

const STATUS_OPTIONS: { value: ReadStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'all', label: 'All' },
];

interface ReadStatusToggleProps {
  currentStatus: ReadStatus;
  className?: string;
}

export function ReadStatusToggle({ currentStatus, className }: ReadStatusToggleProps) {
  return (
    <div
      className={twMerge('bg-base-200 inline-flex rounded-lg p-1', className)}
      role="group"
      aria-label="Filter by read status"
    >
      {STATUS_OPTIONS.map((option) => {
        const isActive = currentStatus === option.value;
        return (
          <Link
            key={option.value}
            to="."
            search={(prev) => ({ ...prev, readStatus: option.value })}
            className={twMerge(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-base-100 text-base-content shadow-sm'
                : 'text-base-content/60 hover:text-base-content',
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
