import { createFileRoute, Link, Outlet, redirect } from '@tanstack/solid-router';
import { Suspense } from 'solid-js';
import { Header } from '~/components/Header';
import { CenterLoader } from '~/components/Loader';

export const Route = createFileRoute('/_frame/settings')({
  component: SettingsLayout,
  beforeLoad: ({ location }) => {
    if (location.pathname === '/settings' || location.pathname === '/settings/') {
      throw redirect({ to: '/settings/general' });
    }
  },
});

const TABS = [
  { label: 'General', to: '/settings/general' as const },
  { label: 'Connections', to: '/settings/connections' as const },
] as const;

function SettingsLayout() {
  return (
    <>
      <Header title="Settings" />

      <div class="mx-auto w-full max-w-2xl px-2 py-3 sm:p-6 xl:max-w-3xl">
        <div role="tablist" class="tabs tabs-border mb-6">
          {TABS.map((tab) => (
            <Link to={tab.to} role="tab" class="tab" activeProps={{ class: 'tab tab-active' }}>
              {tab.label}
            </Link>
          ))}
        </div>

        <Suspense fallback={<CenterLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}
