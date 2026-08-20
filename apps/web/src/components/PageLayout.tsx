import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface PageLayoutProps {
  title: ReactNode;
  mobileOnlyTitle?: boolean;
  headerActions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Standard page layout: sticky header bar + content container.
 *
 * The header renders a hamburger menu (mobile), page title, and optional
 * action buttons on the right. The content is wrapped in a `content-container`.
 */
export function PageLayout({ title, mobileOnlyTitle, headerActions, className, children }: PageLayoutProps) {
  return (
    <>
      <header
        className={twMerge(
          'bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow print:hidden',
          mobileOnlyTitle && 'lg:hidden',
        )}
      >
        <div className="content-container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <label htmlFor="my-drawer" className="btn btn-square btn-ghost lg:hidden">
              <Menu size={24} />
            </label>

            <h1
              className={twMerge(
                'text-base-content text-lg font-semibold',
                !mobileOnlyTitle && 'hidden sm:block',
                mobileOnlyTitle && 'sm:hidden',
              )}
            >
              {title}
            </h1>
          </div>

          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      </header>

      <div className={twMerge('content-container py-3 sm:py-6', className)}>{children}</div>
    </>
  );
}
