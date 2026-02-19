import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/solid-router';
import { CircleX } from 'lucide-solid';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { SocialLoginButtons, useLastLoginMethod } from '~/components/SocialLoginButtons';
import { authClient } from '~/lib/auth-client';
import { guestGuard } from '~/lib/guards';

export const Route = createFileRoute('/login')({
  beforeLoad: guestGuard,
  validateSearch: (search): { redirect?: string } => {
    return {
      redirect: typeof search?.redirect === 'string' ? search.redirect : undefined,
    };
  },
  component: LoginPage,
});

// TODO This page should use error boundary, should handle known errors and report unknown ones
function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const lastMethod = useLastLoginMethod();

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authClient.signIn.email(
        {
          email: email(),
          password: password(),
        },
        { throw: true },
      );

      setIsLoading(false);

      // Identify user for PostHog (login event tracked server-side)
      const session = await authClient.getSession();
      if (session.data?.user) {
        posthog.identify(session.data.user.id, {
          email: session.data.user.email,
          name: session.data.user.name,
        });
      }

      // Redirect to original page or default to root (which will smart-redirect)
      const redirectTo = search()?.redirect || '/';
      void navigate({ to: redirectTo, replace: true });
    } catch (err) {
      setIsLoading(false);
      if (err instanceof BetterFetchError) {
        setError(err.error?.message || err.message);
      } else {
        posthog.captureException(err);
        setError('Unexpected network error');
      }
    }
  };

  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-lg [&>.card-body]:sm:p-10">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-3xl font-bold">Welcome Back</h1>
          <p class="text-base-content-gray mt-2">Log in to your OpenFeeds account</p>
        </div>

        <Show when={error()}>
          <div class="alert alert-error">
            <CircleX class="h-6 w-6 shrink-0" />
            <span>{error()}</span>
          </div>
        </Show>

        <SocialLoginButtons
          callbackURL={search()?.redirect || '/'}
          onError={(msg) => setError(msg)}
        />

        <div class="divider">or</div>

        <form onSubmit={handleLogin} class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Email</span>
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              class="input input-bordered w-full"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
              disabled={isLoading()}
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              class="input input-bordered w-full"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              disabled={isLoading()}
            />
            <label class="label">
              <Link
                to="/forgot-password"
                search={email() ? { email: email() } : undefined}
                class="label-text-alt link link-hover"
              >
                Forgot password?
              </Link>
            </label>
          </div>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary relative w-full" disabled={isLoading()}>
              <Show when={isLoading()}>
                <Loader />
              </Show>
              {isLoading() ? 'Logging In...' : 'Log In'}
              <Show when={lastMethod() === 'email'}>
                <span class="badge badge-sm badge-info absolute -top-2 -right-2">Last used</span>
              </Show>
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-base-content-gray text-sm">
            Don't have an account?{' '}
            <Link
              to="/signup"
              search={{ redirect: undefined }}
              class="link link-primary font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
