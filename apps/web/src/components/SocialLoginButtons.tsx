import { useEffect, useState } from 'react';
import { AppleIcon } from '~/components/AppleIcon';
import { GoogleIcon } from '~/components/GoogleIcon';
import { Loader } from '~/components/Loader';
import { api, unwrap } from '~/lib/api-client';
import { authClient } from '~/lib/auth-client';

type SocialProviders = { google: boolean; apple: boolean };

let socialProvidersCache: Promise<SocialProviders> | undefined;
function getSocialProviders(): Promise<SocialProviders> {
  socialProvidersCache ??= unwrap(api.api['public-config'].config.$get({})).then(
    (cfg) => cfg.socialProviders,
  );
  return socialProvidersCache;
}

function LastUsedBadge() {
  return <span className="badge badge-sm badge-info absolute -top-2 -right-2">Last used</span>;
}

export function useLastLoginMethod() {
  const [method, setMethod] = useState<string | null>(null);
  useEffect(() => {
    setMethod(authClient.getLastUsedLoginMethod());
  }, []);
  return method;
}

export function SocialLoginButtons({
  callbackURL,
  onError,
}: {
  callbackURL: string;
  onError: (message: string) => void;
}) {
  const [socialProviders, setSocialProviders] = useState<SocialProviders | undefined>(undefined);
  const lastMethod = useLastLoginMethod();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    void getSocialProviders().then(setSocialProviders);
  }, []);

  const hasSocialProviders = socialProviders?.google || socialProviders?.apple;

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL,
      });
    } catch {
      onError(`Failed to sign in with ${provider}`);
      setLoadingProvider(null);
    }
  };

  if (!hasSocialProviders) return null;

  return (
    <div className="space-y-3">
      {socialProviders?.google && (
        <button
          type="button"
          className="btn btn-outline relative w-full"
          disabled={!!loadingProvider}
          onClick={() => handleSocialSignIn('google')}
        >
          {loadingProvider === 'google' ? <Loader /> : <GoogleIcon className="h-5 w-5" />}
          Continue with Google
          {lastMethod === 'google' && <LastUsedBadge />}
        </button>
      )}

      {socialProviders?.apple && (
        <button
          type="button"
          className="btn btn-outline relative w-full"
          disabled={!!loadingProvider}
          onClick={() => handleSocialSignIn('apple')}
        >
          {loadingProvider === 'apple' ? <Loader /> : <AppleIcon className="h-5 w-5" />}
          Continue with Apple
          {lastMethod === 'apple' && <LastUsedBadge />}
        </button>
      )}
    </div>
  );
}
