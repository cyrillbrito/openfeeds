import {
  DEFAULT_AUTO_ARCHIVE_DAYS,
  getEffectiveAutoArchiveDays,
  isAutoArchiveDaysDefault,
  type ArchiveResult,
  type UserUsage,
} from '@repo/domain/client';
import { createFileRoute } from '@tanstack/solid-router';
import { createResource, createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { $$exportOpml } from '~/entities/feeds.server';
import { settingsCollection, triggerAutoArchive, useSettings } from '~/entities/settings';
import { $$getUserUsage } from '~/entities/settings.server';

export const Route = createFileRoute('/_frame/settings/general')({
  component: SettingsGeneralPage,
});

function SettingsGeneralPage() {
  const settings = useSettings();
  const [editMode, setEditMode] = createSignal(false);
  const [formData, setFormData] = createSignal<{
    autoArchiveDays?: number | null;
  }>({});
  let archiveResultModalController!: ModalController;
  const [archiveResult, setArchiveResult] = createSignal<ArchiveResult | null>(null);
  const [isArchiving, setIsArchiving] = createSignal(false);
  const [archiveError, setArchiveError] = createSignal<string | null>(null);
  const [isExporting, setIsExporting] = createSignal(false);

  const handleExportOpml = async () => {
    try {
      setIsExporting(true);
      const opmlContent = await $$exportOpml();
      const blob = new Blob([opmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'openfeeds-export.opml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export OPML:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdate = () => {
    const currentSettings = settings();
    if (!currentSettings) return;

    const changes = formData();
    const { autoArchiveDays } = changes;
    if (autoArchiveDays !== undefined) {
      settingsCollection.update(currentSettings.userId, (draft) => {
        draft.autoArchiveDays = autoArchiveDays;
      });
    }

    setEditMode(false);
    setFormData({});
  };

  const handleTriggerAutoArchive = async () => {
    try {
      setIsArchiving(true);
      setArchiveError(null);
      const result = await triggerAutoArchive();
      setArchiveResult(result);
      archiveResultModalController.open();
    } catch (err) {
      console.error('Failed to trigger auto-archive:', err);
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <Show when={settings.isLoading}>
        <div class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-lg mr-3"></span>
          <span class="text-lg">Loading settings...</span>
        </div>
      </Show>

      <Show when={settings.isError}>
        <div class="alert alert-error">
          <span>Error loading settings</span>
        </div>
      </Show>

      <Show when={settings() && !settings.isLoading}>
        <div class="space-y-6">
          <UsageLimitsCard />

          <Card>
            <Show when={!editMode()}>
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-base-content font-semibold">Application Settings</h2>
                <button
                  class="btn btn-primary btn-sm"
                  onClick={() => {
                    setFormData({
                      autoArchiveDays: settings()?.autoArchiveDays,
                    });
                    setEditMode(true);
                  }}
                >
                  Edit
                </button>
              </div>

              <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-base-content-gray">Auto-archive after</span>
                  <span>
                    {getEffectiveAutoArchiveDays(settings()!)} days
                    <Show when={isAutoArchiveDaysDefault(settings()!)}>
                      <span class="text-base-content-gray ml-1">(default)</span>
                    </Show>
                  </span>
                </div>
              </div>
            </Show>

            <Show when={editMode()}>
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-base-content font-semibold">Edit Settings</h2>
                <div class="space-x-2">
                  <button
                    class="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditMode(false);
                      setFormData({});
                    }}
                  >
                    Cancel
                  </button>
                  <button class="btn btn-primary btn-sm" onClick={handleUpdate}>
                    Save
                  </button>
                </div>
              </div>

              <div class="space-y-4">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-medium">Auto-archive after (days)</span>
                  </label>
                  <input
                    type="number"
                    class="input input-bordered w-full"
                    min="1"
                    max="365"
                    value={formData().autoArchiveDays ?? getEffectiveAutoArchiveDays(settings()!)}
                    onInput={(e) =>
                      setFormData({
                        ...formData(),
                        autoArchiveDays: parseInt(e.target.value),
                      })
                    }
                  />
                  <label class="label">
                    <span class="label-text-alt text-base-content-gray">
                      Articles older than this will be automatically archived (default:{' '}
                      {DEFAULT_AUTO_ARCHIVE_DAYS} days).{' '}
                      <button
                        type="button"
                        class="link link-primary"
                        onClick={() => setFormData({ ...formData(), autoArchiveDays: null })}
                      >
                        Reset to default
                      </button>
                    </span>
                  </label>
                </div>
              </div>
            </Show>
          </Card>

          <Card>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold">Export Feeds</h3>
                <p class="text-base-content-gray text-sm">Download your feeds as OPML</p>
              </div>
              <button
                class="btn btn-primary btn-sm"
                onClick={handleExportOpml}
                disabled={isExporting()}
              >
                <Show when={isExporting()}>
                  <span class="loading loading-spinner loading-xs mr-2"></span>
                </Show>
                Export
              </button>
            </div>
          </Card>

          <Card>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold">Archive Old Articles</h3>
                <p class="text-base-content-gray text-sm">
                  Archive articles older than {getEffectiveAutoArchiveDays(settings()!)} days
                </p>
              </div>
              <button
                class="btn btn-warning btn-sm"
                onClick={handleTriggerAutoArchive}
                disabled={isArchiving()}
              >
                <Show when={isArchiving()}>
                  <span class="loading loading-spinner loading-xs mr-2"></span>
                </Show>
                Archive
              </button>
            </div>
            <Show when={archiveError()}>
              <div class="alert alert-error alert-sm mt-2">
                <span class="text-xs">Error: {archiveError()}</span>
              </div>
            </Show>
          </Card>

          <Card>
            <h3 class="mb-2 font-semibold">Debug Information</h3>
            <div class="bg-neutral overflow-auto rounded p-3">
              <pre class="text-neutral-content text-xs whitespace-pre-wrap">
                {JSON.stringify(settings(), null, 2)}
              </pre>
            </div>
          </Card>
        </div>
      </Show>

      {/* Archive Result Dialog */}
      <LazyModal
        controller={(c) => (archiveResultModalController = c)}
        title="Archive Results"
        onClose={() => setArchiveResult(null)}
      >
        <Show when={archiveResult()}>
          <div class="space-y-3">
            <div class="stat">
              <div class="stat-title">Articles Archived</div>
              <div class="stat-value text-2xl">{archiveResult()!.markedCount}</div>
            </div>
            <div class="stat">
              <div class="stat-title">Cutoff Date</div>
              <div class="stat-desc">{new Date(archiveResult()!.cutoffDate).toLocaleString()}</div>
            </div>
          </div>
        </Show>
        <div class="modal-action">
          <button class="btn btn-primary" onClick={() => archiveResultModalController.close()}>
            Close
          </button>
        </div>
      </LazyModal>
    </>
  );
}

const USAGE_LABELS: Record<keyof UserUsage, string> = {
  feeds: 'Feed subscriptions',
  filterRules: 'Filter rules',
  savedArticles: 'Saved articles',
};

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
            <For each={Object.keys(usage()!) as (keyof UserUsage)[]}>
              {(key) => {
                const item = () => usage()![key];
                const pct = () => Math.round((item().used / item().limit) * 100);
                return (
                  <div>
                    <div class="mb-1 flex justify-between text-sm">
                      <span>{USAGE_LABELS[key]}</span>
                      <span class="text-base-content-gray">
                        {item().used} / {item().limit}
                      </span>
                    </div>
                    <progress
                      class={`progress w-full ${pct() >= 90 ? 'progress-error' : pct() >= 70 ? 'progress-warning' : 'progress-primary'}`}
                      value={item().used}
                      max={item().limit}
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
