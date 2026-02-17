import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/solid-router';
import { CircleX } from 'lucide-solid';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { guestMiddleware } from '~/server/middleware/auth';

export const Route = createFileRoute('/reset-password')({
  server: {
    middleware: [guestMiddleware],
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
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  // Check for token error from Better Auth redirect
  const tokenError = () => search()?.error;
  const token = () => search()?.token;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (!token()) {
      setError('Invalid or missing reset token');
      return;
    }

    setIsLoading(true);

    try {
      await authClient.resetPassword(
        {
          newPassword: password(),
          token: token()!,
        },
        { throw: true },
      );

      setIsLoading(false);

      // Redirect to sign in after successful password reset
      void navigate({ to: '/login', replace: true });
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
      <Card class="max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-3xl font-bold">Set New Password</h1>
          <p class="text-base-content-gray mt-2">Enter your new password below</p>
        </div>

        <Show
          when={!tokenError() && token()}
          fallback={
            <div class="space-y-4">
              <div class="alert alert-error">
                <CircleX class="h-6 w-6 shrink-0" />
                <span>
                  {tokenError() === 'INVALID_TOKEN'
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
                disabled={isLoading()}
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
                disabled={isLoading()}
              />
            </div>

            <Show when={error()}>
              <div class="alert alert-error">
                <CircleX class="h-6 w-6 shrink-0" />
                <span>{error()}</span>
              </div>
            </Show>

            <div class="form-control mt-6">
              <button type="submit" class="btn btn-primary w-full" disabled={isLoading()}>
                <Show when={isLoading()}>
                  <Loader />
                </Show>
                {isLoading() ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Show>

        <div class="divider">or</div>

        <div class="text-center">
          <p class="text-base-content-gray text-sm">
            Remember your password?{' '}
            <Link to="/login" class="link link-primary font-medium">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
