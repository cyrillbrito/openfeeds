import { BetterFetchError } from '@better-fetch/fetch';
import { createFileRoute, Link, useNavigate } from '@tanstack/solid-router';
import { Mail } from 'lucide-solid';
import posthog from 'posthog-js';
import { createSignal, Show } from 'solid-js';
import { Card } from '~/components/Card';
import { Loader } from '~/components/Loader';
import { SocialLoginButtons } from '~/components/SocialLoginButtons';
import { authClient } from '~/lib/auth-client';
import { guestMiddleware } from '~/server/middleware/auth';

export const Route = createFileRoute('/signup')({
  server: {
    middleware: [guestMiddleware],
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
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [verificationSent, setVerificationSent] = createSignal(false);

  const handleSignUp = async (e: Event) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signUp.email(
        {
          email: email(),
          password: password(),
          name: name(),
          callbackURL: '/login',
        },
        { throw: true },
      );

      setIsLoading(false);

      if (result?.token) {
        // Identify user for PostHog (signup event tracked server-side)
        const session = await authClient.getSession();
        if (session.data?.user) {
          posthog.identify(session.data.user.id, {
            email: session.data.user.email,
            name: session.data.user.name,
            created_at: session.data.user.createdAt,
          });
        }

        // Redirect to original page or default to root (which will smart-redirect)
        const redirectTo = search()?.redirect || '/';
        void navigate({ to: redirectTo, replace: true });
      } else {
        // When email verification is required, Better Auth returns token: null
        // and does not create a session. Show a "check your email" message.
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

  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <Card class="max-w-lg [&>.card-body]:sm:p-10">
        <Show
          when={!verificationSent()}
          fallback={
            <div class="space-y-4 text-center">
              <Mail class="text-primary mx-auto h-12 w-12" />
              <h1 class="text-2xl font-bold">Check your email</h1>
              <p class="text-base-content-gray">
                We sent a verification link to <span class="font-medium">{email()}</span>. Click the
                link to verify your account, then sign in.
              </p>
              <div class="divider" />
              <p class="text-base-content-gray text-sm">
                Already verified?{' '}
                <Link to="/login" search={{}} class="link link-primary font-medium">
                  Log in
                </Link>
              </p>
            </div>
          }
        >
          <div class="mb-6 text-center">
            <h1 class="text-3xl font-bold">Join OpenFeeds</h1>
            <p class="text-base-content-gray mt-2">Create your account to get started</p>
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

          <SocialLoginButtons
            callbackURL={search()?.redirect || '/'}
            onError={(msg) => setError(msg)}
          />

          <div class="divider">or</div>

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
                disabled={isLoading()}
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
                disabled={isLoading()}
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
                placeholder="Confirm your password"
                class="input input-bordered w-full"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={isLoading()}
              />
            </div>

            <div class="form-control mt-6">
              <button type="submit" class="btn btn-primary w-full" disabled={isLoading()}>
                <Show when={isLoading()}>
                  <Loader />
                </Show>
                {isLoading() ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div class="mt-4 text-center">
            <p class="text-base-content-gray text-xs">
              By signing up, you agree to our{' '}
              <a
                href="https://openfeeds.app/terms"
                target="_blank"
                rel="noopener noreferrer"
                class="link link-hover"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="https://openfeeds.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                class="link link-hover"
              >
                Privacy Policy
              </a>
            </p>
          </div>

          <div class="mt-6 text-center">
            <p class="text-base-content-gray text-sm">
              Already have an account?{' '}
              <Link to="/login" search={{}} class="link link-primary font-medium">
                Log in
              </Link>
            </p>
          </div>
        </Show>
      </Card>
    </div>
  );
}
