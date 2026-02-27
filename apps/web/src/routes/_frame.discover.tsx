import type { DiscoveredFeed, FollowFeedsWithTags } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { createOptimisticAction } from '@tanstack/solid-db';
import { createFileRoute } from '@tanstack/solid-router';
import {
  Apple,
  BookmarkPlus,
  Briefcase,
  Camera,
  Car,
  CircleAlert,
  Clapperboard,
  Code,
  Dumbbell,
  FileUp,
  FlaskConical,
  Gamepad2,
  Globe,
  Hammer,
  Laugh,
  Mail,
  MonitorSmartphone,
  Music,
  Newspaper,
  Paintbrush,
  Palette,
  Plane,
  Podcast,
  Rocket,
  Rss,
  Scroll,
  Search,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Trophy,
  Tv,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideProps,
} from 'lucide-solid';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  Show,
  type Component,
  type JSX,
} from 'solid-js';
import { Card } from '~/components/Card';
import { Header } from '~/components/Header';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import type { ModalController } from '~/components/LazyModal';
import { MultiSelectTag } from '~/components/MultiSelectTag';
import { RedditIcon } from '~/components/RedditIcon';
import { YouTubeIcon } from '~/components/YouTubeIcon';
import curatedCategories from '~/data/curated-feeds.json';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection, useFeeds } from '~/entities/feeds';
import { $$discoverFeeds, $$followFeedsWithTags } from '~/entities/feeds.server';
import { tagsCollection, useTags } from '~/entities/tags';

type CuratedFeed = {
  title: string;
  description: string | null;
  feedUrl: string;
  siteUrl: string;
  imageUrl: string | null;
};

type CuratedFeedWithCategory = CuratedFeed & {
  categoryName: string;
  categoryIcon: string;
};

type CuratedCategory = {
  name: string;
  slug: string;
  icon: string;
  feedCount: number;
  feeds: CuratedFeed[];
};

