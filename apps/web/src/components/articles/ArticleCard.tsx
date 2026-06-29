import type { Article } from '@repo/domain/client';
import { Link } from '@tanstack/react-router';
import { Archive, Check, Inbox, Rss } from 'lucide-react';
import { memo } from 'react';
import { twMerge } from 'tailwind-merge';
import { TimeAgo } from '~/components/TimeAgo';
import { YouTubeThumbnail } from '~/components/YouTubeThumbnail';
import { containsHtml, downshiftHeadings } from '~/utils/html';
import { extractYouTubeVideoId, isYouTubeUrl } from '~/utils/youtube';
import { useArticleList } from './ArticleListContext.shared';
import { useArticleTagsForArticle } from './ArticleListContext';
import { ArticleTagManager } from './ArticleTagManager';

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = memo(function ArticleCard({ article }: ArticleCardProps) {
  const ctx = useArticleList();
  const articleTags = useArticleTagsForArticle(article.id);

  const feed = article.feedId ? ctx.feeds.find((f) => f.id === article.feedId) : null;
  const feedName = feed?.title || (article.feedId ? 'Loading...' : 'Saved Article');
  const feedIcon = feed?.icon;

  const markAsRead = () => {
    if (!article.isRead) {
      ctx.updateArticle(article.id, { isRead: true });
    }
  };

  const isVideo = article.url ? isYouTubeUrl(article.url) : false;
  const videoId = article.url ? extractYouTubeVideoId(article.url) : null;

  const handleMarkRead = () => {
    ctx.updateArticle(article.id, { isRead: !article.isRead });
  };

  const handleArchive = () => {
    ctx.updateArticle(article.id, { isArchived: !article.isArchived });
  };

  return (
    <article
      className={twMerge(
        'hover:bg-base-200/50 relative w-full cursor-pointer px-4 transition-all md:px-6',
        article.isRead && 'opacity-50',
        isVideo ? 'py-3 md:py-4' : 'py-4 md:py-5',
      )}
    >
      {/* Stretched link — covers entire card for navigation */}
      <Link
        to="/articles/$articleId"
        params={{ articleId: article.id }}
        className="absolute inset-0"
        tabIndex={-1}
        aria-hidden="true"
        onClick={markAsRead}
      />
      <div className="mb-1.5 flex gap-2 md:gap-3">
        {article.feedId ? (
          <Link
            to="/feeds/$feedId"
            params={{ feedId: article.feedId }}
            className="relative shrink-0 pt-0.5"
          >
            {feedIcon ? (
              <>
                <img
                  src={feedIcon}
                  alt={feedName}
                  className="bg-base-300 size-8 rounded-full object-cover md:size-10"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="bg-base-300 flex hidden size-8 items-center justify-center rounded-full md:size-10">
                  <Rss size={12} className="text-base-content/50 md:size-4" />
                </div>
              </>
            ) : (
              <div className="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
                <Rss size={12} className="text-base-content/50 md:size-4" />
              </div>
            )}
          </Link>
        ) : (
          <div className="shrink-0 pt-0.5">
            <div className="bg-base-300 flex size-8 items-center justify-center rounded-full md:size-10">
              <Rss size={12} className="text-base-content/50 md:size-4" />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-base-content line-clamp-2 text-[15px] leading-snug font-medium md:text-lg">
            <Link
              to="/articles/$articleId"
              params={{ articleId: article.id }}
              className="relative"
              onClick={markAsRead}
            >
              {article.title}
            </Link>
          </h2>
          <div className="text-base-content/50 flex items-center gap-1.5 text-xs md:text-sm">
            {article.feedId ? (
              <Link
                to="/feeds/$feedId"
                params={{ feedId: article.feedId }}
                className="text-base-content/60 relative truncate hover:underline"
              >
                {feedName}
              </Link>
            ) : (
              <span className="text-base-content/60 truncate">{feedName}</span>
            )}
            <span>·</span>
            <TimeAgo date={new Date(article.pubDate!)} tooltipBottom />
          </div>
        </div>
      </div>

      {/* Description */}
      {!isVideo && (article.description || article.content) && (
        containsHtml(article.description || article.content || '') ? (
          <div
            className="prose prose-sm text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 mt-2 mb-3 line-clamp-5 text-sm leading-relaxed md:text-base"
            dangerouslySetInnerHTML={{ __html: downshiftHeadings(article.description || article.content || '') }}
          />
        ) : (
          <p className="text-base-content/80 mt-2 mb-3 line-clamp-5 text-sm leading-relaxed md:text-base">
            {article.description || article.content}
          </p>
        )
      )}

      {/* YouTube Thumbnail */}
      {isVideo && videoId && <YouTubeThumbnail videoId={videoId} alt={article.title} />}

      {/* Tags */}
      {ctx.tags.length > 0 && (
        <div className="relative mb-2">
          <ArticleTagManager
            tags={ctx.tags}
            articleTags={articleTags}
            onAddTag={(tagId) => ctx.addTag(article.id, tagId)}
            onRemoveTag={ctx.removeTag}
          />
        </div>
      )}

      {/* Actions */}
      <div className="relative -ml-1 flex items-center gap-4">
        <button
          className={twMerge(
            'flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors md:gap-1.5 md:text-sm',
            article.isRead
              ? 'text-base-content/40 hover:text-primary hover:bg-primary/10'
              : 'text-base-content/60 hover:text-primary hover:bg-primary/10',
          )}
          onClick={handleMarkRead}
          title={article.isRead ? 'Mark as unread' : 'Mark as read'}
        >
          <Check size={14} className="md:size-4" />
          <span>{article.isRead ? 'Read' : 'Mark read'}</span>
        </button>

        <button
          className={twMerge(
            'flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors md:gap-1.5 md:text-sm',
            article.isArchived
              ? 'text-primary hover:bg-primary/10'
              : 'text-base-content/60 hover:text-primary hover:bg-primary/10',
          )}
          onClick={handleArchive}
          title={article.isArchived ? 'Unarchive' : 'Archive'}
        >
          {article.isArchived ? (
            <Inbox size={14} className="md:size-4" />
          ) : (
            <Archive size={14} className="md:size-4" />
          )}
          <span>{article.isArchived ? 'Archived' : 'Archive'}</span>
        </button>
      </div>
    </article>
  );
});
