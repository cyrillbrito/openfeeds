import { createSignal, Show } from 'solid-js';

export default function SubscribeForm() {
  const [email, setEmail] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/waitlist.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email() }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string };

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error ?? 'Failed to subscribe');
      }
    } catch (err) {
      setError('Failed to subscribe. Please try again.');
      console.error('Subscribe error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="mx-auto max-w-md">
      <Show
        when={!submitted()}
        fallback={
          <div class="border-accent bg-accent/10 text-foreground rounded-lg border-2 px-6 py-4">
            <p class="text-lg font-semibold">You're subscribed!</p>
            <p class="text-sm opacity-70">We'll keep you posted on updates.</p>
          </div>
        }
      >
        <form onSubmit={handleSubmit} class="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            placeholder="Enter your email"
            required
            disabled={loading()}
            class="border-foreground/20 text-foreground placeholder-foreground/40 focus:border-accent flex-1 rounded-lg border-2 bg-white px-5 py-3 text-base transition-colors focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading()}
            class="bg-accent hover:bg-accent/90 rounded-lg px-6 py-3 text-base font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading() ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      </Show>
      <Show when={error()}>
        <p class="mt-2 text-sm text-red-600">{error()}</p>
      </Show>
    </div>
  );
}
