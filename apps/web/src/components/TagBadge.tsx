import { twMerge } from 'tailwind-merge';
import { getTagDotColor } from '../utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

interface TagBadgeProps {
  name: string;
  color: string | null;
  size?: 'xs' | 'sm' | 'md';
  class?: string;
}

export function TagBadge(props: TagBadgeProps) {
  const sizeClass = props.size === 'xs' ? 'badge-xs' : props.size === 'sm' ? 'badge-sm' : '';

  return (
    <div class={twMerge('badge gap-1.5', sizeClass, props.class)}>
      <ColorIndicator class={getTagDotColor(props.color as any)} />
      <span>{props.name}</span>
    </div>
  );
}
