// shadcn's Input, over Kobalte's TextField. Kobalte wires the label to the
// input and the error message to `aria-describedby`, which is the part that
// is tedious and easy to get wrong by hand.
import { omit } from 'solid-js';
// See button.tsx: @solidjs/web, not solid-js.
import type { ValidComponent } from '@solidjs/web';
import * as TextFieldPrimitive from '@kobalte/core/text-field';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';

import { cn } from '../../lib/cn';

export const TextField = TextFieldPrimitive.Root;

export function TextFieldInput<T extends ValidComponent = 'input'>(
  props: PolymorphicProps<T, TextFieldPrimitive.TextFieldInputProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <TextFieldPrimitive.Input
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        (props as { class?: string }).class,
      )}
      {...others}
    />
  );
}

export function TextFieldLabel<T extends ValidComponent = 'label'>(
  props: PolymorphicProps<T, TextFieldPrimitive.TextFieldLabelProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <TextFieldPrimitive.Label
      class={cn(
        'text-sm font-medium leading-none',
        (props as { class?: string }).class,
      )}
      {...others}
    />
  );
}

export function TextFieldErrorMessage<T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, TextFieldPrimitive.TextFieldErrorMessageProps<T>>,
) {
  const others = omit(props as { class?: string }, 'class');
  return (
    <TextFieldPrimitive.ErrorMessage
      class={cn(
        'text-sm text-destructive',
        (props as { class?: string }).class,
      )}
      {...others}
    />
  );
}
