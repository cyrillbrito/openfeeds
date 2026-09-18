// Sign in and sign up, one screen with a toggle.
//
// Submits through the Better Auth client, which posts to /api/auth/* and
// gets the session cookie back on that response.
import { createMemo, createSignal, Show } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import { useNavigate } from '@solidjs/router';

import { Button } from '../components/ui/button';
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from '../components/ui/text-field';
import { getGoogleEnabled, signIn, signUp } from '../lib/auth-client';

export const route = {
  preload: () => {
    void getGoogleEnabled();
  },
} satisfies RouteDefinition;

export default function SignInPage() {
  const googleEnabled = createMemo(() => getGoogleEnabled());
  const navigate = useNavigate();

  const [mode, setMode] = createSignal<'signin' | 'signup'>('signin');
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const signingUp = () => mode() === 'signup';

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    setPending(true);
    setError(undefined);
    // Better Auth returns errors in the result envelope; it does not throw.
    const result = signingUp()
      ? await signUp.email({ email, password, name: email.split('@')[0] })
      : await signIn.email({ email, password });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? 'Could not sign in');
      return;
    }
    navigate('/');
  }

  return (
    <main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <h1 class="text-lg font-semibold">
        {signingUp() ? 'Create an account' : 'Sign in'}
      </h1>

      <form class="flex flex-col gap-4" onSubmit={onSubmit}>
        <TextField>
          <TextFieldLabel>Email</TextFieldLabel>
          <TextFieldInput
            type="email"
            name="email"
            autocomplete="email"
            required
          />
        </TextField>

        <TextField>
          <TextFieldLabel>Password</TextFieldLabel>
          <TextFieldInput
            type="password"
            name="password"
            autocomplete={signingUp() ? 'new-password' : 'current-password'}
            // Better Auth's minimum password length is 8.
            minlength={8}
            required
          />
        </TextField>

        <Show when={error()}>
          {(message) => (
            <p role="alert" class="text-sm text-destructive">
              {message()}
            </p>
          )}
        </Show>

        <Button type="submit" disabled={pending()}>
          {signingUp() ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {/* No <Loading> boundary: the read resolves during SSR. */}
      <Show when={googleEnabled()}>
        <Button
          type="button"
          variant="outline"
          onClick={() => signIn.social({ provider: 'google', callbackURL: '/' })}
        >
          Continue with Google
        </Button>
      </Show>

      <p class="text-center text-sm text-muted-foreground">
        {signingUp() ? 'Already have an account?' : 'No account yet?'}{' '}
        <button
          type="button"
          class="underline underline-offset-4"
          onClick={() => {
            setError(undefined);
            setMode(signingUp() ? 'signin' : 'signup');
          }}
        >
          {signingUp() ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </main>
  );
}
