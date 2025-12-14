import { twMerge } from 'tailwind-merge';

type IconProps = { class?: string };

export function FeedIllustration(props?: IconProps) {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={twMerge('text-base-content/30', props?.class)}
    >
      <circle
        cx="100"
        cy="80"
        r="60"
        fill="currentColor"
        fill-opacity="0.1"
        stroke="currentColor"
        stroke-width="2"
      />
      <circle cx="80" cy="100" r="6" fill="currentColor" />
      <path
        d="M80 80 Q80 90, 90 90 Q100 90, 100 100"
        stroke="currentColor"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M80 60 Q80 70, 85 75 Q90 80, 100 80 Q110 80, 115 85 Q120 90, 120 100"
        stroke="currentColor"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
      />
      <rect x="130" y="30" width="40" height="6" rx="3" fill="currentColor" fill-opacity="0.3" />
      <rect x="130" y="40" width="30" height="4" rx="2" fill="currentColor" fill-opacity="0.2" />
      <rect x="130" y="48" width="25" height="4" rx="2" fill="currentColor" fill-opacity="0.2" />
      <rect x="35" y="35" width="35" height="6" rx="3" fill="currentColor" fill-opacity="0.3" />
      <rect x="35" y="45" width="25" height="4" rx="2" fill="currentColor" fill-opacity="0.2" />
      <rect x="35" y="53" width="20" height="4" rx="2" fill="currentColor" fill-opacity="0.2" />
      <rect x="140" y="120" width="30" height="6" rx="3" fill="currentColor" fill-opacity="0.3" />
      <rect x="140" y="130" width="20" height="4" rx="2" fill="currentColor" fill-opacity="0.2" />
      <line
        x1="100"
        y1="40"
        x2="130"
        y2="38"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3,3"
        opacity="0.4"
      />
      <line
        x1="60"
        y1="60"
        x2="35"
        y2="50"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3,3"
        opacity="0.4"
      />
      <line
        x1="120"
        y1="100"
        x2="140"
        y2="123"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3,3"
        opacity="0.4"
      />
    </svg>
  );
}

/** ai gen - Tags illustration */
export function TagsIllustration(props?: IconProps) {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={twMerge('text-base-content/30', props?.class)}
    >
      <rect
        x="20"
        y="30"
        width="50"
        height="20"
        rx="10"
        fill="currentColor"
        fill-opacity="0.2"
        stroke="currentColor"
        stroke-width="2"
      />
      <rect
        x="80"
        y="20"
        width="40"
        height="20"
        rx="10"
        fill="currentColor"
        fill-opacity="0.3"
        stroke="currentColor"
        stroke-width="2"
      />
      <rect
        x="30"
        y="60"
        width="60"
        height="20"
        rx="10"
        fill="currentColor"
        fill-opacity="0.25"
        stroke="currentColor"
        stroke-width="2"
      />
      <rect
        x="100"
        y="50"
        width="35"
        height="20"
        rx="10"
        fill="currentColor"
        fill-opacity="0.2"
        stroke="currentColor"
        stroke-width="2"
      />
      <rect
        x="50"
        y="90"
        width="45"
        height="20"
        rx="10"
        fill="currentColor"
        fill-opacity="0.3"
        stroke="currentColor"
        stroke-width="2"
      />
      <circle
        cx="80"
        cy="80"
        r="15"
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray="4,4"
      />
      <line x1="80" y1="72" x2="80" y2="88" stroke="currentColor" stroke-width="2" />
      <line x1="72" y1="80" x2="88" y2="80" stroke="currentColor" stroke-width="2" />
    </svg>
  );
}
/** Manually edited */
export function CircleIcon(props?: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class={twMerge('size-6', props?.class)}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

/** Manually edited */
export function CircleDotIcon(props?: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class={twMerge('size-6', props?.class)}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}
