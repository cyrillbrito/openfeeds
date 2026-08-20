import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
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
      <div role="tablist" className="tabs tabs-border mb-6">
        {TABS.map((tab) => (
          <Link to={tab.to} role="tab" className="tab" activeProps={{ className: 'tab tab-active' }}>
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
