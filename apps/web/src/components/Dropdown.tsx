import type { JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface DropdownProps {
  end?: boolean;
  top?: boolean;
  btnClasses: string;
  btnContent: JSXElement;
  children: JSXElement;
}

export function Dropdown(props: DropdownProps) {
  return (
    <div
      classList={{
        dropdown: true,
        'dropdown-end': props.end,
        'dropdown-top': props.top,
      }}
    >
      <div tabindex="0" role="button" class={twMerge('btn', props.btnClasses)}>
        {props.btnContent}
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-200 border-base-300 rounded-box z-1 w-52 border shadow"
      >
        {props.children}
      </ul>
    </div>
  );
}
