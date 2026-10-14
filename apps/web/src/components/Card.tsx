import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isClickable = !!onClick;

  return (
    <div
      className={twMerge(
        'card bg-base-100 border-base-300 min-w-0 rounded-lg border shadow-sm transition-shadow sm:rounded-2xl',
        isClickable && 'hover:border-base-content/20 hover:shadow-lg',
        className,
      )}
      onClick={onClick}
    >
      <div className="card-body p-3 sm:p-6">{children}</div>
    </div>
  );
}
