// shadcn's Dialog over Kobalte's dialog primitive, which supplies the focus
// trap, focus restoration, `aria-modal` with a labelled title, Escape
// handling and scroll locking. The code here is appearance only.
import { omit } from 'solid-js';
// See button.tsx: these types come from @solidjs/web, not solid-js.
import type { ComponentProps, JSX, ValidComponent } from '@solidjs/web';
import * as DialogPrimitive from '@kobalte/core/dialog';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';

import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.CloseButton;

export function DialogOverlay<T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DialogPrimitive.DialogOverlayProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <DialogPrimitive.Overlay
      class={cn(
        'fixed inset-0 z-50 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out',
        (props as { class?: string }).class,
      )}
      {...others}
    />
  );
}

export function DialogContent<T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, DialogPrimitive.DialogContentProps<T>> & {
    children?: JSX.Element;
  },
) {
  const others = omit(
    props as { class?: string; children?: JSX.Element },
    'class',
    'children',
  );
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Content
          class={cn(
            'relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg',
            (props as { class?: string }).class,
          )}
          {...others}
        >
          {(props as { children?: JSX.Element }).children}
          <DialogPrimitive.CloseButton class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="size-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <span class="sr-only">Close</span>
          </DialogPrimitive.CloseButton>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader(props: ComponentProps<'div'>) {
  const others = omit(props, 'class');
  return (
    <div
      class={cn('flex flex-col gap-1.5 text-left', props.class)}
      {...others}
    />
  );
}

export function DialogFooter(props: ComponentProps<'div'>) {
  const others = omit(props, 'class');
  return (
    <div
      class={cn('flex flex-row justify-end gap-2 pt-4', props.class)}
      {...others}
    />
  );
}

export function DialogTitle<T extends ValidComponent = 'h2'>(
  props: PolymorphicProps<T, DialogPrimitive.DialogTitleProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <DialogPrimitive.Title
      class={cn('text-lg font-semibold', (props as { class?: string }).class)}
      {...others}
    />
  );
}

export function DialogDescription<T extends ValidComponent = 'p'>(
  props: PolymorphicProps<T, DialogPrimitive.DialogDescriptionProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <DialogPrimitive.Description
      class={cn(
        'text-sm text-muted-foreground',
        (props as { class?: string }).class,
      )}
      {...others}
    />
  );
}
