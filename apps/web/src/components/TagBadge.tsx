import type { TagColor } from '@repo/domain/client';
import { twMerge } from 'tailwind-merge';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

interface TagBadgeProps {
  name: string;
  color: TagColor | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function TagBadge({ name, color, size, className }: TagBadgeProps) {
  const sizeClass = size === 'xs' ? 'badge-xs' : size === 'sm' ? 'badge-sm' : '';

  return (
    <div className={twMerge('badge gap-1.5', sizeClass, className)}>
      <ColorIndicator className={getTagDotColor(color)} />
      <span>{name}</span>
    </div>
  );
}
