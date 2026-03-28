import type { Feed, TagColor } from '@repo/domain/client';
import { eq, toArray, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { MoreVertical, TriangleAlert } from 'lucide-solid';
import { createSignal, For, onMount, Show, Suspense } from 'solid-js';
import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
import { ArticleListToolbar } from '~/components/ArticleListToolbar';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { MarkAllArchivedButton } from '~/components/MarkAllArchivedButton';
import { PageLayout } from '~/components/PageLayout';
import { ReadStatusToggle, type ReadStatus } from '~/components/ReadStatusToggle';
import { ShortsButton } from '~/components/ShortsButton';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection, useFeeds } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.functions';
import { tagsCollection, useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { validateReadStatusSearch } from '~/utils/routing';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/feeds/$feedId/')({
  validateSearch: validateReadStatusSearch,
  component: FeedArticles,
});

function FeedArticles() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const feedId = () => params()?.feedId;
  const readStatus = (): ReadStatus => search()?.readStatus || 'unread';
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();

  onMount(() => setViewKey(`feed:${feedId()}`));

  // Pagination state - lifted from ArticleList
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Query articles with orderBy and limit for pagination
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.orderBy(({ article }) => article.pubDate, 'desc').limit(visibleCount());
  });

  // Lightweight count query for current read status filter (no limit)
  const totalCountQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    return query.select(({ article }) => ({ id: article.id }));
  });

  // Count of unread articles (independent of current read status filter)
  const unreadCountQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()))
      .where(({ article }) => eq(article.isArchived, false))
      .where(({ article }) => eq(article.isRead, false))
      .select(({ article }) => ({ id: article.id })),
  );

  // Non-archived articles for this feed (for archive button count + action)
  const archivableQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.feedId, feedId()))
      .where(({ article }) => eq(article.isArchived, false))
      .select(({ article }) => ({ id: article.id })),
  );

  const feedWithTagsQuery = useLiveQuery((q) =>
    q
      .from({ feed: feedsCollection })
      .where(({ feed }) => eq(feed.id, feedId()))
      .select(({ feed }) => ({
        ...feed,
        tags: toArray(
          q
            .from({ ft: feedTagsCollection })
            .where(({ ft }) => eq(ft.feedId, feed.id))
            .join({ tag: tagsCollection }, ({ ft, tag }) => eq(ft.tagId, tag.id))
            .select(({ ft, tag }) => ({
              feedTagId: ft.id,
              id: tag.id,
              name: tag.name,
              color: tag.color,
            })),
        ),
      })),
  );
  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  let editFeedModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let syncLogsModalController!: ModalController;

  const [feedToDelete, setFeedToDelete] = createSignal<FeedWithTags | null>(null);

  const handleMarkAllArchived = async () => {
    const articleIds = (archivableQuery() || []).map((a) => a.id);
    if (articleIds.length > 0) {
      articlesCollection.update(articleIds, (drafts) => {
        drafts.forEach((d) => (d.isArchived = true));
      });
    }
  };

  const handleUpdateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean },
  ) => {
    // Track session-read articles
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }

    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
    });
  };

  // Articles are already filtered by the live query (including session-read handling)
  const filteredArticles = () => articlesQuery() || [];
  const totalCount = () => (totalCountQuery() || []).length;
  const unreadCount = () => (unreadCountQuery() || []).length;
  const archivableCount = () => (archivableQuery() || []).length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  const currentFeed = () => (feedWithTagsQuery() ?? [])[0] ?? null;

  return (
    <PageLayout
      title="Feed Articles"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <ShortsButton
            where={(article) => eq(article.feedId, feedId())}
            linkProps={{
              to: '/feeds/$feedId/shorts',
              params: { feedId: feedId()! },
              search: { readStatus: readStatus() },
            }}
          />
          <Show when={currentFeed()}>
            <Dropdown end btnClasses="btn-sm" btnContent={<MoreVertical size={20} />}>
              <li>
                <button onClick={() => editFeedModalController.open()}>Edit</button>
              </li>
              <li>
                <button onClick={() => syncLogsModalController.open()}>Sync Logs</button>
              </li>
              <div class="divider my-0"></div>
              <li>
                <button
                  class="text-error w-full text-left"
                  onClick={() => {
                    setFeedToDelete(currentFeed());
                    deleteFeedModalController.open();
                  }}
                >
                  Unfollow
                </button>
              </li>
            </Dropdown>
          </Show>
        </div>
      }
    >
      {/* Sync error notice */}
      <Show
        when={
          (currentFeed()?.syncStatus === 'failing' || currentFeed()?.syncStatus === 'broken') &&
          currentFeed()
        }
        keyed
      >
        {(feed) => (
          <div class="border-base-300 bg-base-200 mb-4 rounded-lg border p-4">
            <div class="flex items-start gap-3">
              <TriangleAlert
                size={18}
                class={`mt-0.5 shrink-0 ${feed.syncStatus === 'broken' ? 'text-error' : 'text-warning'}`}
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">
                  {feed.syncStatus === 'broken'
                    ? 'Feed sync is broken'
                    : 'Feed is experiencing sync issues'}
                </p>
                <Show when={feed.syncError}>
                  <p class="text-base-content/60 mt-1 text-xs">{feed.syncError}</p>
                </Show>
                <div class="mt-3 flex gap-2">
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={async () => {
                      feedsCollection.update(feed.id, (draft) => {
                        draft.syncStatus = 'ok';
                        draft.syncError = null;
                      });
                      await $$retryFeed({ data: { id: feed.id } });
                    }}
                  >
                    Retry sync
                  </button>
                  <button
                    class="btn btn-ghost btn-sm text-error"
                    onClick={() => {
                      setFeedToDelete(feed);
                      deleteFeedModalController.open();
                    }}
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      <Show when={currentFeed()} keyed>
        {(feed) => <FeedHeader feed={feed} />}
      </Show>

      <ArticleListToolbar
        leftContent={<ReadStatusToggle currentStatus={readStatus()} />}
        rightContent={
          <Show when={archivableCount() > 0}>
            <MarkAllArchivedButton
              totalCount={archivableCount()}
              contextLabel="in this feed"
              onConfirm={handleMarkAllArchived}
            />
          </Show>
        }
        mobileMenuContent={
          <Show when={archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={archivableCount()}
                contextLabel="in this feed"
                onConfirm={handleMarkAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={unreadCount()}
        totalCount={totalCount()}
        readStatus={readStatus()}
      />

      <Suspense fallback={<CenterLoader />}>
        <Show when={feedsQuery() && tagsQuery()}>
          <ArticleList
            articles={filteredArticles()}
            feeds={feedsQuery()!}
            tags={tagsQuery()!}
            totalCount={totalCount()}
            onLoadMore={handleLoadMore}
            onUpdateArticle={handleUpdateArticle}
            readStatus={readStatus()}
            context="feed"
          />
        </Show>
      </Suspense>

      <EditFeedModal
        controller={(controller) => (editFeedModalController = controller)}
        feed={currentFeed()}
      />

      <DeleteFeedModal
        controller={(controller) => (deleteFeedModalController = controller)}
        feeds={feedToDelete() ? [feedToDelete()!] : []}
        onDeleteComplete={() => setFeedToDelete(null)}
      />

      <SyncLogsModal
        controller={(controller) => (syncLogsModalController = controller)}
        feed={currentFeed()}
      />
    </PageLayout>
  );
}

type FeedWithTags = Feed & {
  tags: {
    feedTagId: string;
    id: string | undefined;
    name: string | undefined;
    color: TagColor | null | undefined;
  }[];
};

function FeedHeader(props: { feed: FeedWithTags }) {
  return (
    <div class="mb-4 flex items-start gap-4 sm:gap-5">
      <Show when={props.feed.icon}>
        <div class="bg-base-300 flex h-20 w-20 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28">
          <img
            src={props.feed.icon!}
            alt={`${props.feed.title} icon`}
            class="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24 sm:rounded-2xl md:h-28 md:w-28"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </Show>
      <div class="min-w-0 flex-1">
        <h2 class="mb-1.5 text-lg font-semibold sm:text-2xl">{props.feed.title}</h2>
        <p class="text-base-content/70 mb-3 line-clamp-3 text-sm leading-relaxed">
          {props.feed.description || 'No description found'}
        </p>

        {/* Tags */}
        <Show when={props.feed.tags.length > 0}>
          <div class="mb-3 flex flex-wrap gap-1.5">
            <For each={props.feed.tags}>
              {(tag) => (
                <Link to="/tags/$tagId" params={{ tagId: tag.id!.toString() }}>
                  <div class="badge badge-sm gap-1.5 transition-all hover:brightness-90">
                    <ColorIndicator class={getTagDotColor(tag.color as TagColor | null)} />
                    <span>{tag.name}</span>
                  </div>
                </Link>
              )}
            </For>
          </div>
        </Show>

        <div class="flex flex-wrap gap-3 text-xs">
          <a
            href={props.feed.url}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-primary font-medium"
          >
            Website
          </a>
          <a
            href={props.feed.feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-primary font-medium"
          >
            Feed URL
          </a>
        </div>
      </div>
    </div>
  );
}
