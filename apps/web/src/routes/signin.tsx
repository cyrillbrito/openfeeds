import { BetterFetchError } from '@better-fetch/fetch';
import { attemptAsync } from '@repo/shared/utils';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/solid-router';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '../components/Card.tsx';
import { Loader } from '../components/Loader';
import { fetchUser, useLogin } from '../hooks/use-auth.ts';

export const Route = createFileRoute('/signin')({
  beforeLoad: async () => {
    const user = await fetchUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: (search): { redirect?: string } => {
    return {
      redirect: typeof search?.redirect === 'string' ? search.redirect : undefined,
    };
  },
  component: SignInPage,
});

// TODO This page should use error boundry, should handle known errors and report unknown ones
function SignInPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loginMutation = useLogin();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  const handleSignIn = async (e: Event) => {
    e.preventDefault();
    setError(null);

    const [err] = await attemptAsync(
      loginMutation.mutateAsync({
        email: email(),
        password: password(),
      }),
    );

    if (err) {
      if (err instanceof BetterFetchError) {
        setError(err.error?.message || err.message);
      } else {
        posthog.captureException(err);
        setError('Unexpected network error');
      }
      return;
    }

    // Redirect to original page or default to root (which will smart-redirect)
    const redirectTo = search()?.redirect || '/';
    void navigate({ to: redirectTo, replace: true });
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-3xl font-bold">Welcome Back</h1>
          <p class="text-base-content-gray mt-2">Sign in to your OpenFeeds account</p>
        </div>

        <form onSubmit={handleSignIn} class="space-y-4">
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
              disabled={loginMutation.isPending}
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
              disabled={loginMutation.isPending}
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

          <Show when={error()}>
            <div class="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error()}</span>
            </div>
          </Show>

          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary w-full" disabled={loginMutation.isPending}>
              <Show when={loginMutation.isPending}>
                <Loader />
              </Show>
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div class="divider">or</div>

        <div class="text-center">
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
