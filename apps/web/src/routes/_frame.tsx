import { ClientOnly, createFileRoute, Link, Outlet, useLocation } from '@tanstack/solid-router';
import { BookmarkPlus, Inbox, Library, Plus, Search } from 'lucide-solid';
import posthog from 'posthog-js';
import { createEffect, For, on, onMount, Suspense } from 'solid-js';
import { AddFeedModal } from '~/components/AddFeedModal';
import { ColorIndicator } from '~/components/ColorIndicator';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader, Loader } from '~/components/Loader';
import { SaveArticleModal } from '~/components/SaveArticleModal';
import { TagModal } from '~/components/TagModal';
import { UserMenu } from '~/components/UserMenu';
import { useTags } from '~/entities/tags';
import { authClient } from '~/lib/auth-client';
import { authGuard } from '~/lib/guards';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame')({
  beforeLoad: async ({ location }) => {
    await authGuard(location);
  },
  component: FrameLayout,
});

function FrameLayout() {
  let addFeedModalController!: ModalController;
  let saveArticleModalController!: ModalController;
  const location = useLocation();
  const session = authClient.useSession();

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

  // Close drawer on navigation (mobile only) - runs only on client
  onMount(() => {
    createEffect(() => {
      void location().pathname; // Track pathname changes
      const drawerCheckbox = document.getElementById('my-drawer') as HTMLInputElement;
      if (drawerCheckbox) {
        drawerCheckbox.checked = false;
      }
    });
  });

  return (
    <>
      <AddFeedModal controller={(controller) => (addFeedModalController = controller)} />
      <SaveArticleModal controller={(controller) => (saveArticleModalController = controller)} />

      <div class="drawer lg:drawer-open">
        <input id="my-drawer" type="checkbox" class="drawer-toggle" />
        {/* min-h-dvh instead of min-h-screen to handle mobile browser UI (address bar) correctly on rotation */}
        <div class="drawer-content flex min-h-dvh flex-col">
          <ClientOnly fallback={<CenterLoader />}>
            <Suspense fallback={<CenterLoader />}>
              <Outlet />
            </Suspense>
          </ClientOnly>
        </div>

        <div class="drawer-side z-10 shadow-sm">
          <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          {/* h-dvh instead of h-screen to handle mobile browser UI correctly on rotation */}
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
                      to="/inbox"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Inbox size={20} />
                      Inbox
                    </Link>
                  </li>
                  <li>
                    <button
                      class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                      onClick={() => addFeedModalController.open()}
                    >
                      <Search size={20} />
                      Discover
                    </button>
                  </li>
                  <li>
                    <button
                      class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                      onClick={() => saveArticleModalController.open()}
                    >
                      <BookmarkPlus size={20} />
                      Save Article
                    </button>
                  </li>
                  <li>
                    <Link
                      to="/feeds"
                      class="flex items-center gap-3"
                      activeProps={{ class: 'menu-active' }}
                    >
                      <Library size={20} />
                      Manage Feeds
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
    </>
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
