import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CircleCheck, CircleX } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useState } from 'react';
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
  const [email, setEmail] = useState(search?.email || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authClient.requestPasswordReset(
        { email, redirectTo: '/reset-password' },
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
    <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-base-content text-3xl font-bold">Reset Password</h1>
          <p className="text-base-content-gray mt-2">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {success ? (
          <div className="alert alert-success">
            <CircleCheck className="h-6 w-6 shrink-0" />
            <span>Check your email for a password reset link</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <CircleX className="h-6 w-6 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-control mt-6">
              <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                {isLoading && <Loader />}
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}

        <div className="divider">or</div>

        <div className="text-center">
          <p className="text-base-content-gray text-sm">
            Remember your password?{' '}
            <Link to="/login" className="link link-primary font-medium">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
