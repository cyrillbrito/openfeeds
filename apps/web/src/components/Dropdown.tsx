import { createEffect, createSignal, onCleanup, type JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface DropdownProps {
  end?: boolean;
  top?: boolean;
  btnClasses: string;
  btnContent: JSXElement;
  children: JSXElement;
}

export function Dropdown(props: DropdownProps) {
  let triggerRef: HTMLDivElement | undefined;
  let popoverRef: HTMLUListElement | undefined;

  const [isOpen, setIsOpen] = createSignal(false);

  const updatePosition = () => {
    if (!triggerRef || !popoverRef) return;
    const bounds = triggerRef.getBoundingClientRect();

    if (props.top) {
      popoverRef.style.bottom = `${window.innerHeight - bounds.top + 4}px`;
    } else {
      popoverRef.style.top = `${bounds.bottom + 4}px`;
    }

    if (props.end) {
      popoverRef.style.right = `${window.innerWidth - bounds.right}px`;
    } else {
      popoverRef.style.left = `${bounds.left}px`;
    }
  };

  const toggle = () => {
    if (!popoverRef) return;
    if (isOpen()) {
      popoverRef.hidePopover();
    } else {
      popoverRef.showPopover();
      updatePosition();
    }
  };

  // Sync isOpen state with popover toggle event (handles light dismiss)
  createEffect(() => {
    if (!popoverRef) return;

    const handleToggle = (e: ToggleEvent) => {
      setIsOpen(e.newState === 'open');
    };

    popoverRef.addEventListener('toggle', handleToggle);
    onCleanup(() => popoverRef?.removeEventListener('toggle', handleToggle));
  });

  // Close popover when a menu item is clicked
  const handleMenuClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) {
      popoverRef?.hidePopover();
    }
  };

  return (
    <div class="relative">
      <div
        ref={(el) => (triggerRef = el)}
        role="button"
        tabindex="0"
        class={twMerge('btn', props.btnClasses)}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen()}
      >
        {props.btnContent}
      </div>
      <ul
        ref={(el) => (popoverRef = el)}
        popover="auto"
        role="menu"
        class="menu bg-base-200 border-base-300 rounded-box m-0 w-52 border shadow"
        onClick={handleMenuClick}
      >
        {props.children}
      </ul>
    </div>
  );
}
