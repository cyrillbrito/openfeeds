import posthog from 'posthog-js';
import { createSignal, ErrorBoundary, Show, type JSXElement } from 'solid-js';

export function CommonErrorBoundary(props: { children: JSXElement }) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        console.error(err);
        posthog.captureException(err);
        const [showDetails, setShowDetails] = createSignal(false);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack =
          err instanceof Error && err.stack
            ? err.stack.replace(`${err.name}: ${err.message}\n`, '')
            : undefined;

        return (
          <div class="bg-base-300 rounded-lg p-4 text-left">
            <div class="flex items-start justify-between gap-3">
              <p class="text-error flex-1 font-mono text-sm wrap-break-word">{errorMessage}</p>
              <button class="btn btn-sm btn-primary shrink-0" onClick={reset}>
                Retry
              </button>
            </div>

            <Show when={errorStack}>
              <button
                class="text-base-content/70 hover:text-base-content mt-3 text-xs underline"
                onClick={() => setShowDetails(!showDetails())}
              >
                {showDetails() ? 'Hide details' : 'Show details'}
              </button>
              <Show when={showDetails()}>
                <pre class="text-base-content/60 mt-2 max-h-32 overflow-x-auto overflow-y-auto text-xs break-words whitespace-pre-wrap">
                  {errorStack}
                </pre>
              </Show>
            </Show>
          </div>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
