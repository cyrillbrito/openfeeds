import { getEffectiveAutoArchiveDays, type ArchiveResult } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { $$exportOpml } from '~/entities/feeds.functions';
import { settingsCollection, triggerAutoArchive, useSettings } from '~/entities/settings';

export const Route = createFileRoute('/_frame/settings/general')({
  component: SettingsGeneralPage,
});

function SettingsGeneralPage() {
  const settings = useSettings();
  let archiveResultModalController!: ModalController;
  const [archiveResult, setArchiveResult] = createSignal<ArchiveResult | null>(null);
  const [isArchiving, setIsArchiving] = createSignal(false);
  const [archiveError, setArchiveError] = createSignal<string | null>(null);
  const [isExporting, setIsExporting] = createSignal(false);

  const handleAutoArchiveDaysChange = (value: string) => {
    const currentSettings = settings();
    if (!currentSettings) return;

    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) return;

    settingsCollection.update(currentSettings.userId, (draft) => {
      draft.autoArchiveDays = parsed;
    });
  };

  const handleResetAutoArchiveDays = () => {
    const currentSettings = settings();
    if (!currentSettings) return;

    settingsCollection.update(currentSettings.userId, (draft) => {
      draft.autoArchiveDays = null;
    });
  };

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
        <div class="space-y-8">
          {/* Preferences */}
          <section>
            <h2 class="text-base-content mb-3 text-sm font-semibold tracking-wide uppercase opacity-60">
              Preferences
            </h2>
            <Card>
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-base-content text-sm font-medium">Auto-archive articles</p>
                  <p class="text-base-content-gray text-xs">
                    Articles older than this are automatically archived.
                    <Show when={settings()!.autoArchiveDays !== null}>
                      {' '}
                      <button
                        type="button"
                        class="link link-primary"
                        onClick={handleResetAutoArchiveDays}
                      >
                        Reset to default
                      </button>
                    </Show>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <input
                    type="number"
                    class="input input-bordered input-sm w-20 text-center"
                    min="1"
                    max="365"
                    value={getEffectiveAutoArchiveDays(settings()!)}
                    onChange={(e) => handleAutoArchiveDaysChange(e.target.value)}
                  />
                  <span class="text-base-content-gray text-sm">days</span>
                </div>
              </div>
            </Card>
          </section>

          {/* Data */}
          <section>
            <h2 class="text-base-content mb-3 text-sm font-semibold tracking-wide uppercase opacity-60">
              Data
            </h2>
            <Card>
              <div class="divide-base-300 divide-y">
                <div class="flex items-center justify-between gap-4 pb-4">
                  <div class="min-w-0">
                    <p class="text-base-content text-sm font-medium">Export feeds</p>
                    <p class="text-base-content-gray text-xs">
                      Download all your feeds as an OPML file.
                    </p>
                  </div>
                  <button
                    class="btn btn-primary btn-sm shrink-0"
                    onClick={handleExportOpml}
                    disabled={isExporting()}
                  >
                    <Show when={isExporting()}>
                      <span class="loading loading-spinner loading-xs mr-2"></span>
                    </Show>
                    Export OPML
                  </button>
                </div>

                <div class="pt-4">
                  <div class="flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <p class="text-base-content text-sm font-medium">Archive old articles</p>
                      <p class="text-base-content-gray text-xs">
                        Manually archive articles older than{' '}
                        {getEffectiveAutoArchiveDays(settings()!)} days.
                      </p>
                    </div>
                    <button
                      class="btn btn-warning btn-sm shrink-0"
                      onClick={handleTriggerAutoArchive}
                      disabled={isArchiving()}
                    >
                      <Show when={isArchiving()}>
                        <span class="loading loading-spinner loading-xs mr-2"></span>
                      </Show>
                      Archive now
                    </button>
                  </div>
                  <Show when={archiveError()}>
                    <div class="alert alert-error alert-sm mt-3">
                      <span class="text-xs">Error: {archiveError()}</span>
                    </div>
                  </Show>
                </div>
              </div>
            </Card>
          </section>
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
