import type { Article } from '@repo/domain/client';
import { type Ref, and, ilike, useLiveQuery } from '@tanstack/solid-db';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { Video } from 'lucide-solid';
import { Show } from 'solid-js';
import { articlesCollection } from '~/entities/articles';

type ShortsButtonProps = {
  where?: (article: Ref<Article>) => any;
  linkProps: LinkProps;
};

/** Renders a "Shorts" button that only appears when YouTube Shorts exist. */
export function ShortsButton(props: ShortsButtonProps) {
  const shortsExist = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }) => {
        const base = ilike(article.url, '%youtube.com/shorts%');
        return props.where ? and(base, props.where(article)) : base;
      })
      .orderBy(({ article }) => article.id, 'desc')
      .limit(1),
  );

  return (
    <Show when={(shortsExist()?.length ?? 0) > 0}>
      <Link {...props.linkProps} class="btn btn-accent btn-sm">
        <Video size={20} />
        <span class="hidden sm:inline">Shorts</span>
      </Link>
    </Show>
  );
}
