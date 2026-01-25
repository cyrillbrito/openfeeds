import { BetterFetchError } from '@better-fetch/fetch';
import { attemptAsync } from '@repo/shared/utils';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/solid-router';
import CircleXIcon from 'lucide-solid/icons/circle-x';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '../components/Card.tsx';
import { Loader } from '../components/Loader';
import { fetchUser, useResetPassword } from '../hooks/use-auth.ts';

export const Route = createFileRoute('/reset-password')({
  beforeLoad: async () => {
    const user = await fetchUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: (search): { token?: string; error?: string } => {
    return {
      token: typeof search?.token === 'string' ? search.token : undefined,
      error: typeof search?.error === 'string' ? search.error : undefined,
    };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const resetPasswordMutation = useResetPassword();
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  // Check for token error from Better Auth redirect
  const tokenError = search()?.error;
  const token = search()?.token;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    const [err] = await attemptAsync(
      resetPasswordMutation.mutateAsync({
        newPassword: password(),
        token,
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

    // Redirect to sign in after successful password reset
    void navigate({ to: '/signin', replace: true });
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-3xl font-bold">Set New Password</h1>
          <p class="text-base-content-gray mt-2">Enter your new password below</p>
        </div>

        <Show
          when={!tokenError && token}
          fallback={
            <div class="space-y-4">
              <div class="alert alert-error">
                <CircleXIcon class="h-6 w-6 shrink-0" />
                <span>
                  {tokenError === 'INVALID_TOKEN'
                    ? 'This reset link is invalid or has expired'
                    : 'Missing or invalid reset link'}
                </span>
              </div>
              <div class="text-center">
                <Link to="/forgot-password" class="btn btn-primary">
                  Request New Reset Link
                </Link>
              </div>
            </div>
          }
        >
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">New Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                class="input input-bordered w-full"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={resetPasswordMutation.isPending}
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
                placeholder="Confirm new password"
                class="input input-bordered w-full"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={resetPasswordMutation.isPending}
              />
            </div>

            <Show when={error()}>
              <div class="alert alert-error">
                <CircleXIcon class="h-6 w-6 shrink-0" />
                <span>{error()}</span>
              </div>
            </Show>

            <div class="form-control mt-6">
              <button
                type="submit"
                class="btn btn-primary w-full"
                disabled={resetPasswordMutation.isPending}
              >
                <Show when={resetPasswordMutation.isPending}>
                  <Loader />
                </Show>
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Show>

        <div class="divider">or</div>

        <div class="text-center">
          <p class="text-base-content-gray text-sm">
            Remember your password?{' '}
            <Link to="/signin" class="link link-primary font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
