import {
  ClientOnly,
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/solid-router';
import { Compass, Inbox, Plus, Rss, Sparkles } from 'lucide-solid';
import { posthog } from 'posthog-js';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, Suspense } from 'solid-js';
import { AiFab } from '~/components/chat/AiFab';
import { AiPopover } from '~/components/chat/AiPopover';
import { ChatProvider } from '~/components/chat/chat-context';
import { ColorIndicator } from '~/components/ColorIndicator';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader, Loader } from '~/components/Loader';
import { TagModal } from '~/components/TagModal';
import { UserMenu } from '~/components/UserMenu';
import { useTags } from '~/entities/tags';
import { authClient } from '~/lib/auth-client';
import { authGuard } from '~/lib/guards';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame')({
  beforeLoad: async (ctx) => {
    await authGuard(ctx.location);
  },
  component: FrameLayout,
});

function FrameLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [popoverOpen, setPopoverOpen] = createSignal(false);

  // Identify user for PostHog when session is available
  createEffect(
    on(
      () => session().data?.user,
      (user) => {
        if (user) {
          posthog.identify(user.id, {
            email: user.email,
            name: user.name,
          });
        }
      },
    ),
  );

  // Close sidebar drawer on navigation (mobile only) - runs only on client
  onMount(() => {
    createEffect(() => {
      void location().pathname;
      const drawerCheckbox = document.getElementById('my-drawer') as HTMLInputElement;
      if (drawerCheckbox) {
        drawerCheckbox.checked = false;
      }
    });
  });

  // Cmd+J / Ctrl+J to toggle popover
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          void navigate({ to: '/ai' });
          return;
        }
        setPopoverOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  // Hide FAB when popover is open or on /ai route
  const showFab = () => !popoverOpen() && !location().pathname.startsWith('/ai');

  const handleFabClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      void navigate({ to: '/ai' });
      return;
    }
    setPopoverOpen(true);
  };

  return (
    <ChatProvider>
      <div class="drawer lg:drawer-open">
        <input id="my-drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex min-h-dvh">
          {/* Main content */}
          <div class="flex min-w-0 flex-1 flex-col">
            <ClientOnly fallback={<CenterLoader />}>
              <Suspense fallback={<CenterLoader />}>
                <Outlet />
              </Suspense>
            </ClientOnly>
          </div>
        </div>

        <div class="drawer-side z-10 shadow-sm">
          <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          <aside class="menu bg-base-100 border-base-300 flex h-dvh w-80 flex-col flex-nowrap border-r px-4 pt-4 pb-2">
            <ClientOnly fallback={<CenterLoader />}>
              {/* Menu Header */}
              <div class="mt-2 flex items-center justify-center gap-2">
                <img src="/logo.svg" class="h-10 w-10" alt="OpenFeeds logo" />
                <h2 class="text-lg font-bold">OpenFeeds</h2>
              </div>
              <div class="divider"></div>

              <div class="flex-1 overflow-y-auto">
                {/* Navigation */}
                <ul class="mb-6 space-y-1">
                  <li>
                    <Link
                      to="/discover"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Compass size={20} />
                      Discover
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/inbox"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Inbox size={20} />
                      Inbox
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/feeds"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Rss size={20} />
                      Feeds
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/ai"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Sparkles size={20} />
                      AI Chat
                    </Link>
                  </li>
                </ul>

                <div class="divider"></div>

                <DrawerTags />
              </div>

              <div class="divider"></div>
              <UserMenu />
            </ClientOnly>
          </aside>
        </div>
      </div>

      {/* AI surfaces */}
      <ClientOnly>
        <Show when={showFab()}>
          <AiFab onClick={handleFabClick} />
        </Show>
        <AiPopover
          open={popoverOpen()}
          onClose={() => setPopoverOpen(false)}
          onExpand={(sessionId, hasMessages) => {
            if (hasMessages) {
              void navigate({ to: '/ai/$sessionId', params: { sessionId } });
            } else {
              void navigate({ to: '/ai' });
            }
          }}
        />
      </ClientOnly>
    </ChatProvider>
  );
}

function DrawerTags() {
  const tags$ = useTags();
  let createModalController!: ModalController;

  return (
    <div class="flex-1">
      <TagModal controller={(controller) => (createModalController = controller)} />

      <div class="flex px-4">
        <Link
          to="/tags"
          class="text-base-content-gray hover:text-base-content flex flex-1 items-center gap-2 text-sm font-semibold tracking-wide uppercase transition-colors"
        >
          Tags
        </Link>

        <button
          class="btn btn-circle btn-ghost btn-xs hover:btn-info ml-auto"
          onClick={() => createModalController.open()}
          title="Add new tag"
        >
          <Plus size={12} class="text-base-content-gray" />
        </button>
      </div>
      <Suspense
        fallback={
          <div class="flex justify-center">
            <Loader />
          </div>
        }
      >
        <ul class="menu rounded-box w-full">
          <For
            each={tags$()}
            fallback={
              <div class="py-4 text-center">
                <p class="text-base-content/50 mb-3 text-sm">No tags yet</p>
                <Link to="/tags" class="btn btn-xs btn-outline">
                  Create Tags
                </Link>
              </div>
            }
          >
            {(tag) => (
              <li>
                <Link
                  to="/tags/$tagId"
                  params={{ tagId: tag.id.toString() }}
                  class="flex items-center gap-3"
                  activeProps={{ class: 'menu-active' }}
                >
                  <ColorIndicator class={getTagDotColor(tag.color)} />
                  {tag.name}
                </Link>
              </li>
            )}
          </For>
        </ul>
      </Suspense>
    </div>
  );
}