export const Route = createFileRoute('/_frame/discover')({
  component: DiscoverPage,
  validateSearch: (search): { url?: string } => {
    return {
      url: (search?.url as string) || undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Optimistic action: follow feeds + tags in one transaction
// ---------------------------------------------------------------------------

const followFeedsAction = createOptimisticAction<FollowFeedsWithTags>({
  onMutate: (vars) => {
    const now = new Date().toISOString();

    for (const feed of vars.feeds) {
      feedsCollection.insert({
        id: feed.id,
        userId: '',
        url: feed.url,
        feedUrl: feed.url,
        title: feed.url,
        description: null,
        icon: null,
        createdAt: now,
        updatedAt: now,
        lastSyncAt: null,
        syncStatus: 'ok',
        syncError: null,
      });
    }

    for (const tag of vars.newTags) {
      tagsCollection.insert({
        id: tag.id,
        userId: '',
        name: tag.name,
        color: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const ft of vars.feedTags) {
      feedTagsCollection.insert({
        id: ft.id,
        userId: '',
        feedId: ft.feedId,
        tagId: ft.tagId,
      });
    }
  },
  mutationFn: async (vars) => {
    await $$followFeedsWithTags({ data: vars });
  },
});

/**
 * Build FollowFeedsWithTags vars for feeds that should be auto-tagged by category.
 * Resolves existing tags (case-insensitive) or creates new ones.
 */
function buildFollowVars(
  feeds: Array<{ feedUrl: string; categoryName: string }>,
  existingTags: Array<{ id: string; name: string }>,
): FollowFeedsWithTags {
  const feedEntries: FollowFeedsWithTags['feeds'] = [];
  const newTagsMap = new Map<string, { id: string; name: string }>();
  const feedTagEntries: FollowFeedsWithTags['feedTags'] = [];

  const tagByName = new Map<string, string>();
  for (const t of existingTags) {
    tagByName.set(t.name.toLowerCase(), t.id);
  }

  for (const feed of feeds) {
    const feedId = createId();
    feedEntries.push({ id: feedId, url: feed.feedUrl });

    const catLower = feed.categoryName.toLowerCase();
    let tagId = tagByName.get(catLower);

    if (!tagId) {
      const pending = newTagsMap.get(catLower);
      if (pending) {
        tagId = pending.id;
      } else {
        tagId = createId();
        newTagsMap.set(catLower, { id: tagId, name: feed.categoryName });
        tagByName.set(catLower, tagId);
      }
    }

    feedTagEntries.push({ id: createId(), feedId, tagId });
  }

  return {
    feeds: feedEntries,
    newTags: Array.from(newTagsMap.values()),
    feedTags: feedTagEntries,
  };
}

const EXAMPLE_HINTS: {
  label: string;
  description: string;
  example: string;
  url: string;
  icon: () => JSX.Element;
}[] = [
  {
    label: 'YouTube',
    description: 'Follow any channel to get new videos.',
    example: 'youtube.com/@mkbhd',
    url: 'https://youtube.com/@mkbhd',
    icon: () => <YouTubeIcon class="h-4 w-4" />,
  },
  {
    label: 'Reddit',
    description: 'Follow subreddits without an account.',
    example: 'reddit.com/r/movies',
    url: 'https://www.reddit.com/r/movies.rss',
    icon: () => <RedditIcon class="h-4 w-4" />,
  },
  {
    label: 'Podcasts',
    description: 'Get notified when new episodes drop.',
    example: 'feeds.npr.org/510289/...',
    url: 'https://feeds.npr.org/510289/podcast.xml',
    icon: () => <Podcast size={16} />,
  },
  {
    label: 'Newsletters',
    description: 'Read without giving out your email.',
    example: 'seths.blog',
    url: 'https://seths.blog',
    icon: () => <Mail size={16} />,
  },
];

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
              <For each={EXAMPLE_HINTS}>
                {(hint) => (
                  <button
                    type="button"
                    class="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                    onClick={() => handleExampleClick(hint.url)}
                  >
                    <div class="flex items-center gap-2">
                      <div class="flex-shrink-0">{hint.icon()}</div>
                      <p class="text-sm font-medium">{hint.label}</p>
                    </div>
                    <p class="text-base-content/60 mt-1 text-xs leading-snug">{hint.description}</p>
                    <p class="text-base-content/40 mt-1 truncate text-xs">{hint.example}</p>
                  </button>
                )}
              </For>
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

// ---------------------------------------------------------------------------
// Lucide icon overrides for curated categories (test a few, rest keep emoji)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, Component<LucideProps>> = {
  news: Newspaper,
  tech: MonitorSmartphone,
  gaming: Gamepad2,
  science: FlaskConical,
  programming: Code,
  music: Music,
  movies: Clapperboard,
  food: UtensilsCrossed,
  sports: Dumbbell,
  travel: Plane,
  photography: Camera,
  'business-economy': Briefcase,
  'personal-finance': Wallet,
  startups: Rocket,
  apple: Apple,
  funny: Laugh,
  space: Sparkles,
  books: Scroll,
  diy: Hammer,
  fashion: Shirt,
  beauty: Paintbrush,
  android: Smartphone,
  'android-development': Smartphone,
  'ios-development': Smartphone,
  television: Tv,
  history: Scroll,
  'web-development': Globe,
  'ui-ux': Palette,
  cars: Car,
  cricket: Trophy,
  football: Trophy,
  tennis: Trophy,
  'interior-design': Sofa,
  architecture: Sofa,
};

const FEEDS_PER_PAGE = 20;

function CuratedFeedsBrowser(props: {
  existingFeedUrls: Set<string>;
  addedFeeds: Set<string>;
  onFollow: (feed: CuratedFeedWithCategory) => void;
  onFollowAll: (feeds: CuratedFeedWithCategory[]) => void;
}) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);
  const [visibleCount, setVisibleCount] = createSignal(FEEDS_PER_PAGE);

  const categories = curatedCategories as CuratedCategory[];

  // Count matching feeds per category for the current search query (ignoring selected category)
  const categoryMatchCounts = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return null; // no search — all categories are "active"

    const counts = new Map<string, number>();
    for (const cat of categories) {
      let count = 0;
      for (const feed of cat.feeds) {
        const titleMatch = feed.title.toLowerCase().includes(query);
        const descMatch = feed.description?.toLowerCase().includes(query) ?? false;
        if (titleMatch || descMatch) count++;
      }
      counts.set(cat.slug, count);
    }
    return counts;
  });

  const filteredFeeds = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    const catSlug = selectedCategory();

    let sourceCats = categories;
    if (catSlug) {
      sourceCats = categories.filter((c) => c.slug === catSlug);
    }

    const results: CuratedFeedWithCategory[] = [];
    for (const cat of sourceCats) {
      for (const feed of cat.feeds) {
        if (query) {
          const titleMatch = feed.title.toLowerCase().includes(query);
          const descMatch = feed.description?.toLowerCase().includes(query) ?? false;
          if (!titleMatch && !descMatch) continue;
        }
        results.push({ ...feed, categoryName: cat.name, categoryIcon: cat.icon });
      }
    }
    return results;
  });

  const visibleFeeds = createMemo(() => filteredFeeds().slice(0, visibleCount()));
  const hasMore = createMemo(() => visibleCount() < filteredFeeds().length);

  // Reset visible count when filters change
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(FEEDS_PER_PAGE);
  };

  const handleCategorySelect = (slug: string | null) => {
    setSelectedCategory(slug);
    setVisibleCount(FEEDS_PER_PAGE);
  };

  return (
    <>
      <div class="divider sm:my-8">or</div>

      <div>
        <h3 class="mb-4 text-lg font-semibold sm:mb-5">Popular Feeds</h3>

        <label class="input input-bordered input-sm mb-4 flex items-center gap-2 sm:mb-5">
          <Search size={14} class="opacity-50" />
          <input
            type="text"
            placeholder="Filter feeds..."
            class="grow"
            value={searchQuery()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              onClick={() => handleSearch('')}
            >
              <X size={14} />
            </button>
          </Show>
        </label>

        {/* Category pills — horizontal scroll */}
        <div class="scrollbar-none sm:scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:mb-5 sm:px-6">
          <button
            type="button"
            class="btn btn-sm shrink-0 rounded-full"
            classList={{
              'btn-primary': selectedCategory() === null,
              'btn-outline': selectedCategory() !== null,
            }}
            onClick={() => handleCategorySelect(null)}
          >
            All
          </button>
          <For each={categories}>
            {(cat) => {
              const LucideIcon = CATEGORY_ICONS[cat.slug];
              const isEmpty = () => categoryMatchCounts()?.get(cat.slug) === 0;
              const isSelected = () => selectedCategory() === cat.slug;
              return (
                <button
                  type="button"
                  class="btn btn-sm shrink-0 gap-1.5 rounded-full"
                  classList={{
                    'btn-primary': isSelected(),
                    'btn-outline': !isSelected(),
                    'btn-disabled opacity-40': isEmpty() && !isSelected(),
                  }}
                  onClick={() => handleCategorySelect(isSelected() ? null : cat.slug)}
                >
                  <Show when={LucideIcon} keyed fallback={<span class="text-sm">{cat.icon}</span>}>
                    {(Icon) => <Icon size={14} strokeWidth={2.5} />}
                  </Show>
                  {cat.name}
                </button>
              );
            }}
          </For>
        </div>

        {/* Results count + Follow all */}
        <div class="mb-3 flex items-center justify-between sm:mb-4">
          <p class="text-base-content/50 text-sm">
            {filteredFeeds().length} {filteredFeeds().length === 1 ? 'feed' : 'feeds'}
            <Show when={selectedCategory()}>
              {' '}
              in {categories.find((c) => c.slug === selectedCategory())?.name}
            </Show>
            <Show when={searchQuery()}> matching "{searchQuery()}"</Show>
          </p>
          <Show when={selectedCategory() && filteredFeeds().length > 0}>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => props.onFollowAll(filteredFeeds())}
            >
              Follow all
            </button>
          </Show>
        </div>

        {/* Feed cards */}
        <div class="grid gap-3 sm:gap-4">
          <For each={visibleFeeds()}>
            {(feed) => {
              const isAdded = () =>
                props.addedFeeds.has(feed.feedUrl) || props.existingFeedUrls.has(feed.feedUrl);

              return (
                <Card>
                  <div class="flex items-start gap-3">
                    {/* Image or fallback icon */}
                    <Show
                      when={feed.imageUrl}
                      fallback={
                        <div class="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                          <Rss size={20} class="text-base-content/50" />
                        </div>
                      }
                    >
                      <img
                        src={feed.imageUrl!}
                        alt=""
                        class="bg-base-200 h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </Show>

                    <div class="min-w-0 flex-1">
                      <div class="font-medium">{feed.title}</div>
                      <Show when={feed.description}>
                        <div class="text-base-content/60 mt-0.5 line-clamp-2 text-sm">
                          {feed.description}
                        </div>
                      </Show>
                      <div class="text-base-content/40 mt-1 truncate text-xs">{feed.siteUrl}</div>
                    </div>

                    <Show
                      when={!isAdded()}
                      fallback={<span class="badge badge-success gap-1">Following</span>}
                    >
                      <button
                        type="button"
                        class="btn btn-primary btn-sm flex-shrink-0"
                        onClick={() => props.onFollow(feed)}
                      >
                        Follow
                      </button>
                    </Show>
                  </div>
                </Card>
              );
            }}
          </For>
        </div>

        {/* Load more */}
        <Show when={hasMore()}>
          <div class="mt-4 text-center">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onClick={() => setVisibleCount((prev) => prev + FEEDS_PER_PAGE)}
            >
              Show more ({filteredFeeds().length - visibleCount()} remaining)
            </button>
          </div>
        </Show>

        {/* No results */}
        <Show when={filteredFeeds().length === 0}>
          <div class="text-base-content/40 py-8 text-center text-sm">
            No feeds found. Try a different search or category.
          </div>
        </Show>
      </div>
    </>
  );
}
