import { twMerge } from 'tailwind-merge';

interface ColorIndicatorProps {
  className: string;
}

export function ColorIndicator({ className }: ColorIndicatorProps) {
  return <div className={twMerge('h-3 w-3 rounded-full', className)} />;
}
