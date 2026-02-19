import { useRouteContext } from '@tanstack/solid-router';
import { createSignal, onMount, Show } from 'solid-js';
import { AppleIcon } from '~/components/AppleIcon';
import { GoogleIcon } from '~/components/GoogleIcon';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';

function LastUsedBadge() {
  return <span class="badge badge-sm badge-info absolute -top-2 -right-2">Last used</span>;
}

/**
 * Returns the last login method from the cookie-based plugin.
 * Deferred to onMount to avoid SSR hydration mismatch — the cookie is only
 * readable on the client, so the server always returns null. By starting with
 * null and updating after mount, server and client initial renders match.
 */
export function useLastLoginMethod() {
  const [method, setMethod] = createSignal<string | null>(null);
  onMount(() => {
    setMethod(authClient.getLastUsedLoginMethod());
  });
  return method;
}

export function SocialLoginButtons(props: {
  callbackURL: string;
  onError: (message: string) => void;
}) {
  const context = useRouteContext({ from: '__root__' });
  const socialProviders = () => context()?.publicConfig?.socialProviders;
  const lastMethod = useLastLoginMethod();

  const [loadingProvider, setLoadingProvider] = createSignal<string | null>(null);

  const hasSocialProviders = () => socialProviders()?.google || socialProviders()?.apple;

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: props.callbackURL,
      });
    } catch {
      props.onError(`Failed to sign in with ${provider}`);
      setLoadingProvider(null);
    }
  };

  return (
    <Show when={hasSocialProviders()}>
      <div class="space-y-3">
        <Show when={socialProviders()?.google}>
          <button
            type="button"
            class="btn btn-outline relative w-full"
            disabled={!!loadingProvider()}
            onClick={() => handleSocialSignIn('google')}
          >
            <Show when={loadingProvider() === 'google'} fallback={<GoogleIcon class="h-5 w-5" />}>
              <Loader />
            </Show>
            Continue with Google
            <Show when={lastMethod() === 'google'}>
              <LastUsedBadge />
            </Show>
          </button>
        </Show>

        <Show when={socialProviders()?.apple}>
          <button
            type="button"
            class="btn btn-outline relative w-full"
            disabled={!!loadingProvider()}
            onClick={() => handleSocialSignIn('apple')}
          >
            <Show when={loadingProvider() === 'apple'} fallback={<AppleIcon class="h-5 w-5" />}>
              <Loader />
            </Show>
            Continue with Apple
            <Show when={lastMethod() === 'apple'}>
              <LastUsedBadge />
            </Show>
          </button>
        </Show>
      </div>
    </Show>
  );
}
