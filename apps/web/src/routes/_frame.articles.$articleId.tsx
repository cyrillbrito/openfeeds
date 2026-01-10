import { createFileRoute, Link, useRouter } from '@tanstack/solid-router';
import { useArticleDetails } from '~/entities/article-details';
import { articlesCollection } from '~/entities/articles';
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
import { extractYouTubeVideoId, isYouTubeUrl } from '../utils/youtube';

export const Route = createFileRoute('/_frame/articles/$articleId')({
  component: ArticleView,
});

function ArticleView() {
  const params = Route.useParams();
  const router = useRouter();
  const articleId = () => params().articleId;

  // Use article details collection for detailed view with cleanContent
  const articleQuery = useArticleDetails(articleId);

  const article = () => articleQuery.data?.[0];

  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  const feed = () => {
    const art = article();
    if (!art || !feedsQuery.data) return null;
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
            when={!articleQuery.isLoading() && article()}
            fallback={
              <Show when={articleQuery.isError()}>
                <div class="py-8 text-center">
                  <p class="text-error">Failed to load article</p>
                </div>
              </Show>
            }
          >
            {(art) => (
              <Card class="shadow-xl">
                <article>
                  {/* Article Header */}
                  <header class="mb-8">
                    <div class="mb-4 flex gap-3">
                      <h1 class="text-base-content flex-1 text-3xl leading-tight font-bold md:text-4xl">
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
                          fallback={<InboxIcon size={16} class="text-base-content/40" />}
                        >
                          <ArchiveIcon size={16} class="text-base-content/40" />
                        </Show>
                        <Show when={feed()}>
                          <Link
                            to="/feeds/$feedId"
                            params={{ feedId: art().feedId?.toString() }}
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
                        <ArticleTagManager
                          tags={tagsQuery.data!}
                          selectedIds={art().tags}
                          onSelectionChange={(tagIds) => {
                            articlesCollection.update(art().id, (draft) => {
                              draft.tags = tagIds;
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
                          title={art().title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowfullscreen
                          class="h-full w-full border-0"
                        ></iframe>
                      </div>
                    </div>

                    {/* Video Description */}
                    <Show when={art().cleanContent || art().description || art().content}>
                      <div class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none">
                        <Show
                          when={art().cleanContent}
                          fallback={
                            <div>
                              <h2 class="mb-3 text-xl font-semibold">Description</h2>
                              <p class="whitespace-pre-wrap">
                                {art().description || art().content}
                              </p>
                            </div>
                          }
                        >
                          <div innerHTML={art().cleanContent!} />
                        </Show>
                      </div>
                    </Show>
                  </Show>

                  {/* Article Content - for non-videos */}
                  <Show when={!isVideo() && art().cleanContent}>
                    <div
                      class="prose prose-lg text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-blockquote:text-base-content/80 max-w-none"
                      innerHTML={art().cleanContent!}
                    />
                  </Show>

                  {/* No content fallback */}
                  <Show when={!isVideo() && !art().cleanContent}>
                    <div class="py-8 text-center">
                      <p class="text-warning">
                        This article doesn't have readable content available
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
              </Card>
            )}
          </Show>
        </Suspense>
      </div>
    </>
  );
}
