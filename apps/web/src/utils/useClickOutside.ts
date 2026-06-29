import { type RefObject, useEffect } from 'react';

export function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('pointerdown', onClick, true);
    return () => document.removeEventListener('pointerdown', onClick, true);
  }, [ref, handler]);
}
