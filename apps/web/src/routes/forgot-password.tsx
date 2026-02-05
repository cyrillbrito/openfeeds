import { BetterFetchError } from '@better-fetch/fetch';
import { attemptAsync } from '@repo/shared/utils';
import { createFileRoute, Link, redirect } from '@tanstack/solid-router';
import { CircleCheck, CircleX } from 'lucide-solid';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (data?.user) {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: (search): { email?: string } => {
    return {
      email: typeof search?.email === 'string' ? search.email : undefined,
    };
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = createSignal(search()?.email || '');
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const [err] = await attemptAsync(
      authClient.requestPasswordReset(
        {
          email: email(),
          redirectTo: '/reset-password',
        },
        { throw: true },
      ),
    );

    setIsLoading(false);

    if (err) {
      if (err instanceof BetterFetchError) {
        setError(err.error?.message || err.message);
      } else {
        posthog.captureException(err);
        setError('Unexpected network error');
      }
      return;
    }

    setSuccess(true);
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-base-content text-3xl font-bold">Reset Password</h1>
          <p class="text-base-content-gray mt-2">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <Show
          when={!success()}
          fallback={
            <div class="alert alert-success">
              <CircleCheck class="h-6 w-6 shrink-0" />
              <span>Check your email for a password reset link</span>
            </div>
          }
        >
          <form onSubmit={handleSubmit} class="space-y-4">
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
                {isLoading() ? 'Sending...' : 'Send Reset Link'}
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
