import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/solid-router';
import { useTags } from '~/entities/tags';
import { authMiddleware } from '~/server/middleware/auth.ts';
import InboxIcon from 'lucide-solid/icons/inbox';
import LibraryIcon from 'lucide-solid/icons/library';
import PlusIcon from 'lucide-solid/icons/plus';
import SearchIcon from 'lucide-solid/icons/search';
import { createEffect, For, Suspense } from 'solid-js';
import { AddFeedModal } from '../components/AddFeedModal';
import { ColorIndicator } from '../components/ColorIndicator';
import { type ModalController } from '../components/LazyModal';
import { CenterLoader, Loader } from '../components/Loader.tsx';
import { TagModal } from '../components/TagModal.tsx';
import { UserMenu } from '../components/UserMenu.tsx';
import { getTagDotColor } from '../utils/tagColors';

export const Route = createFileRoute('/_frame')({
  server: {
    middleware: [authMiddleware],
  },
  component: FrameLayout,
});

function FrameLayout() {
  let addFeedModalController!: ModalController;
  const location = useLocation();

  // Close drawer on navigation (mobile only)
  createEffect(() => {
    void location().pathname; // Track pathname changes
    const drawerCheckbox = document.getElementById('my-drawer') as HTMLInputElement;
    if (drawerCheckbox) {
      drawerCheckbox.checked = false;
    }
  });

  return (
    <>
      <AddFeedModal controller={(controller) => (addFeedModalController = controller)} />

      <div class="drawer lg:drawer-open">
        <input id="my-drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex min-h-screen flex-col">
          <Suspense
            fallback={
              <>
                {() => {
                  console.info('Suspense _frame');
                  return <CenterLoader />;
                }}
              </>
            }
          >
            <Outlet />
          </Suspense>
        </div>

        <div class="drawer-side z-10 shadow-sm">
          <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          <aside class="menu bg-base-100 border-base-300 flex h-screen w-80 flex-col flex-nowrap border-r p-4">
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
                    <InboxIcon size={20} />
                    Inbox
                  </Link>
                </li>
                <li>
                  <button
                    class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    onClick={() => addFeedModalController.open()}
                  >
                    <SearchIcon size={20} />
                    Discover
                  </button>
                </li>
                <li>
                  <Link
                    to="/feeds"
                    class="flex items-center gap-3"
                    activeProps={{ class: 'menu-active' }}
                  >
                    <LibraryIcon size={20} />
                    Manage Feeds
                  </Link>
                </li>
              </ul>

              <div class="divider"></div>

              <DrawerTags />
            </div>

            <div class="divider"></div>
            <UserMenu />
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
          <PlusIcon size={12} class="text-base-content-gray" />
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
            each={tags$.data}
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
