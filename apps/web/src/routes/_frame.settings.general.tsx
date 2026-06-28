import { getEffectiveAutoArchiveDays, type ArchiveResult } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { settingsCollection, triggerAutoArchive, useSettings } from '~/entities/settings';
import { api, unwrap } from '~/lib/api-client';

export const Route = createFileRoute('/_frame/settings/general')({
  component: SettingsGeneralPage,
});

function SettingsGeneralPage() {
  const { settings, isLoading, isError } = useSettings();
  const archiveResultModalRef = useRef<ModalController>(null!);
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleAutoArchiveDaysChange = (value: string) => {
    if (!settings) return;

    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) return;

    settingsCollection.update(settings.userId, (draft) => {
      draft.autoArchiveDays = parsed;
    });
  };

  const handleResetAutoArchiveDays = () => {
    if (!settings) return;

    settingsCollection.update(settings.userId, (draft) => {
      draft.autoArchiveDays = null;
    });
  };

  const handleExportOpml = async () => {
    try {
      setIsExporting(true);
      const opmlContent = await unwrap(api.api.feeds['export-opml'].$get({}));
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
      archiveResultModalRef.current.open();
    } catch (err) {
      console.error('Failed to trigger auto-archive:', err);
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-lg mr-3"></span>
          <span className="text-lg">Loading settings...</span>
        </div>
      )}

      {isError && (
        <div className="alert alert-error">
          <span>Error loading settings</span>
        </div>
      )}

      {settings && !isLoading && (
        <div className="space-y-8">
          <section>
            <h2 className="text-base-content mb-3 text-sm font-semibold tracking-wide uppercase opacity-60">
              Preferences
            </h2>
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base-content text-sm font-medium">Auto-archive articles</p>
                  <p className="text-base-content-gray text-xs">
                    Articles older than this are automatically archived.
                    {settings.autoArchiveDays !== null && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="link link-primary"
                          onClick={handleResetAutoArchiveDays}
                        >
                          Reset to default
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="number"
                    className="input input-bordered input-sm w-20 text-center"
                    min="1"
                    max="365"
                    value={getEffectiveAutoArchiveDays(settings)}
                    onChange={(e) => handleAutoArchiveDaysChange(e.target.value)}
                  />
                  <span className="text-base-content-gray text-sm">days</span>
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-base-content mb-3 text-sm font-semibold tracking-wide uppercase opacity-60">
              Data
            </h2>
            <Card>
              <div className="divide-base-300 divide-y">
                <div className="flex items-center justify-between gap-4 pb-4">
                  <div className="min-w-0">
                    <p className="text-base-content text-sm font-medium">Export feeds</p>
                    <p className="text-base-content-gray text-xs">
                      Download all your feeds as an OPML file.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm shrink-0"
                    onClick={handleExportOpml}
                    disabled={isExporting}
                  >
                    {isExporting && (
                      <span className="loading loading-spinner loading-xs mr-2"></span>
                    )}
                    Export OPML
                  </button>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base-content text-sm font-medium">Archive old articles</p>
                      <p className="text-base-content-gray text-xs">
                        Manually archive articles older than{' '}
                        {getEffectiveAutoArchiveDays(settings)} days.
                      </p>
                    </div>
                    <button
                      className="btn btn-warning btn-sm shrink-0"
                      onClick={handleTriggerAutoArchive}
                      disabled={isArchiving}
                    >
                      {isArchiving && (
                        <span className="loading loading-spinner loading-xs mr-2"></span>
                      )}
                      Archive now
                    </button>
                  </div>
                  {archiveError && (
                    <div className="alert alert-error alert-sm mt-3">
                      <span className="text-xs">Error: {archiveError}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </section>
        </div>
      )}

      <LazyModal
        controller={(c) => {
          archiveResultModalRef.current = c;
        }}
        title="Archive Results"
        onClose={() => setArchiveResult(null)}
      >
        {archiveResult && (
          <div className="space-y-3">
            <div className="stat">
              <div className="stat-title">Articles Archived</div>
              <div className="stat-value text-2xl">{archiveResult.markedCount}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Cutoff Date</div>
              <div className="stat-desc">
                {new Date(archiveResult.cutoffDate).toLocaleString()}
              </div>
            </div>
          </div>
        )}
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={() => archiveResultModalRef.current.close()}
          >
            Close
          </button>
        </div>
      </LazyModal>
    </>
  );
}
