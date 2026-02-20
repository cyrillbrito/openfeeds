import { ClientOnly, createFileRoute } from '@tanstack/solid-router';
import { CircleCheck, CircleX } from 'lucide-solid';
import { createResource, createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { CenterLoader, Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { SCOPE_DESCRIPTIONS } from '~/utils/oauth';

export const Route = createFileRoute('/oauth/consent')({
  validateSearch: (search): { client_id?: string; scope?: string } => ({
    client_id: typeof search?.client_id === 'string' ? search.client_id : undefined,
    scope: typeof search?.scope === 'string' ? search.scope : undefined,
  }),
  component: ConsentPage,
});

function ConsentPage() {
  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <ClientOnly fallback={<CenterLoader />}>
        <ConsentContent />
      </ClientOnly>
    </div>
  );
}

function ConsentContent() {
  const search = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const clientId = () => search()?.client_id;
  const scopes = () => search()?.scope?.split(' ').filter(Boolean) ?? [];

  const [clientInfo, { refetch: refetchClientInfo }] = createResource(clientId, async (id) => {
    const result = await authClient.oauth2.publicClient({ query: { client_id: id } });
    if (result.error) throw new Error(result.error.message ?? 'Failed to load client info');
    return result.data;
  });

  const handleConsent = async (accept: boolean) => {
    setError(null);
    setIsSubmitting(true);

    // The oauthProviderClient plugin automatically injects oauth_query
    // from window.location.search into the request body
    const result = await authClient.oauth2.consent({
      accept,
      scope: search()?.scope,
    });

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong');
      setIsSubmitting(false);
      return;
    }

    // The consent endpoint returns { redirect: boolean, uri: string }
    // Navigate to the returned URI to continue the OAuth flow
    if (result.data?.uri) {
      window.location.href = result.data.uri;
    }
  };

  return (
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
            <CircleX class="h-6 w-6 shrink-0" />
            <span>Failed to load application info.</span>
          </div>
          <button class="btn btn-sm btn-outline" onClick={() => refetchClientInfo()}>
            Try again
          </button>
        </div>
      </Show>

      <Show when={clientInfo()}>
        <div class="bg-base-200 mb-4 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <Show when={clientInfo()?.logo_uri}>
              <img src={clientInfo()!.logo_uri!} alt="" class="h-10 w-10 rounded-lg" />
            </Show>
            <div>
              <p class="text-base-content text-lg font-semibold">
                {clientInfo()?.client_name || clientInfo()?.client_uri || 'Unknown Application'}
              </p>
              <Show when={clientInfo()?.client_uri}>
                <p class="text-base-content-gray mt-1 text-sm">{clientInfo()!.client_uri}</p>
              </Show>
            </div>
          </div>
        </div>

        <Show when={scopes().length > 0}>
          <div class="mb-6">
            <p class="text-base-content mb-2 font-medium">This will allow the application to:</p>
            <ul class="space-y-2">
              <For each={scopes()}>
                {(scope) => (
                  <li class="flex items-start gap-2">
                    <CircleCheck class="text-primary mt-0.5 h-4 w-4 shrink-0" />
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
            <CircleX class="h-6 w-6 shrink-0" />
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
            {isSubmitting() ? 'Authorizing...' : 'Allow'}
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
  );
}
