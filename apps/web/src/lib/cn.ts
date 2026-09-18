// The class merger every vendored component uses: clsx resolves conditional
// class arguments, then tailwind-merge drops earlier utilities that a later
// one overrides. Without the merge, `cn('px-4', props.class)` with a caller
// passing `px-2` would emit both and let source order decide the winner.
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
