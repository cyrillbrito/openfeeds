import { Menu } from 'lucide-solid';
import type { JSXElement } from 'solid-js';

interface HeaderProps {
  children?: JSXElement;
  title?: JSXElement;
  /** Only show the title on mobile (hidden on sm+, where the page has its own heading).
   *  At lg+ the sidebar is always visible so the entire header bar is hidden. */
  mobileOnlyTitle?: boolean;
}

export function Header(props: HeaderProps) {
  return (
    <header
      class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow"
      classList={{ 'lg:hidden': props.mobileOnlyTitle }}
    >
      <div class="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6 xl:max-w-3xl">
        <div class="flex items-center gap-3">
          <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
            <Menu size={24} />
          </label>

          <h1
            class="text-base-content text-lg font-semibold"
            classList={{
              'hidden sm:block': !props.mobileOnlyTitle,
              'sm:hidden': props.mobileOnlyTitle,
            }}
          >
            {props.title}
          </h1>
        </div>

        <div class="flex items-center gap-2">{props.children}</div>
      </div>
    </header>
  );
}
