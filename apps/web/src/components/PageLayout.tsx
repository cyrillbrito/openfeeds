import { Menu } from 'lucide-solid';
import { Show, type JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

type RenderSlot = JSXElement | (() => JSXElement);

const renderSlot = (slot: RenderSlot) => (typeof slot === 'function' ? slot() : slot);

interface PageLayoutProps {
  title: RenderSlot;
  /** Move the compact title/header into the page content at larger sizes. */
  responsiveTitle?: boolean;
  /** Optional desktop subtitle rendered under the page title. */
  subtitle?: JSXElement;
  /** Repeatable action renderer. Used in compact header and desktop page header. */
  actions?: () => JSXElement;
  /** Override or disable the desktop title block. */
  desktopTitle?: RenderSlot | false;
  /** Extra classes for the content container (e.g. vertical padding overrides). */
  class?: string;
  children: JSXElement;
}

/**
 * Standard page layout: sticky header bar + content container.
 *
 * The header renders a hamburger menu (mobile), page title, and optional
 * action buttons on the right. Responsive pages move the title/actions into
 * the content area on larger screens, where the sidebar replaces the header.
 */
export function PageLayout(props: PageLayoutProps) {
  const renderDesktopTitle = () => renderSlot(props.desktopTitle || props.title);
  const showDesktopHeader = () => props.responsiveTitle && props.desktopTitle !== false;

  return (
    <>
      <header
        class="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow print:hidden"
        classList={{ 'lg:hidden': props.responsiveTitle }}
      >
        <div class="content-container flex items-center justify-between py-3">
          <div class="flex items-center gap-3">
            <label for="my-drawer" class="btn btn-square btn-ghost lg:hidden">
              <Menu size={24} />
            </label>

            <h1
              class="text-base-content text-lg font-semibold"
              classList={{
                'hidden sm:block': !props.responsiveTitle,
                'sm:hidden': props.responsiveTitle,
              }}
            >
              {renderSlot(props.title)}
            </h1>
          </div>

          <Show when={props.actions}>
            {(actions) => <div class="flex items-center gap-2">{actions()()}</div>}
          </Show>
        </div>
      </header>

      <div class={twMerge('content-container py-3 sm:py-6', props.class)}>
        <Show when={showDesktopHeader()}>
          <div class="mb-4 hidden items-start justify-between gap-4 sm:flex">
            <div class="min-w-0">
              <h1 class="text-2xl font-bold sm:text-3xl">{renderDesktopTitle()}</h1>
              <Show when={props.subtitle}>
                <p class="text-base-content-gray mt-1">{props.subtitle}</p>
              </Show>
            </div>

            <Show when={props.actions}>
              {(actions) => <div class="hidden shrink-0 gap-2 lg:flex">{actions()()}</div>}
            </Show>
          </div>
        </Show>

        {props.children}
      </div>
    </>
  );
}
