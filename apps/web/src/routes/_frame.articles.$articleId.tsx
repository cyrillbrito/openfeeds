import { eq, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link, useRouter } from '@tanstack/solid-router';
import { Archive, ArrowLeft, Inbox } from 'lucide-solid';
import { createEffect, createSignal, on, Show, Suspense } from 'solid-js';
import { ArchiveIconButton } from '~/components/ArchiveIconButton';
import { ArticleAudioProvider } from '~/components/ArticleAudioContext';
import { ArticleAudioPlayer } from '~/components/ArticleAudioPlayer';
import { ArticleTagManager } from '~/components/ArticleTagManager';
import { Header } from '~/components/Header';
import { HighlightedArticleContent } from '~/components/HighlightedArticleContent';
import { Loader } from '~/components/Loader';
import { ReadIconButton } from '~/components/ReadIconButton';
import { TimeAgo } from '~/components/TimeAgo';
import { articlesCollection } from '~/entities/articles';
import { $$extractArticleContent } from '~/entities/articles.server';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { containsHtml, downshiftHeadings } from '~/utils/html';
import { extractYouTubeVideoId, isYouTubeUrl } from '~/utils/youtube';

export const Route = createFileRoute('/_frame/articles/$articleId')({
  component: ArticleView,
});

function ArticleView() {
  const params = Route.useParams();
  const router = useRouter();
  const articleId = () => params()?.articleId;

  const articleQuery = useLiveQuery((q) =>
    q.from({ article: articlesCollection }).where(({ article }) => eq(article.id, articleId())),
  );

  const article = () => articleQuery()[0];
  const cleanContent = () => article()?.cleanContent;
  const contentExtractedAt = () => article()?.contentExtractedAt;

  const [isExtracting, setIsExtracting] = createSignal(false);

  // Trigger content extraction when article is loaded but content hasn't been extracted yet
  createEffect(
    on(
      () => article()?.id,
      (id) => {
        const art = article();
        if (!id || !art) return;
        // Skip if already extracted, already extracting, is a video, or has no URL
        if (contentExtractedAt() || isExtracting() || !art.url || isYouTubeUrl(art.url)) return;

        setIsExtracting(true);
        $$extractArticleContent({ data: { id } }).finally(() => {
          setIsExtracting(false);
        });
      },
    ),
  );

  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  const feed = () => {
    const art = article();
    if (!art || !art.feedId || !feedsQuery.data) return null;
    return feedsQuery.data.find((f) => f.id === art.feedId);
  };

  const isVideo = () => {
    const art = article();
    return art?.url && isYouTubeUrl(art.url);
  };

  const videoEmbedUrl = () => {
    const art = article();
    if (!art?.url) return null;
    const videoId = extractYouTubeVideoId(art.url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  };

  const handleBack = () => {
    // Check if we have navigation history from within our app
    // TanStack Router tracks history, so we can check the history state
    const hasAppHistory = window.history.state && window.history.state.key;

    if (hasAppHistory && window.history.length > 1) {
      // User navigated here from within the app, safe to go back
      window.history.back();
    } else {
      // User came from external link or bookmark, navigate to inbox
      router.navigate({ to: '/inbox' });
    }
  };

  return (
    <>
      <Header title={article()?.title}>
        <button onClick={handleBack} class="btn btn-ghost btn-sm">
          <ArrowLeft size={20} />
          <span class="hidden sm:inline">Back</span>
        </button>
      </Header>

      <div class="mx-auto min-h-screen w-full max-w-2xl px-4 py-4 md:px-6 md:py-6">
        {/* Content */}
        <Suspense
          fallback={
            <div class="flex justify-center py-12">
              <Loader />
            </div>
          }
        >
          <Show
            when={article()}
            fallback={
              <Show when={articleQuery.isError}>
                <div class="py-8 text-center">
                  <p class="text-error">Failed to load article</p>
                </div>
              </Show>
            }
          >
            {(art) => (
              <article>
                {/* Article Header */}
                <header class="mb-8">
                  <div class="mb-4 flex gap-3">
                    <h1 class="text-base-content flex-1 text-2xl leading-tight font-bold md:text-3xl">
                      {art().title}
                    </h1>
                    <div class="flex shrink-0 gap-2">
                      <ArchiveIconButton
                        read={art().isRead || false}
                        archived={art().isArchived || false}
                        setArchived={(isArchived) => {
                          articlesCollection.update(art().id, (draft) => {
                            draft.isArchived = isArchived;
                          });
                        }}
                      />
                      <ReadIconButton
                        read={art().isRead || false}
                        setRead={(isRead) => {
                          articlesCollection.update(art().id, (draft) => {
                            draft.isRead = isRead;
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div class="text-base-content/70 flex flex-wrap items-center gap-2 text-sm">
                    <div class="flex items-center gap-1">
                      <Show
                        when={art().isArchived}
                        fallback={<Inbox size={16} class="text-base-content/40" />}
                      >
                        <Archive size={16} class="text-base-content/40" />
                      </Show>
                      <Show
                        when={feed()}
                        fallback={
                          <Show when={!art().feedId}>
                            <span class="text-base-content/60 font-medium">Saved Article</span>
                          </Show>
                        }
                      >
                        <Link
                          to="/feeds/$feedId"
                          params={{ feedId: art().feedId! }}
                          class="text-primary font-medium hover:underline"
                        >
                          {feed()!.title}
                        </Link>
                      </Show>
                    </div>

                    <Show when={art().author}>
                      <span>•</span>
                      <span>By {art().author}</span>
                    </Show>

                    <Show when={art().pubDate}>
                      <span>•</span>
                      <TimeAgo date={art().pubDate!} />
                    </Show>

                    <Show when={art().url}>
                      <span>•</span>
                      <a
                        href={art().url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        View Original
                      </a>
                    </Show>
                  </div>

                  {/* Article Tags */}
                  <Show when={tagsQuery.data}>
                    <div class="mt-4">
                      <ArticleTagManager articleId={art().id} tags={tagsQuery()} />
                    </div>
                  </Show>
                </header>

                {/* Divider */}
                <div class="border-base-300 mb-8 border-t"></div>

                {/* Audio Player and Content - for non-video articles with content */}
                <Show when={!isVideo() && cleanContent()}>
                  <ArticleAudioProvider>
                    <ArticleAudioPlayer articleId={art().id} />
                    <HighlightedArticleContent
                      html={cleanContent()!}
                      class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none"
                    />
                  </ArticleAudioProvider>
                </Show>

                {/* Video Content */}
                <Show when={isVideo() && videoEmbedUrl()}>
                  <div class="mb-8">
                    <div class="aspect-video overflow-hidden rounded-lg shadow-lg">
                      <iframe
                        src={videoEmbedUrl()!}
                        title={art().title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                        class="h-full w-full border-0"
                      ></iframe>
                    </div>
                  </div>

                  {/* Video Description */}
                  <Show when={cleanContent() || art().description || art().content}>
                    <div class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none">
                      <Show
                        when={cleanContent()}
                        fallback={
                          <div>
                            <h2 class="mb-3 text-xl font-semibold">Description</h2>
                            <Show
                              when={containsHtml(art().description || art().content || '')}
                              fallback={
                                <p class="whitespace-pre-wrap">
                                  {art().description || art().content}
                                </p>
                              }
                            >
                              <div
                                innerHTML={downshiftHeadings(
                                  art().description || art().content || '',
                                  2,
                                )}
                              />
                            </Show>
                          </div>
                        }
                      >
                        <div innerHTML={cleanContent()!} />
                      </Show>
                    </div>
                  </Show>
                </Show>

                {/* Loading state for content extraction */}
                <Show when={!isVideo() && (articleQuery.isLoading || isExtracting())}>
                  <div class="flex flex-col items-center justify-center gap-3 py-12">
                    <Loader />
                    <p class="text-base-content/60 text-sm">Preparing readable content...</p>
                  </div>
                </Show>

                {/* No content fallback - only show after extraction has been attempted */}
                <Show
                  when={
                    !isVideo() &&
                    !articleQuery.isLoading &&
                    !isExtracting() &&
                    !cleanContent() &&
                    contentExtractedAt()
                  }
                >
                  <div class="py-8 text-center">
                    <p class="text-base-content/60">
                      Readable content could not be extracted for this article.
                    </p>
                    <Show when={art().url}>
                      <a
                        href={art().url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-primary btn-sm mt-4"
                      >
                        View Original Article
                      </a>
                    </Show>
                  </div>
                </Show>
              </article>
            )}
          </Show>
        </Suspense>
      </div>
    </>
  );
}
