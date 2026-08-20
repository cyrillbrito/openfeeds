import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface AvatarCheckboxProps {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Google Photos / Gmail-style avatar checkbox.
 *
 * Shows the avatar by default. On hover, a checkmark overlays the avatar.
 * When selected, the overlay stays visible. Clicking toggles selection.
 */
export function AvatarCheckbox({ selected, onToggle, children, className }: AvatarCheckboxProps) {
  return (
    <button
      className={twMerge(
        'group/select relative inline-flex shrink-0 cursor-pointer select-none',
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-label={selected ? 'Deselect' : 'Select'}
      type="button"
    >
      <div className="relative">
        {children}

        <div
          className={twMerge(
            'pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/60 transition-opacity duration-150',
            selected ? 'opacity-100' : 'opacity-0 group-hover/select:opacity-100',
          )}
        >
          <Check className="size-4 text-white md:size-5" strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}
