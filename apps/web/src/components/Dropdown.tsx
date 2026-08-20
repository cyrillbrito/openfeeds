import type { ReactNode } from 'react';
import { useId } from 'react';
import { twMerge } from 'tailwind-merge';

interface DropdownProps {
  end?: boolean;
  top?: boolean;
  btnClasses: string;
  btnContent: ReactNode;
  children: ReactNode;
}

export function Dropdown({ end, top, btnClasses, btnContent, children }: DropdownProps) {
  const uid = useId();
  const id = `dropdown-${uid}`;
  const anchor = `--dropdown-${uid}`;

  const handleMenuClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) {
      (document.getElementById(id) as any)?.hidePopover();
    }
  };

  return (
    <>
      <button
        className={twMerge('btn', btnClasses)}
        popoverTarget={id}
        style={{ anchorName: anchor } as React.CSSProperties}
      >
        {btnContent}
      </button>
      <ul
        popover="auto"
        id={id}
        role="menu"
        className={`dropdown menu bg-base-200 border-base-300 rounded-box w-52 border p-2 shadow-sm ${end ? 'dropdown-end' : ''} ${top ? 'dropdown-top' : ''}`}
        style={{ positionAnchor: anchor } as React.CSSProperties}
        onClick={handleMenuClick}
      >
        {children}
      </ul>
    </>
  );
}
