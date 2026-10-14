import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useState } from 'react';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  console.error('DefaultCatchBoundary Error:', error);
  posthog.captureException(error);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error && error.stack
      ? error.stack.replace(`${error.name}: ${error.message}\n`, '')
      : undefined;

  return (
    <div className="hero bg-base-200 min-h-screen">
      <div className="hero-content text-center">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex flex-col items-center gap-4">
            <TriangleAlert className="size-16 text-amber-600 dark:text-amber-400" />
            <h1 className="text-base-content text-2xl font-bold">Something went wrong</h1>
          </div>

          <div className="bg-base-300 mb-6 rounded-lg p-4 text-left">
            <p className="text-error font-mono text-sm wrap-break-word">{errorMessage}</p>

            {errorStack && (
              <>
                <button
                  className="text-base-content/70 hover:text-base-content mt-3 text-xs underline"
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                </button>
                {showDetails && (
                  <pre className="text-base-content/60 mt-2 max-h-48 overflow-x-auto overflow-y-auto text-xs break-words whitespace-pre-wrap">
                    {errorStack}
                  </pre>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                void router.invalidate();
              }}
              className="btn btn-primary"
            >
              Try Again
            </button>
            <Link to="/" className="btn btn-outline">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
