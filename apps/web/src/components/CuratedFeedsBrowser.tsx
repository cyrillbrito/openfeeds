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
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '~/components/Card';

async function fetchCuratedCategories(): Promise<CuratedCategory[]> {
  const res = await fetch('/curated-feeds.json');
  if (!res.ok) throw new Error(`Failed to load curated feeds: ${res.status}`);
  return (await res.json()) as CuratedCategory[];
}

type CuratedFeed = {
  title: string;
  description: string | null;
  feedUrl: string;
  url: string;
  icon: string | null;
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

const LUCIDE_ICONS: Record<string, ComponentType<LucideProps>> = {
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

export function CuratedFeedsBrowser(props: {
  existingFeedUrls: Set<string>;
  addedFeeds: Set<string>;
  onFollow: (feed: CuratedFeedWithCategory) => void;
  onFollowAll: (feeds: CuratedFeedWithCategory[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(FEEDS_PER_PAGE);
  const [categories, setCategories] = useState<CuratedCategory[]>([]);

  useEffect(() => {
    fetchCuratedCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load curated feeds:', err));
  }, []);

  const categoryMatchCounts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return null;

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
  }, [categories, searchQuery]);

  const filteredFeeds = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const catSlug = selectedCategory;

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
  }, [categories, searchQuery, selectedCategory]);

  const visibleFeeds = filteredFeeds.slice(0, visibleCount);
  const hasMore = visibleCount < filteredFeeds.length;

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
      <div className="divider sm:my-8">or</div>

      <div>
        <h3 className="mb-4 text-lg font-semibold sm:mb-5">Popular Feeds</h3>

        <label className="input input-bordered input-sm mb-4 flex items-center gap-2 sm:mb-5">
          <Search size={14} className="opacity-50" />
          <input
            type="text"
            placeholder="Filter feeds..."
            className="grow"
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => handleSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </label>

        {/* Category pills — horizontal scroll */}
        <div className="-mx-4 mb-4 flex scrollbar-none gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:mb-5 sm:scrollbar-thin sm:px-6">
          <button
            type="button"
            className={`btn btn-sm shrink-0 rounded-full ${selectedCategory === null ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handleCategorySelect(null)}
          >
            All
          </button>
          {categories.map((cat) => {
            const LucideIcon = LUCIDE_ICONS[cat.icon];
            const isEmpty = categoryMatchCounts?.get(cat.slug) === 0;
            const isSelected = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                className={`btn btn-sm shrink-0 gap-1.5 rounded-full ${isSelected ? 'btn-primary' : 'btn-outline'}${isEmpty && !isSelected ? ' btn-disabled opacity-40' : ''}`}
                onClick={() => handleCategorySelect(isSelected ? null : cat.slug)}
              >
                {LucideIcon ? (
                  <LucideIcon size={14} strokeWidth={2.5} />
                ) : (
                  <span className="text-sm">{cat.icon}</span>
                )}
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Results count + Follow all */}
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <p className="text-base-content/50 text-sm">
            {filteredFeeds.length} {filteredFeeds.length === 1 ? 'feed' : 'feeds'}
            {selectedCategory && (
              <> in {categories.find((c) => c.slug === selectedCategory)?.name}</>
            )}
            {searchQuery && <> matching "{searchQuery}"</>}
          </p>
          {selectedCategory && filteredFeeds.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => props.onFollowAll(filteredFeeds)}
            >
              Follow all
            </button>
          )}
        </div>

        {/* Feed cards */}
        <div className="grid gap-3 sm:gap-4">
          {visibleFeeds.map((feed) => {
            const isAdded =
              props.addedFeeds.has(feed.feedUrl) || props.existingFeedUrls.has(feed.feedUrl);

            return (
              <Card key={feed.feedUrl}>
                <div className="flex items-start gap-3">
                  {feed.icon ? (
                    <img
                      src={feed.icon}
                      alt=""
                      className="bg-base-200 h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <Rss size={20} className="text-base-content/50" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{feed.title}</div>
                    {feed.description && (
                      <div className="text-base-content/60 mt-0.5 line-clamp-2 text-sm">
                        {feed.description}
                      </div>
                    )}
                    <div className="text-base-content/40 mt-1 truncate text-xs">{feed.url}</div>
                  </div>

                  {isAdded ? (
                    <span className="badge badge-success gap-1">Following</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-shrink-0"
                      onClick={() => props.onFollow(feed)}
                    >
                      Follow
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setVisibleCount((prev) => prev + FEEDS_PER_PAGE)}
            >
              Show more ({filteredFeeds.length - visibleCount} remaining)
            </button>
          </div>
        )}

        {/* No results */}
        {filteredFeeds.length === 0 && (
          <div className="text-base-content/40 py-8 text-center text-sm">
            No feeds found. Try a different search or category.
          </div>
        )}
      </div>
    </>
  );
}
