import type { DiscoveredFeed, FollowFeedsWithTags } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { createFileRoute } from '@tanstack/solid-router';
import {
  BookmarkPlus,
  CircleAlert,
  FileUp,
  Globe,
  Mail,
  Podcast,
  Rss,
  Search,
  X,
} from 'lucide-solid';
import { createEffect, createMemo, createResource, createSignal, For, on, Show } from 'solid-js';
import { Card } from '~/components/Card';
import {
  CuratedFeedsBrowser,
  type CuratedFeedWithCategory,
} from '~/components/CuratedFeedsBrowser';
import { Header } from '~/components/Header';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import type { ModalController } from '~/components/LazyModal';
import { MultiSelectTag } from '~/components/MultiSelectTag';
import { RedditIcon } from '~/components/RedditIcon';
import { YouTubeIcon } from '~/components/YouTubeIcon';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { $$discoverFeeds } from '~/entities/feeds.server';
import { buildFollowVars, followFeedsAction } from '~/entities/follow-feeds';
import { useTags } from '~/entities/tags';

export const Route = createFileRoute('/_frame/discover')({
  component: DiscoverPage,
  validateSearch: (search): { url?: string } => {
    return {
      url: (search?.url as string) || undefined,
    };
  },
});

const OPML_DISMISSED_KEY = 'discover:opml-dismissed';

function DiscoverPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  // Local input value (not yet submitted)
  const [inputUrl, setInputUrl] = createSignal(search()?.url ?? '');

  // Discovery results driven by URL search param
  const searchUrl = () => search()?.url;
  const [discoveryResult] = createResource(searchUrl, async (url) => {
    return $$discoverFeeds({ data: { url } });
  });

  // Ephemeral UI state — reset when the search URL changes
  const [addedFeeds, setAddedFeeds] = createSignal(new Set<string>());
  const [savedArticle, setSavedArticle] = createSignal(false);
  const [feedTagSelections, setFeedTagSelections] = createSignal<Record<string, string[]>>({});
  const [articleTags, setArticleTags] = createSignal<string[]>([]);

  createEffect(
    on(
      searchUrl,
      () => {
        setAddedFeeds(new Set<string>());
        setSavedArticle(false);
        setFeedTagSelections({});
        setArticleTags([]);
      },
      { defer: true },
    ),
  );

  let importOpmlModalController!: ModalController;

  const [opmlDismissed, setOpmlDismissed] = createSignal(
    typeof localStorage !== 'undefined' && localStorage.getItem(OPML_DISMISSED_KEY) === '1',
  );
  const dismissOpml = () => {
    localStorage.setItem(OPML_DISMISSED_KEY, '1');
    setOpmlDismissed(true);
  };

  const tagsQuery = useTags();
  const existingFeeds = useFeeds();
  const existingFeedUrls = createMemo(() => new Set(existingFeeds()?.map((f) => f.feedUrl)));

  // Derived state — no manual state machine needed
  const isIdle = () => !searchUrl();
  const isLoading = () => discoveryResult.loading;
  const discoveredFeeds = () => discoveryResult() ?? [];
  const error = () =>
    discoveryResult.error ? String(discoveryResult.error?.message ?? discoveryResult.error) : null;

  const handleDiscover = (e: Event) => {
    e.preventDefault();
    const trimmed = inputUrl().trim();
    if (!trimmed) return;
    navigate({ search: { url: trimmed } });
  };

  const handleExampleClick = (exampleUrl: string) => {
    setInputUrl(exampleUrl);
    navigate({ search: { url: exampleUrl } });
  };

  const handleFollowFeed = (feed: DiscoveredFeed) => {
    const selectedTagIds = feedTagSelections()[feed.url] || [];
    const feedId = createId();

    const vars: FollowFeedsWithTags = {
      feeds: [{ id: feedId, url: feed.url }],
      newTags: [],
      feedTags: selectedTagIds.map((tagId) => ({ id: createId(), feedId, tagId })),
    };

    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, feed.url]));
  };

  const handleAddManually = () => {
    const inputUrl = searchUrl()!;
    const feedId = createId();

    const vars: FollowFeedsWithTags = {
      feeds: [{ id: feedId, url: inputUrl }],
      newTags: [],
      feedTags: [],
    };

    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, inputUrl]));
  };

  const handleSaveArticle = () => {
    const inputUrl = searchUrl()!;
    const articleId = createId();

    articlesCollection.insert({
      id: articleId,
      userId: '',
      feedId: null,
      title: inputUrl,
      url: inputUrl,
      description: null,
      content: null,
      author: null,
      pubDate: new Date().toISOString(),
      isRead: false,
      isArchived: false,
      cleanContent: null,
      contentExtractedAt: null,
      createdAt: new Date().toISOString(),
    });

    const tags = articleTags();
    if (tags.length > 0) {
      for (const tagId of tags) {
        articleTagsCollection.insert({
          id: createId(),
          userId: '',
          articleId,
          tagId,
        });
      }
    }

    setSavedArticle(true);
  };

  const handleFollowCurated = (feed: CuratedFeedWithCategory) => {
    const vars = buildFollowVars(
      [{ feedUrl: feed.feedUrl, categoryName: feed.categoryName }],
      tagsQuery() ?? [],
    );
    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, feed.feedUrl]));
  };

  const handleFollowAllCurated = (feeds: CuratedFeedWithCategory[]) => {
    const toFollow = feeds.filter(
      (f) => !existingFeedUrls().has(f.feedUrl) && !addedFeeds().has(f.feedUrl),
    );
    if (toFollow.length === 0) return;

    const vars = buildFollowVars(
      toFollow.map((f) => ({ feedUrl: f.feedUrl, categoryName: f.categoryName })),
      tagsQuery() ?? [],
    );
    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, ...toFollow.map((f) => f.feedUrl)]));
  };

  const hasFeeds = () => discoveredFeeds().length > 0;

  return (
    <>
      <Header title="Discover content" mobileOnlyTitle />

      <div class="mx-auto w-full max-w-2xl px-4 py-3 sm:p-6 xl:max-w-3xl">
        {/* Hero URL Input */}
        <div class="sm:py-4">
          <h2 class="mb-2 hidden text-2xl font-bold sm:block sm:text-3xl">Discover content</h2>
          <p class="text-base-content/60 mb-4 sm:mb-6">
            Paste any link to find feeds to follow or save an article for later.
          </p>

          <form onSubmit={handleDiscover} class="flex gap-2">
            <label class="input input-bordered flex flex-1 items-center gap-2">
              <Search size={20} class="opacity-50" />
              <input
                type="text"
                placeholder="Try youtube.com/mkbhd"
                class="grow"
                value={inputUrl()}
                onInput={(e) => setInputUrl(e.currentTarget.value)}
                required
              />
              <Show when={inputUrl()}>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle"
                  onClick={() => {
                    setInputUrl('');
                    navigate({ search: {} });
                  }}
                >
                  <X size={14} />
                </button>
              </Show>
            </label>
            <button type="submit" class="btn btn-primary" disabled={isLoading()}>
              <Show when={isLoading()}>
                <span class="loading loading-spinner loading-sm" />
              </Show>
              <Show when={!isLoading()}>Discover</Show>
            </button>
          </form>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="alert alert-error mb-6">
            <CircleAlert size={20} />
            <span>{error()}</span>
          </div>
        </Show>

        {/* Results */}
        <Show when={searchUrl() && !isLoading()}>
          <div class="space-y-6">
            {/* Feeds Found */}
            <Show when={hasFeeds()}>
              <div>
                <h3 class="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                  {discoveredFeeds().length === 1
                    ? 'Found 1 feed'
                    : `Found ${discoveredFeeds().length} feeds`}
                </h3>

                <div class="grid gap-3">
                  <For each={discoveredFeeds()}>
                    {(feed) => {
                      const isAdded = () =>
                        addedFeeds().has(feed.url) || existingFeedUrls().has(feed.url);

                      return (
                        <Card>
                          <div class="flex items-center gap-3">
                            <div class="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                              <Rss size={20} class="text-base-content/50" />
                            </div>

                            <div class="min-w-0 flex-1">
                              <div class="font-medium">{feed.title || feed.url}</div>
                              <div class="text-base-content/50 truncate text-sm">{feed.url}</div>
                            </div>

                            <Show
                              when={!isAdded()}
                              fallback={<span class="badge badge-success gap-1">Following</span>}
                            >
                              <button
                                type="button"
                                class="btn btn-primary btn-sm"
                                onClick={() => handleFollowFeed(feed)}
                              >
                                Follow
                              </button>
                            </Show>
                          </div>

                          {/* Per-feed tag selector */}
                          <Show when={tagsQuery()?.length && !isAdded()}>
                            <div class="mt-3">
                              <MultiSelectTag
                                tags={tagsQuery() || []}
                                selectedIds={feedTagSelections()[feed.url] || []}
                                onSelectionChange={(ids) =>
                                  setFeedTagSelections((prev) => ({
                                    ...prev,
                                    [feed.url]: ids,
                                  }))
                                }
                              />
                            </div>
                          </Show>
                        </Card>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>

            {/* No Feeds Found */}
            <Show when={!hasFeeds() && !error()}>
              <div class="alert alert-warning mb-4">
                <span>No feeds found for this site.</span>
              </div>
            </Show>

            {/* Save as Article Option */}
            <Show when={!savedArticle()}>
              <div>
                <h3 class="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                  {hasFeeds() ? 'Or save this page' : 'Save as article'}
                </h3>

                <Card>
                  <div class="flex items-center gap-3">
                    <div class="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <Globe size={20} class="text-base-content/50" />
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-medium">{searchUrl()}</div>
                      <div class="text-base-content/50 text-xs">Save this page as an article</div>
                    </div>

                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      onClick={handleSaveArticle}
                    >
                      <BookmarkPlus size={16} />
                      Save
                    </button>
                  </div>

                  <Show when={tagsQuery()?.length}>
                    <div class="mt-3">
                      <MultiSelectTag
                        tags={tagsQuery() || []}
                        selectedIds={articleTags()}
                        onSelectionChange={setArticleTags}
                      />
                    </div>
                  </Show>
                </Card>
              </div>
            </Show>

            <Show when={savedArticle()}>
              <div class="alert alert-success">
                <span>Article saved!</span>
              </div>
            </Show>

            {/* Add URL Directly (when no feeds found) */}
            <Show
              when={
                !hasFeeds() &&
                !addedFeeds().has(searchUrl()!) &&
                !existingFeedUrls().has(searchUrl()!)
              }
            >
              <div>
                <h3 class="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                  Advanced
                </h3>
                <button type="button" class="btn btn-outline btn-sm" onClick={handleAddManually}>
                  Add URL directly as a feed
                </button>
              </div>
            </Show>

            <Show
              when={
                !hasFeeds() &&
                (addedFeeds().has(searchUrl()!) || existingFeedUrls().has(searchUrl()!))
              }
            >
              <div class="alert alert-success">
                <span>Feed added! We'll try to sync it.</span>
              </div>
            </Show>
          </div>
        </Show>

        {/* Curated Feeds Browser (idle state) */}
        <Show when={isIdle()}>
          {/* Import OPML - dismissible */}
          <Show when={!opmlDismissed()}>
            <div class="bg-base-200 mt-2 flex items-center gap-3 rounded-xl px-4 py-2.5">
              <FileUp size={16} class="text-base-content/50 flex-shrink-0" />
              <p class="text-base-content/70 flex-1 text-sm">
                Switching from another reader?{' '}
                <button
                  type="button"
                  class="link link-primary"
                  onClick={() => importOpmlModalController.open()}
                >
                  Import your OPML file
                </button>
              </p>
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle flex-shrink-0"
                onClick={dismissOpml}
              >
                <X size={14} />
              </button>
            </div>
          </Show>

          {/* Example hints - cards */}
          <div class="mt-6 sm:mt-8">
            <p class="text-base-content/60 mb-3 text-sm">
              It works with any site that publishes content,{' '}
              <span class="text-base-content font-medium">not just blogs</span>.
            </p>
            <div class="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                class="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://youtube.com/@mkbhd')}
              >
                <div class="flex items-center gap-2">
                  <YouTubeIcon class="h-4 w-4 flex-shrink-0" />
                  <p class="text-sm font-medium">YouTube</p>
                </div>
                <p class="text-base-content/60 mt-1 text-xs leading-snug">
                  Follow any channel to get new videos.
                </p>
                <p class="text-base-content/40 mt-1 truncate text-xs">youtube.com/@mkbhd</p>
              </button>
              <button
                type="button"
                class="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://www.reddit.com/r/movies.rss')}
              >
                <div class="flex items-center gap-2">
                  <RedditIcon class="h-4 w-4 flex-shrink-0" />
                  <p class="text-sm font-medium">Reddit</p>
                </div>
                <p class="text-base-content/60 mt-1 text-xs leading-snug">
                  Follow subreddits without an account.
                </p>
                <p class="text-base-content/40 mt-1 truncate text-xs">reddit.com/r/movies</p>
              </button>
              <button
                type="button"
                class="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://feeds.npr.org/510289/podcast.xml')}
              >
                <div class="flex items-center gap-2">
                  <Podcast size={16} class="flex-shrink-0" />
                  <p class="text-sm font-medium">Podcasts</p>
                </div>
                <p class="text-base-content/60 mt-1 text-xs leading-snug">
                  Get notified when new episodes drop.
                </p>
                <p class="text-base-content/40 mt-1 truncate text-xs">feeds.npr.org/510289/...</p>
              </button>
              <button
                type="button"
                class="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://seths.blog')}
              >
                <div class="flex items-center gap-2">
                  <Mail size={16} class="flex-shrink-0" />
                  <p class="text-sm font-medium">Newsletters</p>
                </div>
                <p class="text-base-content/60 mt-1 text-xs leading-snug">
                  Read without giving out your email.
                </p>
                <p class="text-base-content/40 mt-1 truncate text-xs">seths.blog</p>
              </button>
            </div>
          </div>

          <CuratedFeedsBrowser
            existingFeedUrls={existingFeedUrls()}
            addedFeeds={addedFeeds()}
            onFollow={handleFollowCurated}
            onFollowAll={handleFollowAllCurated}
          />
        </Show>
      </div>

      <ImportOpmlModal controller={(c) => (importOpmlModalController = c)} />
    </>
  );
}
