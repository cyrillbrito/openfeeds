import { createFileRoute } from '@tanstack/react-router';
import { CircleCheck, CircleX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { SCOPE_DESCRIPTIONS } from '~/lib/oauth-scopes';

export const Route = createFileRoute('/oauth/consent')({
  validateSearch: (search): { client_id?: string; scope?: string } => ({
    client_id: typeof search?.client_id === 'string' ? search.client_id : undefined,
    scope: typeof search?.scope === 'string' ? search.scope : undefined,
  }),
  component: ConsentPage,
});

function ConsentPage() {
  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <ConsentContent />
    </div>
  );
}

function ConsentContent() {
  const search = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = search?.client_id;
  const scopes = search?.scope?.split(' ').filter(Boolean) ?? [];

  type ClientInfo = Awaited<ReturnType<typeof authClient.oauth2.publicClient>>['data'];
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [clientInfoLoading, setClientInfoLoading] = useState(true);
  const [clientInfoError, setClientInfoError] = useState(false);

  const fetchClientInfo = () => {
    if (!clientId) return;
    setClientInfoLoading(true);
    setClientInfoError(false);
    authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((result) => {
        if (result.error) throw new Error(result.error.message ?? 'Failed to load client info');
        setClientInfo(result.data ?? null);
      })
      .catch(() => setClientInfoError(true))
      .finally(() => setClientInfoLoading(false));
  };

  useEffect(() => {
    fetchClientInfo();
  }, [clientId]);

  const handleConsent = async (accept: boolean) => {
    setError(null);
    setIsSubmitting(true);

    const result = await authClient.oauth2.consent({
      accept,
      scope: search?.scope,
    });

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong');
      setIsSubmitting(false);
      return;
    }

    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  };

  return (
    <Card className="max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-base-content text-2xl font-bold">Authorize Application</h1>
        <p className="text-base-content-gray mt-2">
          An application is requesting access to your account
        </p>
      </div>

      {clientInfoLoading && (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      )}

      {clientInfoError && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="alert alert-error">
            <CircleX className="h-6 w-6 shrink-0" />
            <span>Failed to load application info.</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={fetchClientInfo}>
            Try again
          </button>
        </div>
      )}

      {clientInfo && (
        <>
          <div className="bg-base-200 mb-4 rounded-lg p-4">
            <div className="flex items-center gap-3">
              {clientInfo.logo_uri && (
                <img src={clientInfo.logo_uri} alt="" className="h-10 w-10 rounded-lg" />
              )}
              <div>
                <p className="text-base-content text-lg font-semibold">
                  {clientInfo.client_name || clientInfo.client_uri || 'Unknown Application'}
                </p>
                {clientInfo.client_uri && (
                  <p className="text-base-content-gray mt-1 text-sm">{clientInfo.client_uri}</p>
                )}
              </div>
            </div>
          </div>

          {scopes.length > 0 && (
            <div className="mb-6">
              <p className="text-base-content mb-2 font-medium">
                This will allow the application to:
              </p>
              <ul className="space-y-2">
                {scopes.map((scope) => (
                  <li key={scope} className="flex items-start gap-2">
                    <CircleCheck className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-base-content text-sm">
                      {SCOPE_DESCRIPTIONS[scope] ?? scope}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="alert alert-error mb-4">
              <CircleX className="h-6 w-6 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="btn btn-primary flex-1"
              onClick={() => handleConsent(true)}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader />}
              {isSubmitting ? 'Authorizing...' : 'Allow'}
            </button>
            <button
              className="btn btn-outline flex-1"
              onClick={() => handleConsent(false)}
              disabled={isSubmitting}
            >
              Deny
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
