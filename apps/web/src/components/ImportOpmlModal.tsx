import { useQueryClient } from '@tanstack/solid-query';
import { tagsCollection } from '~/entities/tags';
import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import CircleCheckIcon from 'lucide-solid/icons/circle-check';
import TriangleAlertIcon from 'lucide-solid/icons/triangle-alert';
import { createSignal, Match, Show, Switch } from 'solid-js';
import { useApi } from '../hooks/api';
import { queryKeys } from '../hooks/queries';
import { LazyModal, type ModalController } from './LazyModal';

interface ImportOpmlModalProps {
  controller: (controller: ModalController) => void;
}

export function ImportOpmlModal(props: ImportOpmlModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      title="Import OPML File"
    >
      <ImportOpmlForm onClose={() => modalController.close()} />
    </LazyModal>
  );
}

interface ImportOpmlFormProps {
  onClose: () => void;
}

function ImportOpmlForm(props: ImportOpmlFormProps) {
  console.log(`🎯 ImportOpmlForm: FRESH component created! Timestamp: ${Date.now()}`);

  const api = useApi();
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = createSignal(false);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [importResult, setImportResult] = createSignal<{
    imported: number;
    failed: string[];
  } | null>(null);

  const handleImportOpml = async (content: string) => {
    try {
      console.log('[IMPORT UI] Starting import');
      console.log('[IMPORT UI] Content length:', content.length);
      console.log('[IMPORT UI] Content preview (first 200 chars):', content.substring(0, 200));

      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const { data, error } = await api.import.opml.post({ opmlContent: content });
      if (error) {
        setImportError(error.value?.summary || error.value?.message || 'Request failed');
        return;
      }

      setImportResult(data);

      // Refresh data: feeds via invalidation, tags via refetch
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      tagsCollection.utils.refetch();

      if (data.failed.length === 0) {
        props.onClose();
      }
    } catch (err) {
      console.error('Failed to import OPML:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import OPML');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setImportError(null);
    setImportResult(null);
    props.onClose();
  };

  return (
    <>
      <Switch>
        <Match when={isImporting()}>
          <div class="flex flex-col items-center justify-center py-12">
            <span class="loading loading-spinner loading-lg mb-4"></span>
            <span class="text-lg">Importing feeds...</span>
            <span class="text-base-content/60 mt-2 text-sm">This may take a moment</span>
          </div>
        </Match>

        <Match when={importResult() || importError()}>
          <div class="mb-4">
            <Show when={importError()}>
              <div class="alert alert-error">
                <CircleAlertIcon size={20} />
                <span>{importError()}</span>
              </div>
            </Show>

            <Show when={importResult()}>
              <div class="alert alert-success mb-3">
                <CircleCheckIcon size={20} />
                <span>Successfully imported {importResult()!.imported} feeds</span>
              </div>

              <Show when={importResult()!.failed.length > 0}>
                <div class="alert alert-warning">
                  <TriangleAlertIcon size={20} />
                  <div>
                    <div class="font-bold">
                      Failed to import {importResult()!.failed.length} feeds:
                    </div>
                    <ul class="mt-2 list-inside list-disc text-sm">
                      {importResult()!.failed.map((feed) => (
                        <li>{feed}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </Match>

        <Match when={!isImporting() && !importResult() && !importError()}>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Choose OPML File</span>
            </label>
            <input
              type="file"
              accept=".opml,.xml"
              class="file-input file-input-bordered w-full"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) {
                  console.log(
                    '[IMPORT UI] File selected:',
                    file.name,
                    'type:',
                    file.type,
                    'size:',
                    file.size,
                  );
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    console.log('[IMPORT UI] File read complete');
                    void handleImportOpml(content);
                  };
                  reader.onerror = (error) => {
                    console.error('[IMPORT UI] FileReader error:', error);
                  };
                  reader.readAsText(file);
                }
              }}
            />
            <label class="label">
              <span class="label-text-alt">Select an OPML file exported from your RSS reader</span>
            </label>
          </div>
        </Match>
      </Switch>

      <div class="modal-action">
        <button type="button" class="btn" onClick={handleClose} disabled={isImporting()}>
          {importResult() ? 'Done' : 'Cancel'}
        </button>
      </div>
    </>
  );
}
