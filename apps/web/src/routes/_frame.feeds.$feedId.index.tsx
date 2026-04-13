// oxlint-disable import/max-dependencies
import type { Feed, TagColor } from '@repo/domain/client';
import { and, eq, toArray, useLiveQuery } from '@tanstack/solid-db';
import { createFileRoute, Link } from '@tanstack/solid-router';
import { MoreVertical, TriangleAlert } from 'lucide-solid';
import { createSignal, For, Show, Suspense } from 'solid-js';
import {
  ArticleList,
  ArticleListToolbar,
  createArticleListState,
  MarkAllArchivedButton,
  ReadStatusToggle,
  ShortsButton,
} from '~/components/articles';
import type { ArticleQueryFilter, ReadStatus } from '~/components/articles';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteFeedModal } from '~/components/DeleteFeedModal';
import { Dropdown } from '~/components/Dropdown';
import { EditFeedModal } from '~/components/EditFeedModal';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { SyncLogsModal } from '~/components/SyncLogsModal';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { $$retryFeed } from '~/entities/feeds.functions';
import { tagsCollection } from '~/entities/tags';
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

  const filter: ArticleQueryFilter = {
    buildQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => {
          const base = and(eq(article.feedId, feedId()), eq(article.isArchived, false));
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ ...article })),
    buildCountQuery: (q, { readStatusWhere }) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => {
          const base = and(eq(article.feedId, feedId()), eq(article.isArchived, false));
          return readStatusWhere ? and(base, readStatusWhere(article)) : base;
        })
        .select(({ article }: any) => ({ id: article.id })),
    buildUnreadQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) =>
          and(eq(article.feedId, feedId()), eq(article.isArchived, false), eq(article.isRead, false)),
        )
        .select(({ article }: any) => ({ id: article.id })),
    buildArchivableQuery: (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: any) => and(eq(article.feedId, feedId()), eq(article.isArchived, false)))
        .select(({ article }: any) => ({ id: article.id })),
  };

  const state = createArticleListState({
    filter,
    readStatus: () => readStatus(),
    viewKey: `feed:${feedId()}`,
  });

  // Feed-specific queries (not shared with other pages)
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

  let editFeedModalController!: ModalController;
  let deleteFeedModalController!: ModalController;
  let syncLogsModalController!: ModalController;

  const [feedToDelete, setFeedToDelete] = createSignal<FeedWithTags | null>(null);

  const currentFeed = () => (feedWithTagsQuery() ?? [])[0] ?? null;

  return (
    <PageLayout
      title="Feed Articles"
      headerActions={
        <div class="flex flex-wrap gap-2">
          <ShortsButton
            shortsExist={state.shortsExist()}
            linkProps={{
              to: '/feeds/$feedId/shorts',
              params: { feedId: feedId() },
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
        menuContent={
          <Show when={state.archivableCount() > 0}>
            <li>
              <MarkAllArchivedButton
                totalCount={state.archivableCount()}
                contextLabel="in this feed"
                onConfirm={state.markAllArchived}
              />
            </li>
          </Show>
        }
        unreadCount={state.unreadCount()}
        totalCount={state.totalCount()}
        readStatus={readStatus()}
      />

      <Suspense fallback={<CenterLoader />}>
        <Show when={state.feeds().length > 0 || state.tags().length > 0 || state.articles().length > 0}>
          <ArticleList
            articles={state.articles()}
            feeds={state.feeds()}
            tags={state.tags()}
            articleTags={state.articleTags()}
            totalCount={state.totalCount()}
            onLoadMore={state.loadMore}
            onUpdateArticle={state.updateArticle}
            onAddTag={state.addTag}
            onRemoveTag={state.removeTag}
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
        <Show when={props.feed.tags && props.feed.tags.length > 0}>
          <div class="mb-3 flex flex-wrap gap-1.5">
            <For each={props.feed.tags}>
              {(tag) => (
                <Link to="/tags/$tagId" params={{ tagId: tag.id!.toString() }}>
                  <div class="badge badge-sm gap-1.5 transition-all hover:brightness-90">
                    <ColorIndicator class={getTagDotColor(tag.color ?? null)} />
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
