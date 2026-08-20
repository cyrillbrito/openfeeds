import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { Compass, Inbox, Plus, Rss, Sparkles } from 'lucide-react';
import { posthog } from 'posthog-js';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AiFab } from '~/components/chat/AiFab';
import { AiPopover } from '~/components/chat/AiPopover';
import { ChatProvider } from '~/components/chat/chat-context';
import { ColorIndicator } from '~/components/ColorIndicator';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
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
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Identify user for PostHog when session is available
  useEffect(() => {
    const user = session.data?.user;
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        created_at: user.createdAt,
      });
    }
  }, [session.data?.user]);

  // Close sidebar drawer on navigation (mobile only)
  useEffect(() => {
    const drawerCheckbox = document.getElementById('my-drawer') as HTMLInputElement | null;
    if (drawerCheckbox) {
      drawerCheckbox.checked = false;
    }
  }, [location.pathname]);

  // Cmd+J / Ctrl+J to toggle popover
  useEffect(() => {
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
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const showFab = !popoverOpen && !location.pathname.startsWith('/ai');

  const handleFabClick = () => {
    if (window.innerWidth < 1024) {
      void navigate({ to: '/ai' });
      return;
    }
    setPopoverOpen(true);
  };

  return (
    <ChatProvider>
      <div className="drawer lg:drawer-open">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex min-h-dvh">
          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<CenterLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>

        <div className="drawer-side z-10 shadow-sm">
          <label htmlFor="my-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
          <aside className="menu bg-base-100 border-base-300 flex h-dvh w-80 flex-col flex-nowrap border-r !px-0 !pt-4 !pb-2">
            <Link to="/inbox" className="mt-2 flex items-center justify-center gap-2 px-4">
              <img src="/logo.svg" className="h-10 w-10" alt="OpenFeeds logo" />
              <h2 className="text-lg font-bold">OpenFeeds</h2>
            </Link>
            <div className="divider mx-4"></div>

            <div className="flex-1 overflow-y-auto pr-2 pl-4">
              <ul className="mb-6 space-y-1">
                <li>
                  <Link
                    to="/discover"
                    className="flex items-center gap-3"
                    activeProps={{ className: 'menu-active' }}
                  >
                    <Compass size={20} />
                    Discover
                  </Link>
                </li>
                <li>
                  <Link
                    to="/inbox"
                    className="flex items-center gap-3"
                    activeProps={{ className: 'menu-active' }}
                  >
                    <Inbox size={20} />
                    Inbox
                  </Link>
                </li>
                <li>
                  <Link
                    to="/feeds"
                    className="flex items-center gap-3"
                    activeProps={{ className: 'menu-active' }}
                  >
                    <Rss size={20} />
                    Feeds
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ai"
                    className="flex items-center gap-3"
                    activeProps={{ className: 'menu-active' }}
                  >
                    <Sparkles size={20} />
                    AI Chat
                  </Link>
                </li>
              </ul>

              <div className="divider"></div>

              <DrawerTags />
            </div>

            <div className="divider mx-4"></div>
            <div className="px-4">
              <UserMenu />
            </div>
          </aside>
        </div>
      </div>

      {showFab && <AiFab onClick={handleFabClick} />}
      <AiPopover
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        onExpand={(sessionId, hasMessages) => {
          if (hasMessages) {
            void navigate({ to: '/ai/$sessionId', params: { sessionId } });
          } else {
            void navigate({ to: '/ai' });
          }
        }}
      />
    </ChatProvider>
  );
}

function DrawerTags() {
  const tags = useTags();
  const createModalRef = useRef<ModalController>(null!);

  return (
    <div className="flex-1">
      <TagModal
        controller={(c) => {
          createModalRef.current = c;
        }}
      />

      <div className="flex">
        <Link
          to="/tags"
          className="text-base-content-gray hover:text-base-content flex flex-1 items-center gap-2 text-sm font-semibold tracking-wide uppercase transition-colors"
        >
          Tags
        </Link>

        <button
          className="btn btn-circle btn-ghost btn-xs hover:btn-info ml-auto"
          onClick={() => createModalRef.current.open()}
          title="Add new tag"
        >
          <Plus size={12} className="text-base-content-gray" />
        </button>
      </div>

      <ul className="menu rounded-box w-full">
        {tags.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-base-content/50 mb-3 text-sm">No tags yet</p>
            <Link to="/tags" className="btn btn-xs btn-outline">
              Create Tags
            </Link>
          </div>
        ) : (
          tags.map((tag) => (
            <li key={tag.id}>
              <Link
                to="/tags/$tagId"
                params={{ tagId: tag.id }}
                className="flex items-center gap-3"
                activeProps={{ className: 'menu-active' }}
              >
                <ColorIndicator className={getTagDotColor(tag.color)} />
                {tag.name}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
