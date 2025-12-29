import {
  Link,
  rootRouteId,
  useMatch,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/solid-router';
import { TriangleAlert } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });
  const [showDetails, setShowDetails] = createSignal(false);

  console.error('DefaultCatchBoundary Error:', error);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error && error.stack
      ? error.stack.replace(`${error.name}: ${error.message}\n`, '')
      : undefined;

  return (
    <div class="hero bg-base-200 min-h-screen">
      <div class="hero-content text-center">
        <div class="w-full max-w-lg">
          <div class="mb-8 flex flex-col items-center gap-4">
            <TriangleAlert class="text-warning size-16" />
            <h1 class="text-base-content text-2xl font-bold">Something went wrong</h1>
          </div>

          <div class="bg-base-300 mb-6 rounded-lg p-4 text-left">
            <p class="text-error font-mono text-sm wrap-break-word">{errorMessage}</p>

            <Show when={errorStack}>
              <button
                class="text-base-content/70 hover:text-base-content mt-3 text-xs underline"
                onClick={() => setShowDetails(!showDetails())}
              >
                {showDetails() ? 'Hide details' : 'Show details'}
              </button>
              <Show when={showDetails()}>
                <pre class="text-base-content/60 mt-2 max-h-48 overflow-x-auto overflow-y-auto text-xs break-words whitespace-pre-wrap">
                  {errorStack}
                </pre>
              </Show>
            </Show>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                void router.invalidate();
              }}
              class="btn btn-primary"
            >
              Try Again
            </button>
            {isRoot() ? (
              <Link to="/" class="btn btn-outline">
                Home
              </Link>
            ) : (
              <Link
                to="/"
                class="btn btn-outline"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.back();
                }}
              >
                Go Back
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
