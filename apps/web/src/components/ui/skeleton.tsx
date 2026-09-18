// shadcn's Skeleton, vendored. There is no Kobalte primitive behind this one
// — it is a pulsing box — but it lives with the rest of src/components/ui
// because every loading fallback in the app is built out of it, and a
// skeleton that drifts from the real thing is worse than no skeleton at all.
//
// The point of a skeleton here is NOT "show the user something is happening".
// It is to reserve the exact geometry the real content will occupy, so the
// swap when data lands moves nothing on screen.
import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';

import { cn } from '../../lib/cn';

export function Skeleton(props: ComponentProps<'div'>) {
  // Solid 2 has no splitProps: `omit` returns a reactive proxy of the rest.
  const others = omit(props, 'class');
  return (
    <div
      aria-hidden="true"
      class={cn('animate-pulse rounded-md bg-muted', props.class)}
      {...others}
    />
  );
}
