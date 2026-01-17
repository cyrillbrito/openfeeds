import type { Article, Feed, Tag } from '@repo/shared/types';
import { Link, useNavigate } from '@tanstack/solid-router';
import ExternalLinkIcon from 'lucide-solid/icons/external-link';
import PlayIcon from 'lucide-solid/icons/play';
import RssIcon from 'lucide-solid/icons/rss';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';
import { ArchiveIconButton } from './ArchiveIconButton';
import { ArticleTagManager } from './ArticleTagManager';
import { ReadIconButton } from './ReadIconButton';
import { TimeAgo } from './TimeAgo';

interface ArticleCardProps {
  article: Article;
  feeds: Feed[];
  tags: Tag[];
  onUpdateArticle: (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean; tags?: string[] },
  ) => void;
}

export function ArticleCard(props: ArticleCardProps) {
  const navigate = useNavigate();

  const feed = () => props.feeds.find((f) => f.id === props.article.feedId);
  const feedName = () => feed()?.title || 'Loading...';
  const feedIcon = () => feed()?.icon;

  const markAsRead = () => {
    if (!props.article.isRead) {
      props.onUpdateArticle(props.article.id, { isRead: true });
    }
  };

  const isVideo = () => props.article.url && isYouTubeUrl(props.article.url);
  const videoId = () => (props.article.url ? extractYouTubeVideoId(props.article.url) : null);
  const hasRichContent = () => isVideo() || props.article.hasCleanContent;

  const handleCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-tag-manager]')) {
      return;
    }

    markAsRead();

    if (hasRichContent()) {
      navigate({
        to: '/articles/$articleId',
        params: { articleId: props.article.id.toString() },
      });
    } else if (props.article.url) {
      window.open(props.article.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <article
      class={twMerge(
        'flex gap-3 cursor-pointer transition-opacity px-4 py-3',
        props.article.isRead && 'opacity-60',
      )}
      onClick={handleCardClick}
    >
      {/* Feed icon - like Twitter avatar */}
      <div class="shrink-0 pt-0.5">
        <Link
          to="/feeds/$feedId"
          params={{ feedId: props.article.feedId?.toString() }}
          class="block"
          onClick={(e) => e.stopPropagation()}
        >
          <Show
            when={feedIcon()}
            fallback={
              <div class="size-10 rounded-full bg-base-300 flex items-center justify-center">
                <RssIcon size={18} class="text-base-content/50" />
              </div>
            }
          >
            <img
              src={feedIcon()}
              alt={feedName()}
              class="size-10 rounded-full bg-base-300 object-cover"
              onError={(e) => {
                // Hide broken image and show fallback
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div class="size-10 rounded-full bg-base-300 flex items-center justify-center hidden">
              <RssIcon size={18} class="text-base-content/50" />
            </div>
          </Show>
        </Link>
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        {/* Title - prominent, above source */}
        <h2 class="font-semibold leading-snug text-base-content line-clamp-2 mb-0.5">
          <span class="hover:underline decoration-base-content/30 underline-offset-2">
            {props.article.title}
          </span>
          <Show when={!hasRichContent() && props.article.url}>
            <ExternalLinkIcon size={14} class="text-base-content/40 ml-1 inline-block shrink-0" />
          </Show>
        </h2>

        {/* Meta: source + time */}
        <div class="flex items-center gap-1.5 text-sm text-base-content/60 mb-2">
          <Link
            to="/feeds/$feedId"
            params={{ feedId: props.article.feedId?.toString() }}
            class="hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {feedName()}
          </Link>
          <span>·</span>
          <TimeAgo date={new Date(props.article.pubDate!)} tooltipBottom />
        </div>

        {/* YouTube Video Thumbnail */}
        <Show when={isVideo() && videoId()}>
          <div class="group relative mb-3 w-full cursor-pointer overflow-hidden rounded-xl bg-black">
            <div class="aspect-video w-full">
              <img
                src={`https://img.youtube.com/vi/${videoId()}/mqdefault.jpg`}
                alt={props.article.title}
                class="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://img.youtube.com/vi/${videoId()}/hqdefault.jpg`;
                }}
              />
            </div>
            <div class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <div class="rounded-full bg-red-600 p-3 transition-transform hover:scale-110">
                <PlayIcon class="ml-0.5 size-6 text-white" />
              </div>
            </div>
            <div class="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white">
              YouTube
            </div>
          </div>
        </Show>

        {/* Description - subtle */}
        <Show when={props.article.description || props.article.content}>
          <p class="text-base-content/70 text-sm line-clamp-2 mb-2 leading-relaxed">
            {props.article.description || props.article.content}
          </p>
        </Show>

        {/* Tags */}
        <Show when={props.tags.length > 0}>
          <div class="mb-2" data-tag-manager>
            <ArticleTagManager
              tags={props.tags}
              selectedIds={props.article.tags}
              onSelectionChange={(tagIds) => {
                props.onUpdateArticle(props.article.id, { tags: tagIds });
              }}
            />
          </div>
        </Show>

        {/* Actions row - Twitter style */}
        <div class="flex items-center gap-6 -ml-2">
          <ReadIconButton
            read={props.article.isRead || false}
            setRead={(isRead) => {
              props.onUpdateArticle(props.article.id, { isRead });
            }}
          />
          <ArchiveIconButton
            read={props.article.isRead || false}
            archived={props.article.isArchived || false}
            setArchived={(isArchived) => {
              props.onUpdateArticle(props.article.id, { isArchived });
            }}
          />
        </div>
      </div>
    </article>
  );
}
