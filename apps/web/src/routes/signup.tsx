import { BetterFetchError } from '@better-fetch/fetch';
import { attemptAsync } from '@repo/shared/utils';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/solid-router';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '../components/Card.tsx';
import { Loader } from '../components/Loader';
import { fetchUser, useRegister } from '../hooks/use-auth.ts';

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const user = await fetchUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: (search) => {
    return {
      redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    };
  },
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const registerMutation = useRegister();
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  const handleSignUp = async (e: Event) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    const [err] = await attemptAsync(
      registerMutation.mutateAsync({
        email: email(),
        password: password(),
        name: name(),
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
          <h1 class="text-3xl font-bold">Join OpenFeeds</h1>
          <p class="text-base-content-gray mt-2">Create your account to get started</p>
        </div>

        <form onSubmit={handleSignUp} class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Full Name</span>
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              class="input input-bordered w-full"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              required
              disabled={registerMutation.isPending}
            />
          </div>

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
              disabled={registerMutation.isPending}
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              type="password"
              placeholder="Create a password"
              class="input input-bordered w-full"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              disabled={registerMutation.isPending}
            />
            <label class="label">
              <span class="label-text-alt text-base-content-gray">
                Must be at least 6 characters
              </span>
            </label>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Confirm Password</span>
            </label>
            <input
              type="password"
              placeholder="Confirm your password"
              class="input input-bordered w-full"
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              disabled={registerMutation.isPending}
            />
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
            <button
              type="submit"
              class="btn btn-primary w-full"
              disabled={registerMutation.isPending}
            >
              <Show when={registerMutation.isPending}>
                <Loader />
              </Show>
              {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <div class="mt-4 text-center">
          <p class="text-base-content-gray text-xs">
            By signing up, you agree to our{' '}
            <a href="#" class="link link-hover">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" class="link link-hover">
              Privacy Policy
            </a>
          </p>
        </div>

        <div class="divider">or</div>

        <div class="text-center">
          <p class="text-base-content-gray text-sm">
            Already have an account?{' '}
            <Link to="/signin" search={{}} class="link link-primary font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
