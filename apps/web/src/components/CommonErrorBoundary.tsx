import { ErrorBoundary, type JSXElement } from 'solid-js';

export function CommonErrorBoundary(props: { children: JSXElement }) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        console.error(err);
        return (
          <div class="alert alert-error">
            <div>
              <span>Error: {err.message}</span>
              <button class="btn btn-sm btn-outline ml-2" onClick={reset}>
                Try Again
              </button>
            </div>
          </div>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
