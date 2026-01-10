import type { JSXElement } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function Card(props: {
  children: JSXElement;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <div
      class={twMerge('card bg-base-100 border-base-300 border shadow-sm rounded-md sm:rounded-xl', props.class)}
      onClick={props.onClick}
    >
      <div class="card-body p-2.5 sm:p-6">{props.children}</div>
    </div>
  );
}
