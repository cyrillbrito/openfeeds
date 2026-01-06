import type { ArchiveResult } from '@repo/shared/types';
import { createFileRoute } from '@tanstack/solid-router';
import { createSignal, Show } from 'solid-js';
import { triggerAutoArchive, updateSettings, useSettings } from '~/entities/settings';
import { Card } from '../components/Card';
import { Header } from '../components/Header';

export const Route = createFileRoute('/_frame/settings')({
  component: SettingsPage,
});

export default function SettingsPage() {
  const settingsQuery = useSettings();
  const [editMode, setEditMode] = createSignal(false);
  const [formData, setFormData] = createSignal<{ theme?: 'light' | 'dark' | 'system'; autoArchiveDays?: number }>({});
  const [showMarkReadDialog, setShowMarkReadDialog] = createSignal(false);
  const [archiveResult, setArchiveResult] = createSignal<ArchiveResult | null>(null);
  const [isArchiving, setIsArchiving] = createSignal(false);
  const [archiveError, setArchiveError] = createSignal<string | null>(null);

  const handleUpdate = () => {
    updateSettings(formData());
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

      <div class="container mx-auto p-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">
            Manage your application preferences and configuration.
          </p>
        </div>

        <Card>
          <Show when={settingsQuery.isLoading}>
            <div class="flex items-center justify-center py-8">
              <span class="loading loading-spinner loading-lg mr-3"></span>
              <span class="text-lg">Loading settings...</span>
            </div>
          </Show>

          <Show when={settingsQuery.isError}>
            <div class="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Error loading settings</span>
            </div>
          </Show>

          <Show when={settingsQuery.data && !settingsQuery.isLoading}>
            <div class="space-y-6">
              <Show when={!editMode()}>
                <div>
                  <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-base-content text-lg font-semibold">Application Settings</h2>
                    <button
                      class="btn btn-primary btn-sm"
                      onClick={() => {
                        setFormData({ ...settingsQuery.data });
                        setEditMode(true);
                      }}
                    >
                      Edit Settings
                    </button>
                  </div>

                  <div class="space-y-4">
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text font-medium">Theme</span>
                      </label>
                      <div class="text-base-content capitalize">{settingsQuery.data!.theme}</div>
                    </div>

                    <div class="form-control">
                      <label class="label">
                        <span class="label-text font-medium">Auto-archive after</span>
                      </label>
                      <div class="text-base-content">
                        {settingsQuery.data!.autoArchiveDays} days
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              <Show when={editMode()}>
                <div>
                  <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-base-content text-lg font-semibold">Edit Settings</h2>
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
                        value={formData().theme || settingsQuery.data!.theme}
                        onChange={(e) =>
                          setFormData({
                            ...formData(),
                            theme: e.target.value as 'light' | 'dark' | 'system',
                          })
                        }
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
                        value={formData().autoArchiveDays || settingsQuery.data!.autoArchiveDays}
                        onInput={(e) =>
                          setFormData({
                            ...formData(),
                            autoArchiveDays: parseInt(e.target.value),
                          })
                        }
                      />
                      <label class="label">
                        <span class="label-text-alt text-base-content-gray">
                          Articles older than this will be automatically archived
                        </span>
                      </label>
                    </div>
                  </div>

                </div>
              </Show>

              <div class="divider"></div>

              <div>
                <h3 class="text-md text-base-content mb-3 font-medium">Maintenance Actions</h3>
                <div class="space-y-4">
                  <Card>
                    <h4 class="card-title text-base">Archive Old Articles</h4>
                    <p class="text-base-content-gray mb-4 text-sm">
                      Manually trigger the auto-archive process to archive all articles older than{' '}
                      {settingsQuery.data?.autoArchiveDays} days.
                    </p>
                    <div class="card-actions">
                      <button
                        class="btn btn-warning btn-sm"
                        onClick={handleTriggerAutoArchive}
                        disabled={isArchiving()}
                      >
                        <Show when={isArchiving()}>
                          <span class="loading loading-spinner loading-xs mr-2"></span>
                        </Show>
                        Archive Old Articles
                      </button>
                    </div>
                    <Show when={archiveError()}>
                      <div class="alert alert-error alert-sm mt-2">
                        <span class="text-xs">
                          Error: {archiveError()}
                        </span>
                      </div>
                    </Show>
                  </Card>
                </div>
              </div>

              <div class="divider"></div>

              <div>
                <h3 class="text-md text-base-content mb-3 font-medium">Debug Information</h3>
                <div class="bg-neutral overflow-auto rounded p-4">
                  <pre class="text-neutral-content text-sm whitespace-pre-wrap">
                    {JSON.stringify(settingsQuery.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </Show>
        </Card>

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
