import {
  Apple,
  Armchair,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Clapperboard,
  Code,
  FlaskConical,
  Gamepad2,
  Globe,
  Hammer,
  Landmark,
  Laugh,
  Medal,
  MonitorSmartphone,
  Music,
  Newspaper,
  Palette,
  Plane,
  Rocket,
  Rss,
  Search,
  Shirt,
  Smartphone,
  Sparkles,
  Telescope,
  Trophy,
  Tv,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideProps,
} from 'lucide-solid';
import { createMemo, createSignal, For, Show, type Component } from 'solid-js';
import { Card } from '~/components/Card';
import curatedCategories from '~/data/curated-feeds.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CuratedFeed = {
  title: string;
  description: string | null;
  feedUrl: string;
  siteUrl: string;
  imageUrl: string | null;
};

export type CuratedFeedWithCategory = CuratedFeed & {
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

// ---------------------------------------------------------------------------
// Lucide icon resolver — maps icon name strings (from curated-feeds.json) to
// components. The JSON is the single source of truth for which icon each
// category uses; this map just resolves names to imports.
// ---------------------------------------------------------------------------

const LUCIDE_ICONS: Record<string, Component<LucideProps>> = {
  Apple,
  Armchair,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Clapperboard,
  Code,
  FlaskConical,
  Gamepad2,
  Globe,
  Hammer,
  Landmark,
  Laugh,
  Medal,
  MonitorSmartphone,
  Music,
  Newspaper,
  Palette,
  Plane,
  Rocket,
  Rss,
  Shirt,
  Smartphone,
  Sparkles,
  Telescope,
  Trophy,
  Tv,
  UtensilsCrossed,
  Wallet,
};

const FEEDS_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CuratedFeedsBrowser(props: {
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
              const LucideIcon = LUCIDE_ICONS[cat.icon];
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
