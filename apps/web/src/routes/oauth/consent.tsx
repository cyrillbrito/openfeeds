import { createFileRoute } from '@tanstack/solid-router';
import { createResource, createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'View your name and profile picture',
  email: 'View your email address',
  offline_access: 'Stay connected when you are not actively using it',
  'mcp:tools': 'Use tools on your behalf',
};

export const Route = createFileRoute('/oauth/consent')({
  validateSearch: (search): { client_id?: string; scope?: string } => ({
    client_id: typeof search?.client_id === 'string' ? search.client_id : undefined,
    scope: typeof search?.scope === 'string' ? search.scope : undefined,
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const search = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const clientId = () => search()?.client_id;
  const scopes = () => search()?.scope?.split(' ').filter(Boolean) ?? [];

  const [clientInfo] = createResource(clientId, async (id) => {
    const result = await authClient.oauth2.publicClient({ query: { client_id: id } });
    if (result.error) throw new Error(result.error.message ?? 'Failed to load client info');
    return result.data;
  });

  const handleConsent = async (accept: boolean) => {
    setError(null);
    setIsSubmitting(true);

    const result = await authClient.oauth2.consent({
      accept,
      scope: search()?.scope,
    });

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong');
      setIsSubmitting(false);
      return;
    }

    // The consent endpoint returns a redirect URI — navigate to it
    if (result.data?.redirect && result.data?.uri) {
      window.location.href = result.data.uri;
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-2xl font-bold">Authorize Application</h1>
          <p class="text-base-content-gray mt-2">
            An application is requesting access to your account
          </p>
        </div>

        <Show when={clientInfo.loading}>
          <div class="flex justify-center py-8">
            <Loader />
          </div>
        </Show>

        <Show when={clientInfo.error}>
          <div class="flex flex-col items-center gap-3 py-4">
            <div class="alert alert-error">
              <span>Failed to load application info.</span>
            </div>
            <button class="btn btn-sm btn-outline" onClick={() => refetchClientInfo()}>
              Try again
            </button>
          </div>
        </Show>

        <Show when={clientInfo()}>
          <div class="bg-base-200 mb-4 rounded-lg p-4">
            <p class="text-base-content text-lg font-semibold">
              {String(
                clientInfo()?.client_name || clientInfo()?.client_uri || 'Unknown Application',
              )}
            </p>
            <Show when={clientInfo()?.client_uri}>
              <p class="text-base-content-gray mt-1 text-sm">{String(clientInfo()!.client_uri)}</p>
            </Show>
          </div>

          <Show when={scopes().length > 0}>
            <div class="mb-6">
              <p class="text-base-content mb-2 font-medium">This will allow the application to:</p>
              <ul class="space-y-2">
                <For each={scopes()}>
                  {(scope) => (
                    <li class="flex items-start gap-2">
                      <svg
                        class="text-primary mt-0.5 h-5 w-5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width={2}
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
                      </svg>
                      <span class="text-base-content text-sm">
                        {SCOPE_DESCRIPTIONS[scope] ?? scope}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <Show when={error()}>
            <div class="alert alert-error mb-4">
              <span>{error()}</span>
            </div>
          </Show>

          <div class="flex gap-3">
            <button
              class="btn btn-primary flex-1"
              onClick={() => handleConsent(true)}
              disabled={isSubmitting()}
            >
              <Show when={isSubmitting()}>
                <Loader />
              </Show>
              Allow
            </button>
            <button
              class="btn btn-outline flex-1"
              onClick={() => handleConsent(false)}
              disabled={isSubmitting()}
            >
              Deny
            </button>
          </div>
        </Show>
      </Card>
    </div>
  );
}
