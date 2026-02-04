import { Link } from '@tanstack/solid-router';
import ArrowDownIcon from 'lucide-solid/icons/arrow-down';
import ArrowUpIcon from 'lucide-solid/icons/arrow-up';
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
      <Show when={isNewest()} fallback={<ArrowUpIcon size={16} />}>
        <ArrowDownIcon size={16} />
      </Show>
      <span class="hidden sm:inline">{label()}</span>
    </Link>
  );
}
