import { ClientOnly, createFileRoute } from '@tanstack/solid-router';
import { CircleCheck, CircleX, Unplug } from 'lucide-solid';
import { createResource, createSignal, For, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { SCOPE_DESCRIPTIONS } from '~/utils/oauth';

async function fetchConsents() {
  const result = await authClient.oauth2.getConsents();
  if (result.error) throw new Error(result.error.message ?? 'Failed to load connections');
  return result.data ?? [];
}

type Consent = Awaited<ReturnType<typeof fetchConsents>>[number];

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
  const [revokeError, setRevokeError] = createSignal<string | null>(null);
  const [revokeTarget, setRevokeTarget] = createSignal<Consent | null>(null);
  const [revokingId, setRevokingId] = createSignal<string | null>(null);
  let revokeModalController!: ModalController;

  const [consents, { mutate, refetch }] = createResource(fetchConsents);

  const handleRevoke = async (consent: Consent) => {
    setRevokeError(null);
    setRevokingId(consent.id);
    try {
      const result = await authClient.oauth2.deleteConsent({ id: consent.id });
      if (result.error) {
        setRevokeError(result.error.message ?? 'Failed to revoke access');
        return;
      }
      mutate((prev) => prev?.filter((c) => c.id !== consent.id));
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

      <Show when={consents.loading}>
        <CenterLoader />
      </Show>

      <Show when={consents.error}>
        <div class="alert alert-error">
          <CircleX class="h-5 w-5 shrink-0" />
          <span>Failed to load connections</span>
          <button class="btn btn-sm btn-ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </Show>

      <Show when={consents() && !consents.loading}>
        <Show
          when={consents()!.length > 0}
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
            <For each={consents()}>
              {(consent) => (
                <ConnectionCard
                  consent={consent}
                  onRevoke={() => {
                    setRevokeTarget(consent);
                    revokeModalController.open();
                  }}
                />
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
                <span class="font-semibold">{target().clientId}</span>? The application will need to
                re-authorize to access your account.
              </p>
              <div class="modal-action">
                <button class="btn" onClick={() => revokeModalController.close()}>
                  Cancel
                </button>
                <button
                  class="btn btn-error"
                  onClick={() => handleRevoke(target())}
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

function ConnectionCard(props: { consent: Consent; onRevoke: () => void }) {
  const [clientInfo] = createResource(
    () => props.consent.clientId,
    async (clientId) => {
      const result = await authClient.oauth2.publicClient({ query: { client_id: clientId } });
      return result.data;
    },
  );

  const name = () =>
    clientInfo()?.client_name || clientInfo()?.client_uri || props.consent.clientId;
  const uri = () => clientInfo()?.client_uri ?? null;
  const scopes = () => props.consent.scopes as string[];

  return (
    <Card>
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <Show when={clientInfo.loading}>
            <div class="bg-base-300 h-5 w-32 animate-pulse rounded" />
          </Show>
          <Show when={!clientInfo.loading}>
            <h3 class="text-base-content font-semibold">{name()}</h3>
            <Show when={uri()}>
              <p class="text-base-content-gray mt-0.5 truncate text-sm">{uri()}</p>
            </Show>
          </Show>
          <p class="text-base-content-gray mt-1 text-xs">
            Authorized {new Date(props.consent.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button class="btn btn-error btn-outline btn-sm shrink-0" onClick={props.onRevoke}>
          Revoke
        </button>
      </div>

      <Show when={scopes().length > 0}>
        <div class="border-base-300 mt-3 border-t pt-3">
          <p class="text-base-content-gray mb-1.5 text-xs font-medium tracking-wide uppercase">
            Permissions
          </p>
          <ul class="space-y-1">
            <For each={scopes()}>
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
  );
}
