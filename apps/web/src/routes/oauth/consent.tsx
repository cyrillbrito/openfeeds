import { createFileRoute, redirect } from '@tanstack/solid-router';
import { createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';

export const Route = createFileRoute('/oauth/consent')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({ to: '/signin' });
    }
  },
  validateSearch: (
    search,
  ): {
    client_id?: string;
    scope?: string;
  } => ({
    client_id: typeof search?.client_id === 'string' ? search.client_id : undefined,
    scope: typeof search?.scope === 'string' ? search.scope : undefined,
  }),
  component: ConsentPage,
});

/** Human-readable scope descriptions */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'Access your name and profile picture',
  email: 'Access your email address',
  offline_access: 'Stay connected (refresh tokens)',
  'mcp:tools': 'Manage your feeds, articles, and tags',
};

function ConsentPage() {
  const search = Route.useSearch();
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const scopes = () => {
    const raw = search()?.scope ?? '';
    return raw.split(' ').filter(Boolean);
  };

  const clientId = () => search()?.client_id ?? 'Unknown application';

  const handleConsent = async (accept: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      await (authClient as any).oauth2.consent({
        accept,
        scope: accept ? scopes().join(' ') : undefined,
      });
    } catch (err: any) {
      // The consent endpoint typically redirects, so errors here are unexpected
      setError(err?.message ?? 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <Card class="w-full max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-2xl font-bold">Authorize Access</h1>
          <p class="text-base-content/60 mt-2 text-sm">
            An application is requesting access to your OpenFeeds account.
          </p>
        </div>

        <div class="bg-base-200 mb-4 rounded-lg p-4">
          <p class="text-base-content text-sm font-medium">Application</p>
          <p class="text-base-content/70 text-sm">{clientId()}</p>
        </div>

        <div class="mb-6">
          <p class="text-base-content mb-3 text-sm font-medium">
            This application will be able to:
          </p>
          <ul class="space-y-2">
            <For each={scopes()}>
              {(scope) => (
                <li class="flex items-start gap-2 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="text-success mt-0.5 h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span class="text-base-content/80">{SCOPE_DESCRIPTIONS[scope] ?? scope}</span>
                </li>
              )}
            </For>
          </ul>
        </div>

        <Show when={error()}>
          <div class="alert alert-error mb-4">
            <span>{error()}</span>
          </div>
        </Show>

        <div class="flex gap-3">
          <button
            class="btn btn-ghost flex-1"
            onClick={() => handleConsent(false)}
            disabled={isLoading()}
          >
            Deny
          </button>
          <button
            class="btn btn-primary flex-1"
            onClick={() => handleConsent(true)}
            disabled={isLoading()}
          >
            <Show when={isLoading()}>
              <Loader />
            </Show>
            {isLoading() ? 'Authorizing...' : 'Allow'}
          </button>
        </div>
      </Card>
    </div>
  );
}
