import { createId } from '@repo/shared/utils';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Archive, ArrowLeft, Inbox } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { ArchiveIconButton } from '~/components/ArchiveIconButton';
import { ArticleAudioProvider } from '~/components/ArticleAudioContext';
import { ArticleAudioPlayer } from '~/components/ArticleAudioPlayer';
import { ArticleTagManager } from '~/components/articles/ArticleTagManager';
import { HighlightedArticleContent } from '~/components/HighlightedArticleContent';
import { Loader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { PrintIconButton } from '~/components/PrintIconButton';
import { ReadIconButton } from '~/components/ReadIconButton';
import { TimeAgo } from '~/components/TimeAgo';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { feedsCollection } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { api, unwrap } from '~/lib/api-client';
import articlePrintCss from '~/styles/article-print.css?url';
import { containsHtml, downshiftHeadings } from '~/utils/html';
import { extractYouTubeVideoId, isYouTubeUrl } from '~/utils/youtube';

export const Route = createFileRoute('/_frame/articles/$articleId')({
  component: ArticleView,
  head: () => ({
    links: [{ rel: 'stylesheet', href: articlePrintCss, media: 'print' }],
  }),
});

function handleRemoveTag(articleTagId: string) {
  articleTagsCollection.delete(articleTagId);
}

function ArticleView() {
  const { articleId } = Route.useParams();
  const router = useRouter();

  const { data: articlesData, isLoading: articlesLoading, isError: articlesError } = useLiveQuery(
    (q) => q.from({ article: articlesCollection }).where(({ article }) => eq(article.id, articleId)),
    [articleId],
  );
  const article = articlesData?.[0];

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const trackedArticleIdRef = useRef<string | null>(null);

  // Track article view once per article
  useEffect(() => {
    if (!article?.id) return;
    if (trackedArticleIdRef.current === article.id) return;
    trackedArticleIdRef.current = article.id;
    posthog.capture('articles:article_view', {
      article_id: article.id,
      feed_id: article.feedId,
      source: 'direct',
    });
  }, [article?.id]);

  // Trigger content extraction when article loads without extracted content
  useEffect(() => {
    if (!article?.id) return;
    if (article.contentExtractedAt || isExtracting || !article.url || isYouTubeUrl(article.url)) return;
    setIsExtracting(true);
    setExtractionError(null);
    unwrap(api.api.articles['extract-content'].$post({ json: { id: article.id } }))
      .catch((err: Error) => setExtractionError(err.message))
      .finally(() => setIsExtracting(false));
  }, [article?.id]);

  const { data: feedsData } = useLiveQuery(
    (q) =>
      q.from({ feed: feedsCollection }).where(({ feed }) => eq(feed.id, article?.feedId ?? '')),
    [article?.feedId],
  );
  const tags = useTags();

  const { data: articleTagsData } = useLiveQuery(
    (q) =>
      q
        .from({ articleTag: articleTagsCollection })
        .where(({ articleTag }) => eq(articleTag.articleId, articleId)),
    [articleId],
  );

  const handleAddTag = (tagId: string) => {
    articleTagsCollection.insert({
      id: createId(),
      userId: '',
      articleId,
      tagId,
    });
  };

  const feed = feedsData?.[0] ?? null;

  const isVideo = article?.url && isYouTubeUrl(article.url);
  const videoEmbedUrl = (() => {
    if (!article?.url) return null;
    const videoId = extractYouTubeVideoId(article.url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  })();

  const handleBack = () => {
    const hasAppHistory = window.history.state && window.history.state.key;
    if (hasAppHistory && window.history.length > 1) {
      window.history.back();
    } else {
      void router.navigate({ to: '/inbox' });
    }
  };

  return (
    <PageLayout
      title={article?.title ?? 'Article'}
      headerActions={
        <button onClick={handleBack} className="btn btn-ghost btn-sm">
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">Back</span>
        </button>
      }
      className="min-h-screen py-4 md:py-6"
    >
      {articlesLoading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : articlesError ? (
        <div className="py-8 text-center">
          <p className="text-error">Failed to load article</p>
        </div>
      ) : article ? (
        <article>
          <header className="mb-8">
            <div className="mb-4 flex gap-3">
              <h1 className="text-base-content flex-1 text-2xl leading-tight font-bold md:text-3xl">
                {article.title}
              </h1>
              <div className="flex shrink-0 gap-2 print:hidden">
                <PrintIconButton />
                <ArchiveIconButton
                  read={article.isRead || false}
                  archived={article.isArchived || false}
                  setArchived={(isArchived) => {
                    articlesCollection.update(article.id, (draft) => {
                      draft.isArchived = isArchived;
                    });
                  }}
                />
                <ReadIconButton
                  read={article.isRead || false}
                  setRead={(isRead) => {
                    articlesCollection.update(article.id, (draft) => {
                      draft.isRead = isRead;
                    });
                  }}
                />
              </div>
            </div>

            <div className="text-base-content/70 flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                {article.isArchived ? (
                  <Archive size={16} className="text-base-content/40 print:hidden" />
                ) : (
                  <Inbox size={16} className="text-base-content/40 print:hidden" />
                )}
                {feed ? (
                  <Link
                    to="/feeds/$feedId"
                    params={{ feedId: article.feedId! }}
                    className="text-primary font-medium hover:underline"
                  >
                    {feed.title}
                  </Link>
                ) : !article.feedId ? (
                  <span className="text-base-content/60 font-medium">Saved Article</span>
                ) : null}
              </div>

              {article.author && (
                <>
                  <span>•</span>
                  <span>By {article.author}</span>
                </>
              )}

              {article.pubDate && (
                <>
                  <span>•</span>
                  <TimeAgo date={article.pubDate} className="print:hidden" />
                  <span className="hidden print:inline">
                    {new Date(article.pubDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </>
              )}

              {article.url && (
                <>
                  <span className="print:hidden">•</span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline print:hidden"
                  >
                    View Original
                  </a>
                </>
              )}
            </div>

            {tags.length > 0 && (
              <div className="mt-4 print:hidden">
                <ArticleTagManager
                  tags={tags}
                  articleTags={articleTagsData ?? []}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />
              </div>
            )}
          </header>

          <div className="border-base-300 mb-8 border-t"></div>

          {!isVideo && article.cleanContent && (
            <ArticleAudioProvider>
              <ArticleAudioPlayer articleId={article.id} />
              <HighlightedArticleContent
                html={article.cleanContent}
                className="prose prose-lg xl:prose-xl text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none"
              />
            </ArticleAudioProvider>
          )}

          {isVideo && videoEmbedUrl && (
            <div className="mb-8">
              <div className="aspect-video overflow-hidden rounded-lg shadow-lg">
                <iframe
                  src={videoEmbedUrl}
                  title={article.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full border-0"
                ></iframe>
              </div>
            </div>
          )}

          {isVideo && (article.cleanContent || article.description || article.content) && (
            <div className="prose prose-lg xl:prose-xl text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none">
              {article.cleanContent ? (
                <div dangerouslySetInnerHTML={{ __html: article.cleanContent }} />
              ) : (
                <div>
                  <h2 className="mb-3 text-xl font-semibold">Description</h2>
                  {containsHtml(article.description || article.content || '') ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: downshiftHeadings(article.description || article.content || '', 2),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{article.description || article.content}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!isVideo && (articlesLoading || isExtracting) && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader />
              <p className="text-base-content/60 text-sm">Preparing readable content...</p>
            </div>
          )}

          {!isVideo && !isExtracting && extractionError && (
            <>
              <div className="bg-base-200 mb-6 rounded-lg p-4 text-center">
                <p className="text-base-content/60 text-sm">{extractionError}</p>
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm mt-3"
                  >
                    View Original Article
                  </a>
                )}
              </div>

              {(article.description || article.content) && (
                <div className="prose prose-lg xl:prose-xl text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none">
                  {containsHtml(article.description || article.content || '') ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: downshiftHeadings(article.description || article.content || '', 2),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{article.description || article.content}</p>
                  )}
                </div>
              )}
            </>
          )}

          {!isVideo && !articlesLoading && !isExtracting && !article.cleanContent && article.contentExtractedAt && (
            <div className="py-8 text-center">
              <p className="text-base-content/60">
                Readable content could not be extracted for this article.
              </p>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm mt-4"
                >
                  View Original Article
                </a>
              )}
            </div>
          )}
        </article>
      ) : null}
    </PageLayout>
  );
}
