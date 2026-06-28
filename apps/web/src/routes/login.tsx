import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CircleX } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useEffect, useState } from 'react';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { SocialLoginButtons, useLastLoginMethod } from '~/components/SocialLoginButtons';
import { authClient } from '~/lib/auth-client';
import { guestGuard } from '~/lib/guards';
import { primeSessionAfterAuth } from '~/lib/session';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastMethod = useLastLoginMethod();

  useEffect(() => {
    posthog.capture('auth:login_view', {
      source: 'login_route',
      reason: search?.redirect ? 'guard_redirect' : 'direct_visit',
      redirect_target: search?.redirect ?? null,
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authClient.signIn.email(
        { email, password },
        { throw: true },
      );

      setIsLoading(false);
      await primeSessionAfterAuth();

      const redirectTo = search?.redirect || '/';
      void navigate({ to: redirectTo, replace: true });
    } catch (err) {
      setIsLoading(false);
      if (err instanceof BetterFetchError) {
        posthog.capture('auth:login_fail', {
          source: 'login_form',
          code: err.error?.code ?? null,
          message: err.error?.message ?? err.message,
        });
        setError(err.error?.message || err.message);
      } else {
        posthog.captureException(err);
        posthog.capture('auth:login_fail', {
          source: 'login_form',
          code: 'unknown',
          message: 'Unexpected network error',
        });
        setError('Unexpected network error');
      }
    }
  };

  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg [&>.card-body]:sm:p-10">
        <div className="mb-6 text-center">
          <h1 className="text-base-content text-3xl font-bold">Welcome Back</h1>
          <p className="text-base-content-gray mt-2">Log in to your OpenFeeds account</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <CircleX className="h-6 w-6 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SocialLoginButtons
          callbackURL={search?.redirect || '/'}
          onError={(msg) => {
            posthog.capture('auth:login_fail', {
              source: 'social_login',
              code: 'provider_error',
              message: msg,
            });
            setError(msg);
          }}
        />

        <div className="divider">or</div>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div className="form-control">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              disabled={isLoading}
            />
            <label className="label">
              <Link
                to="/forgot-password"
                search={email ? { email } : undefined}
                className="label-text-alt link link-hover"
              >
                Forgot password?
              </Link>
            </label>
          </div>

          <div className="form-control mt-6">
            <button type="submit" className="btn btn-primary relative w-full" disabled={isLoading}>
              {isLoading && <Loader />}
              {isLoading ? 'Logging In...' : 'Log In'}
              {lastMethod === 'email' && (
                <span className="badge badge-sm badge-info absolute -top-2 -right-2">Last used</span>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-base-content-gray text-sm">
            Don't have an account?{' '}
            <Link
              to="/signup"
              search={{ redirect: undefined }}
              className="link link-primary font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
