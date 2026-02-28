import { createFileRoute, Link, Outlet, redirect } from '@tanstack/solid-router';
import { Suspense } from 'solid-js';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';

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
  { label: 'Usage', to: '/settings/usage' as const },
  { label: 'Connections', to: '/settings/connections' as const },
] as const;

function SettingsLayout() {
  return (
    <PageLayout title="Settings">
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
    </PageLayout>
  );
}
