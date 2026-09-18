// shadcn's Button, vendored and retargeted onto @kobalte/core@2 (the Solid 2
// line). This is the shadcn model working as intended: the component is our
// source file, not a dependency, so it took a change of import path and
// nothing else to move it from the Solid 1 ports to a Kobalte alpha.
//
// Kobalte supplies the behaviour (correct button semantics on any element,
// disabled handling, focus); cva supplies the variants; nothing here is
// styling over browser defaults.
import { omit } from 'solid-js';
// NOT from 'solid-js': its ValidComponent is Component<any> and does not
// admit intrinsic tags like 'button'. @solidjs/web has the real one.
import type { ValidComponent } from '@solidjs/web';
import * as ButtonPrimitive from '@kobalte/core/button';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps<T extends ValidComponent = 'button'> =
  ButtonPrimitive.ButtonRootProps<T> &
    VariantProps<typeof buttonVariants> & { class?: string };

export function Button<T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, ButtonProps<T>>,
) {
  // Solid 2 replaced splitProps/mergeProps with omit/merge. `omit` returns a
  // reactive proxy without the listed keys — the old `splitProps(p, [...])[1]`
  // — and the keys we handle are read straight off `props`, which is what
  // keeps them reactive.
  const others = omit(props as ButtonProps, 'variant', 'size', 'class');
  return (
    <ButtonPrimitive.Root
      class={cn(
        buttonVariants({
          variant: (props as ButtonProps).variant,
          size: (props as ButtonProps).size,
        }),
        (props as ButtonProps).class,
      )}
      {...others}
    />
  );
}
