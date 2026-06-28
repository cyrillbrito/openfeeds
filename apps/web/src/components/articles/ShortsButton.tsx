import { Link, type LinkProps } from '@tanstack/react-router';
import { Video } from 'lucide-react';

interface ShortsButtonProps {
  shortsExist: boolean;
  linkProps: LinkProps;
}

/** Renders a "Shorts" button that only appears when YouTube Shorts exist. */
export function ShortsButton({ shortsExist, linkProps }: ShortsButtonProps) {
  if (!shortsExist) return null;

  return (
    <Link {...linkProps} className="btn btn-accent btn-sm">
      <Video size={20} />
      <span className="hidden sm:inline">Shorts</span>
    </Link>
  );
}
