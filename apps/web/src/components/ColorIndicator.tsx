import { twMerge } from 'tailwind-merge';

interface ColorIndicatorProps {
  class: string;
}

export function ColorIndicator(props: ColorIndicatorProps) {
  return <div class={twMerge('h-3 w-3 rounded-full', props.class)} />;
}
