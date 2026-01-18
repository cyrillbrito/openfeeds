import type { Article, Feed, Tag } from '@repo/shared/types';
import { Link, useNavigate } from '@tanstack/solid-router';
import ArchiveIcon from 'lucide-solid/icons/archive';
import CheckIcon from 'lucide-solid/icons/check';
import ExternalLinkIcon from 'lucide-solid/icons/external-link';
import InboxIcon from 'lucide-solid/icons/inbox';
import RssIcon from 'lucide-solid/icons/rss';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { containsHtml, downshiftHeadings, sanitizeHtml } from '../utils/html';
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';
import { ArticleTagManager } from './ArticleTagManager';
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

  const handleMarkRead = (e: MouseEvent) => {
    e.stopPropagation();
    props.onUpdateArticle(props.article.id, { isRead: !props.article.isRead });
  };

  const handleArchive = (e: MouseEvent) => {
    e.stopPropagation();
    props.onUpdateArticle(props.article.id, { isArchived: !props.article.isArchived });
  };

  return (
    <article
      class={twMerge(
        'hover:bg-base-200/50 w-full cursor-pointer px-4 transition-all md:px-6',
        props.article.isRead && 'opacity-50',
        // Video articles have thumbnails adding visual bulk; text-only articles need more padding for breathing room
        isVideo() ? 'py-3 md:py-4' : 'py-4 md:py-5',
      )}
      onClick={handleCardClick}
    >
      <div class="mb-1.5 flex gap-2 md:gap-3">
        <Link
          to="/feeds/$feedId"
          params={{ feedId: props.article.feedId?.toString() }}
          class="shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Show
            when={feedIcon()}
            fallback={
              <div class="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
                <RssIcon size={12} class="text-base-content/50 md:size-4" />
              </div>
            }
          >
            <img
              src={feedIcon() ?? undefined}
              alt={feedName()}
              class="bg-base-300 size-8 rounded-full object-cover md:size-10"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div class="bg-base-300 flex hidden size-8 items-center justify-center rounded-full md:size-10">
              <RssIcon size={12} class="text-base-content/50 md:size-4" />
            </div>
          </Show>
        </Link>
        <div class="min-w-0 flex-1">
          <h2 class="text-base-content line-clamp-2 text-[15px] leading-snug font-medium md:text-lg">
            {props.article.title}
            <Show when={!hasRichContent() && props.article.url}>
              <ExternalLinkIcon
                size={12}
                class="text-base-content/40 ml-1 inline-block shrink-0 md:size-3.5"
              />
            </Show>
          </h2>
          <div class="text-base-content/50 flex items-center gap-1.5 text-xs md:text-sm">
            <Link
              to="/feeds/$feedId"
              params={{ feedId: props.article.feedId?.toString() }}
              class="text-base-content/60 truncate hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {feedName()}
            </Link>
            <span>·</span>
            <TimeAgo date={new Date(props.article.pubDate!)} tooltipBottom />
          </div>
        </div>
      </div>

      {/* Description */}
      <Show when={!isVideo() && (props.article.description || props.article.content)}>
        <Show
          when={containsHtml(props.article.description || props.article.content || '')}
          fallback={
            <p class="text-base-content/80 mt-2 mb-3 line-clamp-5 text-sm leading-relaxed md:text-base">
              {props.article.description || props.article.content}
            </p>
          }
        >
          <div
            class="prose prose-sm text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 mt-2 mb-3 line-clamp-5 text-sm leading-relaxed md:text-base"
            innerHTML={downshiftHeadings(
              sanitizeHtml(props.article.description || props.article.content || ''),
            )}
          />
        </Show>
      </Show>

      {/* YouTube Thumbnail */}
      <Show when={isVideo() && videoId()}>
        <div class="mb-2 w-full overflow-hidden rounded-lg md:max-w-2xl">
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
        </div>
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

      {/* Actions */}
      <div class="-ml-1 flex items-center gap-4">
        <button
          class={twMerge(
            'flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors md:gap-1.5 md:text-sm',
            props.article.isRead
              ? 'text-base-content/40 hover:text-primary hover:bg-primary/10'
              : 'text-base-content/60 hover:text-primary hover:bg-primary/10',
          )}
          onClick={handleMarkRead}
          title={props.article.isRead ? 'Mark as unread' : 'Mark as read'}
        >
          <CheckIcon size={14} class="md:size-4" />
          <span>{props.article.isRead ? 'Read' : 'Mark read'}</span>
        </button>

        <button
          class={twMerge(
            'flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors md:gap-1.5 md:text-sm',
            props.article.isArchived
              ? 'text-primary hover:bg-primary/10'
              : 'text-base-content/60 hover:text-primary hover:bg-primary/10',
          )}
          onClick={handleArchive}
          title={props.article.isArchived ? 'Unarchive' : 'Archive'}
        >
          <Show
            when={props.article.isArchived}
            fallback={<ArchiveIcon size={14} class="md:size-4" />}
          >
            <InboxIcon size={14} class="md:size-4" />
          </Show>
          <span>{props.article.isArchived ? 'Archived' : 'Archive'}</span>
        </button>
      </div>
    </article>
  );
}
