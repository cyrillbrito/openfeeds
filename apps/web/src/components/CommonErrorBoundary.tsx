import { posthog } from 'posthog-js';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  const [showDetails, setShowDetails] = useState(false);

  console.error(error);
  posthog.captureException(error);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error && error.stack
      ? error.stack.replace(`${error.name}: ${error.message}\n`, '')
      : undefined;

  return (
    <div className="bg-base-300 rounded-lg p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <p className="text-error flex-1 font-mono text-sm wrap-break-word">{errorMessage}</p>
        <button className="btn btn-sm btn-primary shrink-0" onClick={resetErrorBoundary}>
          Retry
        </button>
      </div>

      {errorStack && (
        <>
          <button
            className="text-base-content/70 hover:text-base-content mt-3 text-xs underline"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <pre className="text-base-content/60 mt-2 max-h-32 overflow-x-auto overflow-y-auto text-xs break-words whitespace-pre-wrap">
              {errorStack}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

export function CommonErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
  );
}
