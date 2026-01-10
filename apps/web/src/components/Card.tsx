import type { JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function Card(props: {
  children: JSXElement;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <div
      class={twMerge('card bg-base-100 border-base-300 border shadow-sm rounded-lg sm:rounded-2xl', props.class)}
      onClick={props.onClick}
    >
      <div class="card-body p-3 sm:p-6">{props.children}</div>
    </div>
  );
}
