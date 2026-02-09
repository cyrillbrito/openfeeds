import { createUniqueId, type JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface DropdownProps {
  end?: boolean;
  top?: boolean;
  btnClasses: string;
  btnContent: JSXElement;
  children: JSXElement;
}

let counter = 0;

export function Dropdown(props: DropdownProps) {
  const id = `dropdown-${createUniqueId()}`;
  const anchor = `--anchor-${++counter}`;

  // Close popover when a menu item is clicked
  const handleMenuClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) {
      document.getElementById(id)?.hidePopover();
    }
  };

  return (
    <>
      <button
        class={twMerge('btn', props.btnClasses)}
        popovertarget={id}
        style={{ 'anchor-name': anchor }}
      >
        {props.btnContent}
      </button>
      <ul
        popover="auto"
        id={id}
        role="menu"
        class={`dropdown menu bg-base-200 border-base-300 rounded-box w-52 border p-2 shadow-sm ${props.end ? 'dropdown-end' : ''} ${props.top ? 'dropdown-top' : ''}`}
        style={{ 'position-anchor': anchor }}
        onClick={handleMenuClick}
      >
        {props.children}
      </ul>
    </>
  );
}
