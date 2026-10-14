import { Check, CircleAlert, CircleMinus, FileX, Plus, TriangleAlert, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, unwrap } from '~/lib/api-client';
import { LazyModal, type ModalController } from './LazyModal';

interface ImportOpmlModalProps {
  controller: (controller: ModalController) => void;
}

export function ImportOpmlModal({ controller }: ImportOpmlModalProps) {
  const modalRef = useRef<ModalController>(null!);

  return (
    <LazyModal
      controller={(ctrl) => {
        modalRef.current = ctrl;
        controller(ctrl);
      }}
      title="Import OPML File"
    >
      <ImportOpmlForm onClose={() => modalRef.current.close()} />
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

function ImportOpmlForm({ onClose }: ImportOpmlFormProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleImportOpml = async (content: string) => {
    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const data = await unwrap(
        api.api.feeds['import-opml'].$post({ json: { opmlContent: content } }),
      );
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
    onClose();
  };

  return (
    <>
      {isImporting ? (
        <div className="flex flex-col items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg mb-4"></span>
          <span className="text-lg">Importing feeds...</span>
          <span className="text-base-content/60 mt-2 text-sm">This may take a moment</span>
        </div>
      ) : importError ? (
        <div className="flex flex-col items-center py-8">
          <div className="bg-error/10 flex size-12 items-center justify-center rounded-full">
            <CircleAlert size={24} className="text-error" />
          </div>
          <p className="mt-3 text-lg font-medium">Import failed</p>
          <p className="text-base-content/60 mt-1 text-center text-sm">{importError}</p>
        </div>
      ) : importResult ? (
        <ImportResultView result={importResult} />
      ) : (
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Choose OPML File</span>
          </label>
          <input
            type="file"
            accept=".opml,.xml"
            className="file-input file-input-bordered w-full"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.addEventListener('load', (event) => {
                  const content = event.target?.result as string;
                  void handleImportOpml(content);
                });
                reader.addEventListener('error', (error) => {
                  console.error('[IMPORT UI] FileReader error:', error);
                });
                reader.readAsText(file);
              }
            }}
          />
          <label className="label">
            <span className="label-text-alt">
              Select an OPML file exported from your feed reader
            </span>
          </label>
        </div>
      )}

      <div className="modal-action">
        <button type="button" className="btn" onClick={handleClose} disabled={isImporting}>
          {importResult || importError ? 'Done' : 'Cancel'}
        </button>
      </div>
    </>
  );
}

function ImportResultView({ result }: { result: ImportResult }) {
  const noFeedsFound = result.found === 0;
  const allFailed = result.found > 0 && result.imported === 0 && result.failed.length > 0;
  const hasSuccesses = result.imported > 0;

  const heroIcon = noFeedsFound ? (
    <FileX size={32} className="text-base-content/70" strokeWidth={1.5} />
  ) : allFailed ? (
    <X size={32} className="text-error-content" strokeWidth={2.5} />
  ) : (
    <Check size={32} className="text-success" strokeWidth={2.5} />
  );

  const heroLabel = noFeedsFound ? 'No feeds found' : allFailed ? 'Import failed' : 'Import complete';

  const heroDescription = noFeedsFound
    ? 'The file may be empty or only contain folders without feeds.'
    : allFailed
      ? `All ${result.found} ${result.found === 1 ? 'feed' : 'feeds'} failed to import.`
      : null;

  const heroBgClass = noFeedsFound ? 'bg-base-300' : allFailed ? 'bg-error' : 'bg-success/15';

  return (
    <div className="flex flex-col items-center py-4">
      <div className={`flex size-16 items-center justify-center rounded-full ${heroBgClass}`}>
        {heroIcon}
      </div>
      <p className="mt-3 text-lg font-medium">{heroLabel}</p>
      {heroDescription && (
        <p className="text-base-content/60 mt-1 text-center text-sm">{heroDescription}</p>
      )}

      {!noFeedsFound && (
        <div className="text-base-content/60 mt-5 flex w-full flex-col items-center gap-3 text-sm">
          <div className="flex justify-center gap-6">
            {hasSuccesses && (
              <div className="flex items-center gap-1.5">
                <Plus size={14} className="text-success" />
                <span>{result.imported} imported</span>
              </div>
            )}
            {result.skipped > 0 && (
              <div className="flex items-center gap-1.5">
                <CircleMinus size={14} className="text-base-content/30" />
                <span>{result.skipped} already following</span>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="flex items-center gap-1.5">
                <TriangleAlert size={14} className="text-amber-600 dark:text-amber-400" />
                <span>{result.failed.length} failed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {result.failed.length > 0 && (
        <div className="bg-base-200 mt-4 w-full rounded-lg px-4 py-3">
          <p className="text-base-content/60 text-xs font-medium tracking-wide uppercase">
            Failed feeds
          </p>
          <ul className="text-base-content/80 mt-2 space-y-1 text-sm">
            {result.failed.map((feed, i) => (
              <li key={i}>{feed}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
