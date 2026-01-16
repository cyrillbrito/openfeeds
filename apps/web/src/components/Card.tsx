import type { JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function Card(props: {
  children: JSXElement;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const isClickable = () => !!props.onClick;

  return (
    <div
      class={twMerge(
        'card bg-base-100 border-base-300 rounded-lg border shadow-sm transition-shadow sm:rounded-2xl',
        isClickable() && 'hover:border-base-content/20 hover:shadow-lg',
        props.class,
      )}
      onClick={props.onClick}
    >
      <div class="card-body p-3 sm:p-6">{props.children}</div>
    </div>
  );
}
