import { Link, type LinkProps } from '@tanstack/solid-router';
import { Video } from 'lucide-solid';
import { Show } from 'solid-js';

interface ShortsButtonProps {
  shortsExist: boolean;
  linkProps: LinkProps;
}

/** Renders a "Shorts" button that only appears when YouTube Shorts exist. */
export function ShortsButton(props: ShortsButtonProps) {
  return (
    <Show when={props.shortsExist}>
      <Link {...props.linkProps} class="btn btn-accent btn-sm">
        <Video size={20} />
        <span class="hidden sm:inline">Shorts</span>
      </Link>
    </Show>
  );
}
