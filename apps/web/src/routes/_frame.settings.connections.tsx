import { ClientOnly, createFileRoute } from '@tanstack/solid-router';
import { CircleCheck, CircleX, Unplug } from 'lucide-solid';
import { createResource, createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Verify your identity',
  profile: 'View your name and profile picture',
  email: 'View your email address',
  offline_access: 'Stay connected when not actively using it',
  'mcp:tools': 'Access your feeds, articles, and tags',
};

type ConnectionInfo = {
  consentId: string;
  clientId: string;
  name: string;
  uri: string | null;
  scopes: string[];
  authorizedAt: Date;
};

export const Route = createFileRoute('/_frame/settings/connections')({
  component: ConnectionsPage,
});

function ConnectionsPage() {
  return (
    <ClientOnly fallback={<CenterLoader />}>
      <ConnectionsContent />
    </ClientOnly>
  );
}

function ConnectionsContent() {
  const [revokingId, setRevokingId] = createSignal<string | null>(null);
  const [revokeError, setRevokeError] = createSignal<string | null>(null);
  const [revokeTarget, setRevokeTarget] = createSignal<ConnectionInfo | null>(null);
  let revokeModalController!: ModalController;

  const [connections, { mutate, refetch }] = createResource(async () => {
    const result = await authClient.oauth2.getConsents();
    if (result.error) throw new Error(result.error.message ?? 'Failed to load connections');
    const consents = result.data ?? [];

    // Fetch client info for each consent
    const enriched: ConnectionInfo[] = [];
    for (const consent of consents) {
      const clientResult = await authClient.oauth2.publicClient({
        query: { client_id: consent.clientId },
      });
      enriched.push({
        consentId: consent.id,
        clientId: consent.clientId,
        name: clientResult.data?.client_name || clientResult.data?.client_uri || consent.clientId,
        uri: clientResult.data?.client_uri ?? null,
        scopes: consent.scopes as string[],
        authorizedAt: new Date(consent.createdAt),
      });
    }
    return enriched;
  });

  const handleRevoke = async (consentId: string) => {
    setRevokeError(null);
    setRevokingId(consentId);
    try {
      const result = await authClient.oauth2.deleteConsent({ id: consentId });
      if (result.error) {
        setRevokeError(result.error.message ?? 'Failed to revoke access');
        return;
      }
      // Optimistically remove the revoked connection
      mutate((prev) => prev?.filter((c) => c.consentId !== consentId));
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setRevokingId(null);
      revokeModalController.close();
    }
  };

  return (
    <>
      <div class="mb-6">
        <p class="text-base-content-gray text-sm">
          Applications you've authorized to access your account. Revoking access will require the
          application to re-authorize next time.
        </p>
      </div>

      <Show when={revokeError()}>
        <div class="alert alert-error mb-4">
          <CircleX class="h-5 w-5 shrink-0" />
          <span>{revokeError()}</span>
        </div>
      </Show>

      <Show when={connections.loading}>
        <CenterLoader />
      </Show>

      <Show when={connections.error}>
        <div class="alert alert-error">
          <CircleX class="h-5 w-5 shrink-0" />
          <span>Failed to load connections</span>
          <button class="btn btn-sm btn-ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </Show>

      <Show when={connections() && !connections.loading}>
        <Show
          when={connections()!.length > 0}
          fallback={
            <Card>
              <div class="flex flex-col items-center gap-2 py-4 text-center">
                <Unplug class="text-base-content-gray h-8 w-8" />
                <p class="text-base-content-gray">No connected applications</p>
                <p class="text-base-content-gray text-sm">
                  When you authorize an application (like an AI assistant) to access your account,
                  it will appear here.
                </p>
              </div>
            </Card>
          }
        >
          <div class="space-y-4">
            <For each={connections()}>
              {(connection) => (
                <Card>
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                      <h3 class="text-base-content font-semibold">{connection.name}</h3>
                      <Show when={connection.uri}>
                        <p class="text-base-content-gray mt-0.5 truncate text-sm">
                          {connection.uri}
                        </p>
                      </Show>
                      <p class="text-base-content-gray mt-1 text-xs">
                        Authorized {connection.authorizedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      class="btn btn-error btn-outline btn-sm shrink-0"
                      onClick={() => {
                        setRevokeTarget(connection);
                        revokeModalController.open();
                      }}
                    >
                      Revoke
                    </button>
                  </div>

                  <Show when={connection.scopes.length > 0}>
                    <div class="border-base-300 mt-3 border-t pt-3">
                      <p class="text-base-content-gray mb-1.5 text-xs font-medium tracking-wide uppercase">
                        Permissions
                      </p>
                      <ul class="space-y-1">
                        <For each={connection.scopes}>
                          {(scope) => (
                            <li class="flex items-center gap-1.5">
                              <CircleCheck class="text-success h-3.5 w-3.5 shrink-0" />
                              <span class="text-base-content text-sm">
                                {SCOPE_DESCRIPTIONS[scope] ?? scope}
                              </span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </Show>
                </Card>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <LazyModal
        controller={(c) => (revokeModalController = c)}
        class="max-w-md"
        title="Revoke Access"
        onClose={() => setRevokeTarget(null)}
      >
        <Show when={revokeTarget()}>
          {(target) => (
            <>
              <p class="mb-4">
                Are you sure you want to revoke access for{' '}
                <span class="font-semibold">{target().name}</span>? The application will need to
                re-authorize to access your account.
              </p>
              <div class="modal-action">
                <button class="btn" onClick={() => revokeModalController.close()}>
                  Cancel
                </button>
                <button
                  class="btn btn-error"
                  onClick={() => handleRevoke(target().consentId)}
                  disabled={revokingId() !== null}
                >
                  <Show when={revokingId() !== null}>
                    <span class="loading loading-spinner loading-xs mr-1"></span>
                  </Show>
                  Revoke Access
                </button>
              </div>
            </>
          )}
        </Show>
      </LazyModal>
    </>
  );
}
