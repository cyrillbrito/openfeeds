import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CircleX, Mail } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useState } from 'react';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { SocialLoginButtons } from '~/components/SocialLoginButtons';
import { authClient } from '~/lib/auth-client';
import { guestGuard } from '~/lib/guards';
import { primeSessionAfterAuth } from '~/lib/session';

export const Route = createFileRoute('/signup')({
  beforeLoad: guestGuard,
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signUp.email(
        { email, password, name, callbackURL: '/login' },
        { throw: true },
      );

      setIsLoading(false);

      if (result?.token) {
        await primeSessionAfterAuth();
        const redirectTo = search?.redirect || '/';
        void navigate({ to: redirectTo, replace: true });
      } else {
        setVerificationSent(true);
      }
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

  if (verificationSent) {
    return (
      <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-lg [&>.card-body]:sm:p-10">
          <div className="space-y-4 text-center">
            <Mail className="text-primary mx-auto h-12 w-12" />
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-base-content-gray">
              We sent a verification link to <span className="font-medium">{email}</span>. Click the
              link to verify your account, then sign in.
            </p>
            <div className="divider" />
            <p className="text-base-content-gray text-sm">
              Already verified?{' '}
              <Link to="/login" search={{}} className="link link-primary font-medium">
                Log in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg [&>.card-body]:sm:p-10">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold">Join OpenFeeds</h1>
          <p className="text-base-content-gray mt-2">Create your account to get started</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <CircleX className="h-6 w-6 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SocialLoginButtons
          callbackURL={search?.redirect || '/'}
          onError={(msg) => setError(msg)}
        />

        <div className="divider">or</div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Full Name</span>
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              disabled={isLoading}
            />
          </div>

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
              placeholder="Create a password"
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
              placeholder="Confirm your password"
              className="input input-bordered w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-control mt-6">
            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
              {isLoading && <Loader />}
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-base-content-gray text-xs">
            By signing up, you agree to our{' '}
            <a
              href="https://openfeeds.app/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://openfeeds.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover"
            >
              Privacy Policy
            </a>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-base-content-gray text-sm">
            Already have an account?{' '}
            <Link to="/login" search={{}} className="link link-primary font-medium">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
