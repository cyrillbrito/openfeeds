import type { UserUsage } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/solid-router';
import { createResource, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { $$getUserUsage } from '~/entities/settings.functions';

export const Route = createFileRoute('/_frame/settings/usage')({
  component: UsagePage,
});

function UsagePage() {
  return (
    <>
      <div class="mb-6">
        <p class="text-base-content-gray text-sm">
          Your current resource usage on the free plan. Limits will increase with paid plans.
        </p>
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

function UsageLimitsCard() {
  const [usage] = createResource(() => $$getUserUsage());

  return (
    <Card>
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-base-content font-semibold">Usage & Limits</h2>
          <p class="text-base-content-gray text-sm">Free plan</p>
        </div>
      </div>

      <Show
        when={!usage.loading}
        fallback={
          <div class="flex justify-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
        }
      >
        <Show when={usage()}>
          <div class="space-y-4">
            <For each={flattenUsage(usage()!)}>
              {(item) => {
                const pct = () => Math.round((item.used / item.limit) * 100);
                return (
                  <div>
                    <div class="mb-1 flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span class="text-base-content-gray">
                        {item.used} / {item.limit}
                      </span>
                    </div>
                    <progress
                      class={`progress w-full ${pct() >= 90 ? 'progress-error' : pct() >= 70 ? 'progress-warning' : 'progress-primary'}`}
                      value={item.used}
                      max={item.limit}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </Card>
  );
}
