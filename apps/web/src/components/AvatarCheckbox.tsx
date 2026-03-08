import { Check } from 'lucide-solid';
import type { JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface AvatarCheckboxProps {
  /** Whether the item is currently selected */
  selected: boolean;
  /** Called when the user clicks to toggle selection */
  onToggle: () => void;
  /** The avatar content (img, icon fallback, etc.) */
  children: JSXElement;
  /** Additional classes for the outer wrapper */
  class?: string;
}

/**
 * Google Photos / Gmail-style avatar checkbox.
 *
 * Shows the avatar by default. On hover, a checkmark overlays the avatar.
 * When selected, the overlay stays visible. Clicking toggles selection.
 *
 * Usage:
 * ```tsx
 * <AvatarCheckbox selected={isSelected()} onToggle={toggle}>
 *   <img src={icon} class="size-8 rounded-full object-cover" />
 * </AvatarCheckbox>
 * ```
 */
export function AvatarCheckbox(props: AvatarCheckboxProps) {
  return (
    <button
      class={twMerge(
        'group/select relative inline-flex shrink-0 cursor-pointer select-none',
        props.class,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onToggle();
      }}
      aria-label={props.selected ? 'Deselect' : 'Select'}
      type="button"
    >
      {/* Avatar content + overlay scoped to the avatar's own size */}
      <div class="relative">
        {props.children}

        {/* Checkmark overlay — dark scrim so the avatar bleeds through slightly */}
        <div
          class={twMerge(
            'pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/60 transition-opacity duration-150',
            props.selected ? 'opacity-100' : 'opacity-0 group-hover/select:opacity-100',
          )}
        >
          <Check class="size-4 text-white md:size-5" strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}
