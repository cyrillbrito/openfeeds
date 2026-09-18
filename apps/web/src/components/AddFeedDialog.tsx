// The subscribe flow: a Kobalte dialog wrapping plain forms that post to the
// `addFeed` server action.
//
// Two steps, but only when the second one earns its place. Paste a URL and if
// exactly one feed comes back you are subscribed — no confirmation screen for
// a question with one answer. A page offering several (a blog with comments,
// a GitHub repo's releases/commits/tags) shows a picker instead, because
// choosing for you would be guessing.
//
// Both forms have `action={addFeed} method="post"` and real inputs, so they
// work as forms first — the router intercepts the submit when JS is running,
// and posts directly to /_server when it is not. `method="post"` is required:
// the router's delegated handler rejects GET forms outright.
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
} from 'solid-js';
import { useSubmissions } from '@solidjs/router';

import { addFeed, type AddFeedResult } from '../lib/feeds';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { TextField, TextFieldInput, TextFieldLabel } from './ui/text-field';

/**
 * Derived from the action's own result type rather than imported from
 * `src/server`, which the `server-only` marker keeps out of the client graph.
 */
type Choice = Extract<AddFeedResult, { status: 'choose' }>['candidates'][number];

export function AddFeedDialog() {
  const [open, setOpen] = createSignal(false);
  // The picker lives in a signal rather than being read straight off the
  // latest result. Submitting a choice creates a NEW submission whose result
  // is briefly undefined, and deriving the step from that would make the list
  // vanish mid-click and flash the URL field back.
  const [choices, setChoices] = createSignal<Choice[]>([]);
  const [source, setSource] = createSignal('');

  // Submissions are settled history plus whatever is in flight; the last
  // entry is this dialog's attempt. There is no `pending` flag on a
  // Submission in this version, so "in flight" is derived: dispatched, but
  // with neither a result nor an error yet.
  const submissions = useSubmissions(addFeed);
  const latest = createMemo(() => submissions[submissions.length - 1]);
  const pending = createMemo(() => {
    const submission = latest();
    return !!submission && submission.result === undefined && !submission.error;
  });
  const result = createMemo(() => latest()?.result as AddFeedResult | undefined);
  const errorMessage = createMemo(() => {
    const submission = latest();
    if (submission?.error) {
      return String(submission.error.message ?? submission.error);
    }
    const settled = result();
    return settled?.status === 'error' ? settled.message : undefined;
  });

  /**
   * Drop settled submissions so reopening the dialog starts clean.
   *
   * `untrack` because this reads `submissions` from inside effect bodies,
   * where Solid 2 warns (correctly) that a bare read will not update. A
   * one-shot snapshot is exactly what is wanted here — subscribing to the
   * list we are in the middle of emptying would be the bug.
   */
  function reset() {
    setChoices([]);
    setSource('');
    untrack(() => {
      // Snapshot first: clear() removes the entry from `submissions`, so
      // iterating the live array would skip every other one.
      for (const submission of Array.from(submissions)) submission.clear();
    });
  }

  // Solid 2's createEffect takes TWO functions: what to track, and what to do
  // with it. A one-argument createEffect is the Solid 1 API.
  createEffect(
    () => result(),
    (settled) => {
      if (!settled) return;
      if (settled.status === 'added') {
        setOpen(false);
        reset();
      } else if (settled.status === 'choose') {
        setSource(settled.source);
        setChoices(settled.candidates);
      }
    },
  );

  createEffect(
    () => open(),
    (isOpen) => {
      if (!isOpen) reset();
    },
  );

  const picking = createMemo(() => choices().length > 0);
  const firstSelectable = createMemo(() =>
    choices().find((choice) => !choice.alreadySubscribed),
  );

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <DialogTrigger as={Button} size="sm">
        Add feed
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {picking() ? 'Choose a feed' : 'Add a feed'}
          </DialogTitle>
          <DialogDescription>
            {picking()
              ? `${source()} offers more than one feed. Pick the one you want.`
              : 'Paste a website or a feed URL. A site that advertises its feed is resolved for you, and the feed is fetched once now — so a bad address fails here rather than silently later.'}
          </DialogDescription>
        </DialogHeader>

        <Show
          when={picking()}
          fallback={
            <form action={addFeed} method="post" class="flex flex-col gap-4 pt-4">
              <TextField class="flex flex-col gap-2">
                <TextFieldLabel>Website or feed URL</TextFieldLabel>
                <TextFieldInput
                  name="url"
                  type="text"
                  placeholder="https://example.com"
                  autocomplete="off"
                  required
                />
              </TextField>

              <Show when={errorMessage()}>
                {(message) => (
                  <p class="text-sm text-destructive" role="alert">
                    {message()}
                  </p>
                )}
              </Show>

              <DialogFooter>
                <Button type="submit" disabled={pending()}>
                  {pending() ? 'Looking…' : 'Subscribe'}
                </Button>
              </DialogFooter>
            </form>
          }
        >
          <form action={addFeed} method="post" class="flex flex-col gap-4 pt-4">
            {/* Tells the server this URL came from a list it just verified,
                so it subscribes directly instead of rediscovering. */}
            <input type="hidden" name="exact" value="1" />

            <fieldset class="flex flex-col gap-2">
              <For each={choices()}>
                {(choice) => (
                  <label
                    class={[
                      'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm',
                      {
                        'cursor-not-allowed opacity-50':
                          choice.alreadySubscribed,
                        'hover:bg-accent': !choice.alreadySubscribed,
                      },
                    ]}
                  >
                    <input
                      type="radio"
                      name="url"
                      value={choice.url}
                      class="mt-1"
                      required
                      disabled={choice.alreadySubscribed}
                      checked={choice.url === firstSelectable()?.url}
                    />
                    <span class="flex min-w-0 flex-col gap-0.5">
                      <span class="font-medium">{choice.title}</span>
                      <span class="truncate text-xs text-muted-foreground">
                        {choice.url}
                      </span>
                      <Show when={choice.alreadySubscribed}>
                        <span class="text-xs text-muted-foreground">
                          Already subscribed
                        </span>
                      </Show>
                    </span>
                  </label>
                )}
              </For>
            </fieldset>

            <Show when={errorMessage()}>
              {(message) => (
                <p class="text-sm text-destructive" role="alert">
                  {message()}
                </p>
              )}
            </Show>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={reset}>
                Back
              </Button>
              <Button
                type="submit"
                disabled={pending() || !firstSelectable()}
              >
                {pending() ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </DialogFooter>
          </form>
        </Show>
      </DialogContent>
    </Dialog>
  );
}
