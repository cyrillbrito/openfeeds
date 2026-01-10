import type { Article, Feed, Tag } from '@repo/shared/types';
import { Link, useNavigate } from '@tanstack/solid-router';
import ArchiveIcon from 'lucide-solid/icons/archive';
import InboxIcon from 'lucide-solid/icons/inbox';
import PlayIcon from 'lucide-solid/icons/play';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';
import { ArchiveIconButton } from './ArchiveIconButton';
import { ArticleTagManager } from './ArticleTagManager';
import { Card } from './Card';
import { HeaderLinkStyle } from './HeaderLink';
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

  const markAsRead = () => {
    if (!props.article.isRead) {
      props.onUpdateArticle(props.article.id, { isRead: true });
    }
  };

  const isVideo = () => props.article.url && isYouTubeUrl(props.article.url);
  const videoId = () => {
    if (!props.article.url) return null;
    return extractYouTubeVideoId(props.article.url);
  };

  const shouldOpenInArticleView = () => {
    return isVideo() || props.article.hasCleanContent;
  };

  const handleCardClick = (e: MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-tag-manager]')) {
      return;
    }

    if (shouldOpenInArticleView()) {
      markAsRead();
      navigate({
        to: '/articles/$articleId',
        params: { articleId: props.article.id.toString() },
      });
    }
  };

  return (
    <Card
      class={twMerge(
        props.article.isRead && 'opacity-60 grayscale-50 transition-[filter,opacity]',
        shouldOpenInArticleView() && 'cursor-pointer',
      )}
      onClick={handleCardClick}
    >
      {/* Header with title and read button */}
      <div class="mb-2">
        <div class="flex gap-3">
          <h2 class="card-title line-clamp-2 flex-1 text-sm leading-tight sm:text-xl">
            <Show
              when={shouldOpenInArticleView()}
              fallback={
                <a
                  href={props.article.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={markAsRead}
                  class="hover:underline"
                >
                  <HeaderLinkStyle>{props.article.title}</HeaderLinkStyle>
                </a>
              }
            >
              <span class="hover:text-primary cursor-pointer transition-colors">
                <HeaderLinkStyle>{props.article.title}</HeaderLinkStyle>
              </span>
            </Show>
          </h2>
          <div class="flex shrink-0 gap-2">
            <ArchiveIconButton
              read={props.article.isRead || false}
              archived={props.article.isArchived || false}
              setArchived={(isArchived) => {
                props.onUpdateArticle(props.article.id, { isArchived });
              }}
            />
            <ReadIconButton
              read={props.article.isRead || false}
              setRead={(isRead) => {
                props.onUpdateArticle(props.article.id, { isRead });
              }}
            />
          </div>
        </div>

        {/* Meta info */}
        <div class="flex items-center gap-2 text-sm">
          <div class="flex items-center gap-1">
            <Show
              when={props.article.isArchived}
              fallback={<InboxIcon size={16} class="text-base-content/40" />}
            >
              <ArchiveIcon size={16} class="text-base-content/40" />
            </Show>
            <Link
              to="/feeds/$feedId"
              params={{ feedId: props.article.feedId?.toString() }}
              class="text-primary font-medium hover:underline"
            >
              {feedName()}
            </Link>
          </div>
          <span class="text-base-content-gray">•</span>
          <TimeAgo
            class="text-base-content-gray"
            date={new Date(props.article.pubDate!)}
            tooltipBottom
          />
        </div>

        {/* Article tags */}
        <div class="mt-2" data-tag-manager>
          <ArticleTagManager
            tags={props.tags}
            selectedIds={props.article.tags}
            onSelectionChange={(tagIds) => {
              props.onUpdateArticle(props.article.id, { tags: tagIds });
            }}
          />
        </div>
      </div>

      {/* YouTube Video Thumbnail */}
      <Show when={isVideo() && videoId()}>
        <div class="group relative mb-4 w-full max-w-md cursor-pointer overflow-hidden rounded-lg bg-black">
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
            <div class="rounded-full bg-red-600 p-3 transition-all duration-200 hover:scale-110 hover:bg-red-700 sm:p-4">
              <PlayIcon class="ml-0.5 h-6 w-6 text-white sm:h-8 sm:w-8" />
            </div>
          </div>
          <div class="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-1 text-xs font-medium text-white">
            YouTube
          </div>
        </div>
      </Show>

      {/* Description/content */}
      <Show when={props.article.description || props.article.content}>
        <div class="text-base-content/80 line-clamp-2 text-xs leading-relaxed sm:line-clamp-5 sm:text-base">
          {props.article.description || props.article.content}
        </div>
      </Show>
    </Card>
  );
}
