import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { SortOrder } from '~/utils/routing';

interface SortToggleProps {
  currentSort: SortOrder;
}

export function SortToggle({ currentSort }: SortToggleProps) {
  const nextSort = currentSort === 'newest' ? 'oldest' : 'newest';
  const isNewest = currentSort === 'newest';
  const label = isNewest ? 'Newest' : 'Oldest';

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, sort: nextSort })}
      className="btn btn-ghost btn-sm gap-1"
      title={`Currently: ${label} first. Click to toggle.`}
    >
      {isNewest ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
