import type { UserUsage } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Card } from '~/components/Card';
import { api, unwrap } from '~/lib/api-client';

export const Route = createFileRoute('/_frame/settings/usage')({
  component: UsagePage,
});

function UsagePage() {
  return (
    <>
      <div className="mb-6">
        <p className="text-base-content-gray text-sm">Your current resource usage and limits.</p>
      </div>

      <UsageLimitsCard />
    </>
  );
}

function flattenUsage(usage: UserUsage) {
  return [
    { label: 'Feed subscriptions', ...usage.feeds },
    { label: 'Filter rules', ...usage.filterRules },
    { label: 'Saved articles', ...usage.savedArticles },
    { label: 'Daily extractions', ...usage.extractions.daily },
    { label: 'Monthly extractions', ...usage.extractions.monthly },
    { label: 'Daily TTS generations', ...usage.tts.daily },
    { label: 'Monthly TTS generations', ...usage.tts.monthly },
  ];
}

function isUnlimited(limit: number | null) {
  return limit === null;
}

function UsageLimitsCard() {
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unwrap(api.api.settings.usage.$get({}))
      .then(setUsage)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base-content font-semibold">Usage & Limits</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-sm"></span>
        </div>
      ) : usage ? (
        <div className="space-y-4">
          {flattenUsage(usage).map((item) => {
            const unlimited = isUnlimited(item.limit);
            const pct = unlimited ? 0 : Math.round((item.used / item.limit!) * 100);
            return (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-base-content-gray">
                    {unlimited ? item.used : `${item.used} / ${item.limit}`}
                  </span>
                </div>
                {!unlimited && (
                  <progress
                    className={`progress w-full ${pct >= 90 ? 'progress-error' : pct >= 70 ? 'progress-warning' : 'progress-primary'}`}
                    value={item.used}
                    max={item.limit!}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
