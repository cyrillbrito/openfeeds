import { Check, CircleAlert, CircleMinus, FileWarning, Plus, TriangleAlert, X } from 'lucide-solid';
import { createSignal, For, Match, Show, Switch } from 'solid-js';
import { $$importOpml } from '~/entities/feeds.server';
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

interface ImportResult {
  found: number;
  imported: number;
  skipped: number;
  failed: string[];
}

interface ImportOpmlFormProps {
  onClose: () => void;
}

function ImportOpmlForm(props: ImportOpmlFormProps) {
  const [isImporting, setIsImporting] = createSignal(false);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [importResult, setImportResult] = createSignal<ImportResult | null>(null);

  const handleImportOpml = async (content: string) => {
    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const data = await $$importOpml({ data: { opmlContent: content } });
      setImportResult(data);
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

        <Match when={importError()}>
          <div class="flex flex-col items-center py-8">
            <div class="bg-error/10 flex size-12 items-center justify-center rounded-full">
              <CircleAlert size={24} class="text-error" />
            </div>
            <p class="mt-3 text-lg font-medium">Import failed</p>
            <p class="text-base-content/60 mt-1 text-center text-sm">{importError()}</p>
          </div>
        </Match>

        <Match when={importResult()}>{(result) => <ImportResultView result={result()} />}</Match>

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
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
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
          {importResult() || importError() ? 'Done' : 'Cancel'}
        </button>
      </div>
    </>
  );
}

function ImportResultView(props: { result: ImportResult }) {
  const noFeedsFound = () => props.result.found === 0;
  const allFailed = () =>
    props.result.found > 0 && props.result.imported === 0 && props.result.failed.length > 0;
  const hasSuccesses = () => props.result.imported > 0;

  // Pick the hero state
  const heroIcon = () => {
    if (noFeedsFound()) return <FileWarning size={24} class="text-warning" />;
    if (allFailed()) return <X size={24} class="text-error" />;
    return <Check size={24} class="text-success" />;
  };

  const heroLabel = () => {
    if (noFeedsFound()) return 'No feeds found';
    if (allFailed()) return 'Import failed';
    return 'Import complete';
  };

  const heroDescription = () => {
    if (noFeedsFound()) return 'The file may be empty or only contain folders without feeds.';
    if (allFailed())
      return `All ${props.result.found} ${props.result.found === 1 ? 'feed' : 'feeds'} failed to import.`;
    return null;
  };

  const heroBgClass = () => {
    if (noFeedsFound()) return 'bg-warning/10';
    if (allFailed()) return 'bg-error/10';
    return 'bg-success/10';
  };

  return (
    <div class="flex flex-col items-center py-6">
      {/* Hero icon + label */}
      <div class={`flex size-12 items-center justify-center rounded-full ${heroBgClass()}`}>
        {heroIcon()}
      </div>
      <p class="mt-3 text-lg font-medium">{heroLabel()}</p>
      <Show when={heroDescription()}>
        <p class="text-base-content/60 mt-1 text-center text-sm">{heroDescription()}</p>
      </Show>

      {/* Stats row */}
      <Show when={!noFeedsFound()}>
        <div class="text-base-content/60 mt-5 flex w-full flex-col items-center gap-3 text-sm">
          <div class="flex justify-center gap-6">
            <Show when={hasSuccesses()}>
              <div class="flex items-center gap-1.5">
                <Plus size={14} class="text-success" />
                <span>{props.result.imported} imported</span>
              </div>
            </Show>
            <Show when={props.result.skipped > 0}>
              <div class="flex items-center gap-1.5">
                <CircleMinus size={14} class="text-base-content/30" />
                <span>{props.result.skipped} already subscribed</span>
              </div>
            </Show>
            <Show when={props.result.failed.length > 0}>
              <div class="flex items-center gap-1.5">
                <TriangleAlert size={14} class="text-warning" />
                <span>{props.result.failed.length} failed</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Failed feeds detail */}
      <Show when={props.result.failed.length > 0}>
        <div class="bg-base-200 mt-4 w-full rounded-lg px-4 py-3">
          <p class="text-base-content/60 text-xs font-medium tracking-wide uppercase">
            Failed feeds
          </p>
          <ul class="text-base-content/80 mt-2 space-y-1 text-sm">
            <For each={props.result.failed}>{(feed) => <li>{feed}</li>}</For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
