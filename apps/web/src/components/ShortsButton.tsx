import type { Article } from '@repo/domain/client';
import type { Ref } from '@tanstack/db';
import { ilike, useLiveQuery } from '@tanstack/solid-db';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { Video } from 'lucide-solid';
import { createSignal, onMount, Show } from 'solid-js';
import { articlesCollection } from '~/entities/articles';

type ShortsButtonProps = {
  where?: (article: Ref<Article>) => any;
  linkProps: LinkProps;
};

/**
 * Renders a "Shorts" button that only appears when YouTube Shorts exist.
 *
 * The existence query is deferred via `requestAnimationFrame` so it doesn't
 * block the initial render of the parent page.
 */
export function ShortsButton(props: ShortsButtonProps) {
  const [ready, setReady] = createSignal(false);
  onMount(() => requestAnimationFrame(() => setReady(true)));

  const shortsExistQuery = useLiveQuery((q) => {
    if (!ready()) return q.from({ article: articlesCollection }).limit(0);

    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => ilike(article.url, '%youtube.com/shorts%'));

    if (props.where) {
      query = query.where(({ article }) => props.where!(article));
    }

    return query.select(({ article }) => ({ id: article.id })).limit(1);
  });

  const hasShorts = () => ready() && (shortsExistQuery()?.length ?? 0) > 0;

  return (
    <Show when={hasShorts()}>
      <Link {...props.linkProps} class="btn btn-accent btn-sm">
        <Video size={20} />
        <span class="hidden sm:inline">Shorts</span>
      </Link>
    </Show>
  );
}
