import {
  DEFAULT_AUTO_ARCHIVE_DAYS,
  getEffectiveAutoArchiveDays,
  isAutoArchiveDaysDefault,
  type ArchiveResult,
} from '@repo/domain/client';
import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Header } from '~/components/Header';
import { $$exportOpml } from '~/entities/feeds.server';
import { settingsCollection, triggerAutoArchive, useSettings } from '~/entities/settings';

export const Route = createFileRoute('/_frame/settings')({
  component: SettingsPage,
});

export default function SettingsPage() {
  const settingsQuery = useSettings();
  const settings = () => settingsQuery.data;
  const [editMode, setEditMode] = createSignal(false);
  const [formData, setFormData] = createSignal<{
    theme?: 'light' | 'dark' | 'system';
    autoArchiveDays?: number | null;
  }>({});
  const [showMarkReadDialog, setShowMarkReadDialog] = createSignal(false);
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
    settingsCollection.update(currentSettings.userId, (draft) => {
      if (changes.theme !== undefined) draft.theme = changes.theme;
      if (changes.autoArchiveDays !== undefined) draft.autoArchiveDays = changes.autoArchiveDays;
    });
    setEditMode(false);
    setFormData({});
  };

  const handleTriggerAutoArchive = async () => {
    try {
      setIsArchiving(true);
      setArchiveError(null);
      const result = await triggerAutoArchive();
      setArchiveResult(result);
      setShowMarkReadDialog(true);
    } catch (err) {
      console.error('Failed to trigger auto-archive:', err);
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <Header title="Settings" />

      <div class="mx-auto w-full max-w-2xl px-2 py-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">
            Manage your application preferences and configuration.
          </p>
        </div>

        <Show when={settingsQuery.isLoading}>
          <div class="flex items-center justify-center py-8">
            <span class="loading loading-spinner loading-lg mr-3"></span>
            <span class="text-lg">Loading settings...</span>
          </div>
        </Show>

        <Show when={settingsQuery.isError}>
          <div class="alert alert-error">
            <span>Error loading settings</span>
          </div>
        </Show>

        <Show when={settings() && !settingsQuery.isLoading}>
          <div class="space-y-6">
            <Card>
              <Show when={!editMode()}>
                <div class="mb-4 flex items-center justify-between">
                  <h2 class="text-base-content font-semibold">Application Settings</h2>
                  <button
                    class="btn btn-primary btn-sm"
                    onClick={() => {
                      setFormData({
                        theme: settings()?.theme,
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
                    <span class="text-base-content-gray">Theme</span>
                    <span class="capitalize">{settings()!.theme}</span>
                  </div>
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
                      <span class="label-text font-medium">Theme</span>
                    </label>
                    <select
                      class="select select-bordered w-full"
                      value={formData().theme ?? settings()!.theme}
                      onChange={(e) => {
                        const value = e.target.value as 'light' | 'dark' | 'system';
                        setFormData({
                          ...formData(),
                          theme: value,
                        });
                      }}
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>

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
                  {JSON.stringify(settingsQuery.data, null, 2)}
                </pre>
              </div>
            </Card>
          </div>
        </Show>

        {/* Archive Result Dialog */}
        <Show when={showMarkReadDialog()}>
          <div class="modal modal-open">
            <div class="modal-box">
              <h3 class="mb-4 text-lg font-bold">Archive Results</h3>
              <Show when={archiveResult()}>
                <div class="space-y-3">
                  <div class="stat">
                    <div class="stat-title">Articles Archived</div>
                    <div class="stat-value text-2xl">{archiveResult()!.markedCount}</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Cutoff Date</div>
                    <div class="stat-desc">
                      {new Date(archiveResult()!.cutoffDate).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Show>
              <div class="modal-action">
                <button
                  class="btn btn-primary"
                  onClick={() => {
                    setShowMarkReadDialog(false);
                    setArchiveResult(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </>
  );
}
