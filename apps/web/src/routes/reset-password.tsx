import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CircleX } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useState } from 'react';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { authClient } from '~/lib/auth-client';
import { guestGuard } from '~/lib/guards';

export const Route = createFileRoute('/reset-password')({
  beforeLoad: guestGuard,
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tokenError = search?.error;
  const token = search?.token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setIsLoading(true);

    try {
      await authClient.resetPassword({ newPassword: password, token }, { throw: true });
      setIsLoading(false);
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
    <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-base-content text-3xl font-bold">Set New Password</h1>
          <p className="text-base-content-gray mt-2">Enter your new password below</p>
        </div>

        {!tokenError && token ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={isLoading}
              />
              <label className="label">
                <span className="label-text-alt text-base-content-gray">
                  Must be at least 6 characters
                </span>
              </label>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="input input-bordered w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
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
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="alert alert-error">
              <CircleX className="h-6 w-6 shrink-0" />
              <span>
                {tokenError === 'INVALID_TOKEN'
                  ? 'This reset link is invalid or has expired'
                  : 'Missing or invalid reset link'}
              </span>
            </div>
            <div className="text-center">
              <Link to="/forgot-password" className="btn btn-primary">
                Request New Reset Link
              </Link>
            </div>
          </div>
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
