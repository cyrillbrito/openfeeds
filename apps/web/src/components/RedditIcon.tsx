// Source: https://svgl.app/?search=reddit
// https://svgl.app/library/reddit.svg
// Simplified version — removed gradients for small-size rendering, uses flat brand colors.

import type { JSX } from 'solid-js';

export function RedditIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 216 216" aria-hidden="true" {...props}>
      <path
        fill="#FF4500"
        stroke-width="0"
        d="M108 0C48.35 0 0 48.35 0 108c0 29.82 12.09 56.82 31.63 76.37l-20.57 20.57C6.98 209.02 9.87 216 15.64 216H108c59.65 0 108-48.35 108-108S167.65 0 108 0Z"
      />
      <circle cx="169.22" cy="106.98" r="25.22" fill="#FFF" stroke-width="0" />
      <circle cx="46.78" cy="106.98" r="25.22" fill="#FFF" stroke-width="0" />
      <ellipse cx="108.06" cy="128.64" fill="#FFF" stroke-width="0" rx="72" ry="54" />
      <path
        fill="#D4301F"
        stroke-width="0"
        d="M86.78 123.48c-.42 9.08-6.49 12.38-13.56 12.38s-12.46-4.93-12.04-14.01c.42-9.08 6.49-15.02 13.56-15.02s12.46 7.58 12.04 16.66Z"
      />
      <path
        fill="#D4301F"
        stroke-width="0"
        d="M129.35 123.48c.42 9.08 6.49 12.38 13.56 12.38s12.46-4.93 12.04-14.01c-.42-9.08-6.49-15.02-13.56-15.02s-12.46 7.58-12.04 16.66Z"
      />
      <ellipse cx="79.63" cy="116.37" fill="#FFC49C" rx="2.8" ry="3.05" />
      <ellipse cx="146.21" cy="116.37" fill="#FFC49C" rx="2.8" ry="3.05" />
      <path
        fill="#172E35"
        stroke-width="0"
        d="M108.06 142.92c-8.76 0-17.16.43-24.92 1.22-1.33.13-2.17 1.51-1.65 2.74 4.35 10.39 14.61 17.69 26.57 17.69s22.23-7.3 26.57-17.69c.52-1.23-.33-2.61-1.65-2.74-7.77-.79-16.16-1.22-24.92-1.22Z"
      />
      <circle cx="147.49" cy="49.43" r="17.87" fill="#FFF" stroke-width="0" />
      <path
        fill="#7A9299"
        stroke-width="0"
        d="M107.8 76.92c-2.14 0-3.87-.89-3.87-2.27 0-16.01 13.03-29.04 29.04-29.04 2.14 0 3.87 1.73 3.87 3.87s-1.73 3.87-3.87 3.87c-11.74 0-21.29 9.55-21.29 21.29 0 1.38-1.73 2.27-3.87 2.27Z"
      />
    </svg>
  );
}
