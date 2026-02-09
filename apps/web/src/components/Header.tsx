import { Menu } from 'lucide-solid';
import type { JSXElement } from 'solid-js';

interface HeaderProps {
  children?: JSXElement;
  title?: string;
}

export function Header(props: HeaderProps) {
  return (
    <header class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow">
      <div class="mx-auto flex w-full max-w-2xl items-center justify-between px-2 py-3 sm:px-6 xl:max-w-3xl">
        <div class="flex items-center gap-3">
          <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
            <Menu size={24} />
          </label>

          <h1 class="text-base-content hidden text-lg font-semibold sm:block">{props.title}</h1>
        </div>

        <div class="flex items-center gap-2">{props.children}</div>
      </div>
    </header>
  );
}
