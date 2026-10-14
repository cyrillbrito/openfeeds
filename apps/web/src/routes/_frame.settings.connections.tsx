import { createFileRoute } from '@tanstack/react-router';
import { CircleCheck, CircleX, Unplug } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Card } from '~/components/Card';
import { LazyModal, type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { SCOPE_DESCRIPTIONS } from '~/lib/oauth-scopes';

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
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Consent | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const revokeModalRef = useRef<ModalController>(null!);

  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadConsents = () => {
    setLoading(true);
    setLoadError(false);
    fetchConsents()
      .then(setConsents)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConsents();
  }, []);

  const handleRevoke = async (consent: Consent) => {
    setRevokeError(null);
    setRevokingId(consent.id);
    try {
      const result = await authClient.oauth2.deleteConsent({ id: consent.id });
      if (result.error) {
        setRevokeError(result.error.message ?? 'Failed to revoke access');
        return;
      }
      setConsents((prev) => prev?.filter((c) => c.id !== consent.id) ?? null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setRevokingId(null);
      revokeModalRef.current.close();
    }
  };

  return (
    <>
      <div className="mb-6">
        <p className="text-base-content-gray text-sm">
          Applications you've authorized to access your account. Revoking access will require the
          application to re-authorize next time.
        </p>
      </div>

      {revokeError && (
        <div className="alert alert-error mb-4">
          <CircleX className="h-5 w-5 shrink-0" />
          <span>{revokeError}</span>
        </div>
      )}

      {loading && <CenterLoader />}

      {loadError && (
        <div className="alert alert-error">
          <CircleX className="h-5 w-5 shrink-0" />
          <span>Failed to load connections</span>
          <button className="btn btn-sm btn-ghost" onClick={loadConsents}>
            Retry
          </button>
        </div>
      )}

      {consents && !loading && (
        <>
          {consents.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Unplug className="text-base-content-gray h-8 w-8" />
                <p className="text-base-content-gray">No connected applications</p>
                <p className="text-base-content-gray text-sm">
                  When you authorize an application (like an AI assistant) to access your account,
                  it will appear here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {consents.map((consent) => (
                <ConnectionCard
                  key={consent.id}
                  consent={consent}
                  onRevoke={() => {
                    setRevokeTarget(consent);
                    revokeModalRef.current.open();
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <LazyModal
        controller={(c) => {
          revokeModalRef.current = c;
        }}
        className="max-w-md"
        title="Revoke Access"
        onClose={() => setRevokeTarget(null)}
      >
        {revokeTarget && (
          <>
            <p className="mb-4">
              Are you sure you want to revoke access for{' '}
              <span className="font-semibold">{revokeTarget.clientId}</span>? The application will
              need to re-authorize to access your account.
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => revokeModalRef.current.close()}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => handleRevoke(revokeTarget)}
                disabled={revokingId !== null}
              >
                {revokingId !== null && (
                  <span className="loading loading-spinner loading-xs mr-1"></span>
                )}
                Revoke Access
              </button>
            </div>
          </>
        )}
      </LazyModal>
    </>
  );
}

function ConnectionCard({ consent, onRevoke }: { consent: Consent; onRevoke: () => void }) {
  const [clientInfo, setClientInfo] = useState<{
    client_name?: string;
    client_uri?: string;
  } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    authClient.oauth2
      .publicClient({ query: { client_id: consent.clientId } })
      .then((r) => setClientInfo(r.data ?? null))
      .catch(() => setClientInfo(null))
      .finally(() => setLoadingInfo(false));
  }, [consent.clientId]);

  const name = clientInfo?.client_name || clientInfo?.client_uri || consent.clientId;
  const uri = clientInfo?.client_uri ?? null;
  const scopes = consent.scopes as string[];

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {loadingInfo ? (
            <div className="bg-base-300 h-5 w-32 animate-pulse rounded" />
          ) : (
            <>
              <h3 className="text-base-content font-semibold">{name}</h3>
              {uri && <p className="text-base-content-gray mt-0.5 truncate text-sm">{uri}</p>}
            </>
          )}
          <p className="text-base-content-gray mt-1 text-xs">
            Authorized {new Date(consent.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button className="btn btn-error btn-outline btn-sm shrink-0" onClick={onRevoke}>
          Revoke
        </button>
      </div>

      {scopes.length > 0 && (
        <div className="border-base-300 mt-3 border-t pt-3">
          <p className="text-base-content-gray mb-1.5 text-xs font-medium tracking-wide uppercase">
            Permissions
          </p>
          <ul className="space-y-1">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-center gap-1.5">
                <CircleCheck className="text-success h-3.5 w-3.5 shrink-0" />
                <span className="text-base-content text-sm">
                  {SCOPE_DESCRIPTIONS[scope] ?? scope}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
