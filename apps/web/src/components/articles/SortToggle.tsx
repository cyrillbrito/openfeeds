import { Link } from '@tanstack/solid-router';
import { ArrowDown, ArrowUp } from 'lucide-solid';
import { Show } from 'solid-js';
import type { SortOrder } from '~/utils/routing';

interface SortToggleProps {
  currentSort: SortOrder;
}

export function SortToggle(props: SortToggleProps) {
  const nextSort = () => (props.currentSort === 'newest' ? 'oldest' : 'newest');
  const isNewest = () => props.currentSort === 'newest';
  const label = () => (isNewest() ? 'Newest' : 'Oldest');

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, sort: nextSort() })}
      class="btn btn-ghost btn-sm gap-1"
      title={`Currently: ${label()} first. Click to toggle.`}
    >
      <Show when={isNewest()} fallback={<ArrowUp size={16} />}>
        <ArrowDown size={16} />
      </Show>
      <span class="hidden sm:inline">{label()}</span>
    </Link>
  );
}
