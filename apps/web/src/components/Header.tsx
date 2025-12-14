import MenuIcon from 'lucide-solid/icons/menu';
import type { JSXElement } from 'solid-js';

interface HeaderProps {
  children?: JSXElement;
  title?: string;
}

export function Header(props: HeaderProps) {
  return (
    <header class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow">
      <div class="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
            <MenuIcon size={24} />
          </label>

          <h1 class="text-base-content hidden text-lg font-semibold sm:block">{props.title}</h1>
        </div>

        <div class="flex items-center gap-2">{props.children}</div>
      </div>
    </header>
  );
}
