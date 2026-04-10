import { onCleanup, onMount } from 'solid-js';

/**
 * Calls `handler` when a click lands outside the element returned by `ref`.
 * Attaches on mount, cleans up automatically.
 */
export function useClickOutside(ref: () => HTMLElement | undefined, handler: () => void) {
  onMount(() => {
    const onClick = (e: MouseEvent) => {
      const el = ref();
      if (el && !el.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('pointerdown', onClick, true);
    onCleanup(() => document.removeEventListener('pointerdown', onClick, true));
  });
}
