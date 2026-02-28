import { Menu } from 'lucide-solid';
import { Show, type JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

interface PageLayoutProps {
  title: JSXElement;
  /** Only show the title on mobile (hidden on sm+, where the page has its own heading).
   *  At lg+ the sidebar is always visible so the entire header bar is hidden. */
  mobileOnlyTitle?: boolean;
  /** Action buttons rendered on the right side of the header. */
  headerActions?: JSXElement;
  /** Extra classes for the content container (e.g. vertical padding overrides). */
  class?: string;
  children: JSXElement;
}

/**
 * Standard page layout: sticky header bar + content container.
 *
 * The header renders a hamburger menu (mobile), page title, and optional
 * action buttons on the right. The content is wrapped in a `content-container`.
 */
export function PageLayout(props: PageLayoutProps) {
  return (
    <>
      <header
        class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow"
        classList={{ 'lg:hidden': props.mobileOnlyTitle }}
      >
        <div class="content-container flex items-center justify-between py-3">
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

          <Show when={props.headerActions}>
            <div class="flex items-center gap-2">{props.headerActions}</div>
          </Show>
        </div>
      </header>

      <div class={twMerge('content-container py-3 sm:py-6', props.class)}>{props.children}</div>
    </>
  );
}
