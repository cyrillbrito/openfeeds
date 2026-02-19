import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { CircleCheck, CircleX } from 'lucide-solid';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { guestGuard } from '~/lib/guards';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: guestGuard,
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

    try {
      await authClient.requestPasswordReset(
        {
          email: email(),
          redirectTo: '/reset-password',
        },
        { throw: true },
      );

      setIsLoading(false);
      setSuccess(true);
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
            <Link to="/login" class="link link-primary font-medium">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
