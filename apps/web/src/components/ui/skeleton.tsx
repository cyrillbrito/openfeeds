// shadcn's Skeleton, vendored. A pulsing box with no Kobalte primitive
// behind it. Its job is to reserve the exact geometry the real content will
// occupy, so the swap when data lands moves nothing on screen.
import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';

import { cn } from '../../lib/cn';

export function Skeleton(props: ComponentProps<'div'>) {
  const others = omit(props, 'class');
  return (
    <div
      aria-hidden="true"
      class={cn('animate-pulse rounded-md bg-muted', props.class)}
      {...others}
    />
  );
}
