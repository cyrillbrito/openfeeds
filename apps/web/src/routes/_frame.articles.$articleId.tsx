import { createFileRoute, Link, useRouter } from '@tanstack/solid-router';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import ArchiveIcon from 'lucide-solid/icons/archive';
import ArrowLeftIcon from 'lucide-solid/icons/arrow-left';
import InboxIcon from 'lucide-solid/icons/inbox';
import { Show, Suspense } from 'solid-js';
import { ArchiveIconButton } from '../components/ArchiveIconButton';
import { ArticleTagManager } from '../components/ArticleTagManager';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Loader } from '../components/Loader';
import { ReadIconButton } from '../components/ReadIconButton';
import { TimeAgo } from '../components/TimeAgo';
import { useArticle, useUpdateArticle } from '../hooks/queries';
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';

export const Route = createFileRoute('/_frame/articles/$articleId')({
  component: ArticleView,
});

function ArticleView() {
  const params = Route.useParams();
  const router = useRouter();
  const articleId = () => Number(params().articleId);

  const articleQuery = useArticle(articleId);
  const feedsQuery = useFeeds();
  const tagsQuery = useTags();
  const updateArticleMutation = useUpdateArticle();

  const feed = () => {
    const article = articleQuery.data;
    if (!article || !feedsQuery.data) return null;
    return feedsQuery.data.find((f) => f.id === article.feedId);
  };

  const isVideo = () => {
    const article = articleQuery.data;
    return article?.url && isYouTubeUrl(article.url);
  };

  const videoEmbedUrl = () => {
    const article = articleQuery.data;
    if (!article?.url) return null;
    const videoId = extractYouTubeVideoId(article.url);
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
      <Header title={articleQuery.data?.title}>
        <button onClick={handleBack} class="btn btn-ghost btn-sm">
          <ArrowLeftIcon size={20} />
          <span class="hidden sm:inline">Back</span>
        </button>
      </Header>

      <div class="container mx-auto min-h-screen p-3 sm:p-6">
        {/* Content */}
        <Suspense
          fallback={
            <div class="flex justify-center py-12">
              <Loader />
            </div>
          }
        >
          <Show
            when={!articleQuery.isPending && articleQuery.data}
            fallback={
              <Show when={articleQuery.isError}>
                <div class="py-8 text-center">
                  <p class="text-error">Failed to load article</p>
                </div>
              </Show>
            }
          >
            {(article) => (
              <Card class="shadow-xl">
                <article>
                  {/* Article Header */}
                  <header class="mb-8">
                    <div class="mb-4 flex gap-3">
                      <h1 class="text-base-content flex-1 text-3xl leading-tight font-bold md:text-4xl">
                        {article().title}
                      </h1>
                      <div class="flex shrink-0 gap-2">
                        <ArchiveIconButton
                          read={article().isRead || false}
                          archived={article().isArchived || false}
                          setArchived={(isArchived) => {
                            updateArticleMutation.mutate({
                              id: article().id,
                              isArchived,
                            });
                          }}
                        />
                        <ReadIconButton
                          read={article().isRead || false}
                          setRead={(isRead) => {
                            updateArticleMutation.mutate({
                              id: article().id,
                              isRead,
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div class="text-base-content/70 flex flex-wrap items-center gap-2 text-sm">
                      <div class="flex items-center gap-1">
                        <Show
                          when={article().isArchived}
                          fallback={<InboxIcon size={16} class="text-base-content/40" />}
                        >
                          <ArchiveIcon size={16} class="text-base-content/40" />
                        </Show>
                        <Show when={feed()}>
                          <Link
                            to="/feeds/$feedId"
                            params={{ feedId: article().feedId?.toString() }}
                            class="text-primary font-medium hover:underline"
                          >
                            {feed()!.title}
                          </Link>
                        </Show>
                      </div>

                      <Show when={article().author}>
                        <span>•</span>
                        <span>By {article().author}</span>
                      </Show>

                      <Show when={article().pubDate}>
                        <span>•</span>
                        <TimeAgo date={article().pubDate!} />
                      </Show>

                      <Show when={article().url}>
                        <span>•</span>
                        <a
                          href={article().url!}
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
                        <ArticleTagManager
                          tags={tagsQuery.data!}
                          selectedIds={article().tags}
                          onSelectionChange={(tagIds) => {
                            updateArticleMutation.mutate({
                              id: article().id,
                              tags: tagIds,
                            });
                          }}
                        />
                      </div>
                    </Show>
                  </header>

                  {/* Divider */}
                  <div class="mb-8 px-8">
                    <div class="border-base-300 border-t"></div>
                  </div>

                  {/* Video Content */}
                  <Show when={isVideo() && videoEmbedUrl()}>
                    <div class="mb-8">
                      <div class="aspect-video overflow-hidden rounded-lg shadow-lg">
                        <iframe
                          src={videoEmbedUrl()!}
                          title={article().title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowfullscreen
                          class="h-full w-full border-0"
                        ></iframe>
                      </div>
                    </div>

                    {/* Video Description */}
                    <Show
                      when={article().cleanContent || article().description || article().content}
                    >
                      <div class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none">
                        <Show
                          when={article().cleanContent}
                          fallback={
                            <div>
                              <h2 class="mb-3 text-xl font-semibold">Description</h2>
                              <p class="whitespace-pre-wrap">
                                {article().description || article().content}
                              </p>
                            </div>
                          }
                        >
                          <div innerHTML={article().cleanContent!} />
                        </Show>
                      </div>
                    </Show>
                  </Show>

                  {/* Article Content - for non-videos */}
                  <Show when={!isVideo() && article().cleanContent}>
                    <div
                      class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none"
                      innerHTML={article().cleanContent!}
                    />
                  </Show>

                  {/* No content fallback */}
                  <Show when={!isVideo() && !article().cleanContent}>
                    <div class="py-8 text-center">
                      <p class="text-warning">
                        This article doesn't have readable content available
                      </p>
                      <Show when={article().url}>
                        <a
                          href={article().url!}
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
              </Card>
            )}
          </Show>
        </Suspense>
      </div>
    </>
  );
}
