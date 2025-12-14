import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/solid-router';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error('DefaultCatchBoundary Error:', error);

  return (
    <div class="hero bg-base-200 min-h-screen">
      <div class="hero-content text-center">
        <div class="max-w-md">
          <div class="alert alert-error mb-6">
            <ErrorComponent error={error} />
          </div>
          <div class="flex flex-wrap items-center justify-center gap-2">
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
