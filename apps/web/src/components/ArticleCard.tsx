import type { Article, Feed, Tag } from '@repo/shared/types';
import { Link, useNavigate } from '@tanstack/solid-router';
import ArchiveIcon from 'lucide-solid/icons/archive';
import CheckIcon from 'lucide-solid/icons/check';
import InboxIcon from 'lucide-solid/icons/inbox';
import RssIcon from 'lucide-solid/icons/rss';
import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { containsHtml, downshiftHeadings, sanitizeHtml, stripAnchors } from '../utils/html';
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';
import { ArticleTagManager } from './ArticleTagManager';
import { TimeAgo } from './TimeAgo';

interface ArticleCardProps {
  article: Article;
  feeds: Feed[];
  tags: Tag[];
  onUpdateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
}

export function ArticleCard(props: ArticleCardProps) {
  const navigate = useNavigate();

  const feed = () =>
    props.article.feedId ? props.feeds.find((f) => f.id === props.article.feedId) : null;
  const feedName = () => feed()?.title || (props.article.feedId ? 'Loading...' : 'Saved Article');
  const feedIcon = () => feed()?.icon;

  const markAsRead = () => {
    if (!props.article.isRead) {
      props.onUpdateArticle(props.article.id, { isRead: true });
    }
  };

  const isVideo = () => props.article.url && isYouTubeUrl(props.article.url);
  const videoId = () => (props.article.url ? extractYouTubeVideoId(props.article.url) : null);

  const handleCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-tag-manager]')) {
      return;
    }

    markAsRead();
    navigate({
      to: '/articles/$articleId',
      params: { articleId: props.article.id.toString() },
    });
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
        <Show
          when={props.article.feedId}
          fallback={
            <div class="shrink-0 pt-0.5">
              <div class="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
                <RssIcon size={12} class="text-base-content/50 md:size-4" />
              </div>
            </div>
          }
        >
          <Link
            to="/feeds/$feedId"
            params={{ feedId: props.article.feedId! }}
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
                loading="lazy"
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
        </Show>
        <div class="min-w-0 flex-1">
          <h2 class="text-base-content line-clamp-2 text-[15px] leading-snug font-medium md:text-lg">
            {props.article.title}
          </h2>
          <div class="text-base-content/50 flex items-center gap-1.5 text-xs md:text-sm">
            <Show
              when={props.article.feedId}
              fallback={<span class="text-base-content/60 truncate">{feedName()}</span>}
            >
              <Link
                to="/feeds/$feedId"
                params={{ feedId: props.article.feedId! }}
                class="text-base-content/60 truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {feedName()}
              </Link>
            </Show>
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
            innerHTML={stripAnchors(
              downshiftHeadings(
                sanitizeHtml(props.article.description || props.article.content || ''),
              ),
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
              loading="lazy"
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
          <ArticleTagManager articleId={props.article.id} tags={props.tags} />
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
