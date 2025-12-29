import { ErrorBoundary, Show, createSignal, type JSXElement } from 'solid-js';

export function CommonErrorBoundary(props: { children: JSXElement }) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        console.error(err);
        const [showDetails, setShowDetails] = createSignal(false);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack =
          err instanceof Error && err.stack
            ? err.stack.replace(`${err.name}: ${err.message}\n`, '')
            : undefined;

        return (
          <div class="bg-base-300 rounded-lg p-4 text-left">
            <div class="flex items-start justify-between gap-3">
              <p class="text-error font-mono text-sm break-words flex-1">
                {errorMessage}
              </p>
              <button class="btn btn-sm btn-primary shrink-0" onClick={reset}>
                Retry
              </button>
            </div>

            <Show when={errorStack}>
              <button
                class="text-xs text-base-content/70 hover:text-base-content mt-3 underline"
                onClick={() => setShowDetails(!showDetails())}
              >
                {showDetails() ? 'Hide details' : 'Show details'}
              </button>
              <Show when={showDetails()}>
                <pre class="mt-2 text-xs text-base-content/60 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
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
