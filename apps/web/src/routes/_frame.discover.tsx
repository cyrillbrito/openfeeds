import type { DiscoveredFeed, FollowFeedsWithTags } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { createFileRoute } from '@tanstack/react-router';
import {
  BookmarkPlus,
  CircleAlert,
  ExternalLink,
  FileUp,
  Globe,
  Mail,
  Podcast,
  Rss,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '~/components/Card';
import {
  CuratedFeedsBrowser,
  type CuratedFeedWithCategory,
} from '~/components/CuratedFeedsBrowser';
import { ImportOpmlModal } from '~/components/ImportOpmlModal';
import type { ModalController } from '~/components/LazyModal';
import { MultiSelectTag } from '~/components/MultiSelectTag';
import { PageLayout } from '~/components/PageLayout';
import { RedditIcon } from '~/components/RedditIcon';
import { YouTubeIcon } from '~/components/YouTubeIcon';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { buildFollowVars, followFeedsAction } from '~/entities/follow-feeds';
import { useTags } from '~/entities/tags';
import { api, unwrap } from '~/lib/api-client';

export const Route = createFileRoute('/_frame/discover')({
  component: DiscoverPage,
  validateSearch: (search): { url?: string } => {
    const raw = (search?.url as string) || undefined;
    const url = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
    return { url };
  },
});

const OPML_DISMISSED_KEY = 'discover:opml-dismissed';

const formatFeedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
};

function DiscoverPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const [inputUrl, setInputUrl] = useState(search?.url ?? '');

  const searchUrl = search?.url;
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveredFeed[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchUrl) {
      setDiscoveryResult(null);
      setDiscoveryError(null);
      return;
    }
    setIsLoading(true);
    setDiscoveryError(null);
    setDiscoveryResult(null);
    unwrap(api.api.feeds.discover.$post({ json: { url: searchUrl } }))
      .then(setDiscoveryResult)
      .catch((err: Error) => setDiscoveryError(err.message ?? String(err)))
      .finally(() => setIsLoading(false));
  }, [searchUrl]);

  const [addedFeeds, setAddedFeeds] = useState(new Set<string>());
  const [savedArticle, setSavedArticle] = useState(false);
  const [feedTagSelections, setFeedTagSelections] = useState<Record<string, string[]>>({});
  const [articleTags, setArticleTags] = useState<string[]>([]);

  // Reset ephemeral state when the search URL changes (skip initial render)
  const prevSearchUrlRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevSearchUrlRef.current !== undefined && prevSearchUrlRef.current !== searchUrl) {
      setAddedFeeds(new Set());
      setSavedArticle(false);
      setFeedTagSelections({});
      setArticleTags([]);
    }
    prevSearchUrlRef.current = searchUrl;
  }, [searchUrl]);

  const importOpmlModalRef = useRef<ModalController>(null!);

  const [opmlDismissed, setOpmlDismissed] = useState(
    typeof localStorage !== 'undefined' && localStorage.getItem(OPML_DISMISSED_KEY) === '1',
  );
  const dismissOpml = () => {
    localStorage.setItem(OPML_DISMISSED_KEY, '1');
    setOpmlDismissed(true);
  };

  const tags = useTags();
  const feeds = useFeeds();
  const existingFeedUrls = useMemo(() => new Set(feeds.map((f) => f.feedUrl)), [feeds]);

  const isIdle = !searchUrl;
  const discoveredFeeds = discoveryResult ?? [];
  const hasFeeds = discoveredFeeds.length > 0;

  const handleDiscover = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setInputUrl(normalized);
    void navigate({ search: { url: normalized } });
  };

  const handleExampleClick = (exampleUrl: string) => {
    setInputUrl(exampleUrl);
    void navigate({ search: { url: exampleUrl } });
  };

  const handleFollowFeed = (feed: DiscoveredFeed) => {
    const selectedTagIds = feedTagSelections[feed.url] || [];
    const feedId = createId();

    const vars: FollowFeedsWithTags = {
      feeds: [{ id: feedId, feedUrl: feed.url, url: searchUrl }],
      newTags: [],
      feedTags: selectedTagIds.map((tagId) => ({ id: createId(), feedId, tagId })),
    };

    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, feed.url]));
  };

  const handleAddManually = () => {
    const currentUrl = searchUrl!;
    const feedId = createId();

    const vars: FollowFeedsWithTags = {
      feeds: [{ id: feedId, feedUrl: currentUrl }],
      newTags: [],
      feedTags: [],
    };

    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, currentUrl]));
  };

  const handleSaveArticle = () => {
    const currentUrl = searchUrl!;
    const articleId = createId();

    articlesCollection.insert({
      id: articleId,
      userId: '',
      feedId: null,
      title: currentUrl,
      url: currentUrl,
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

    if (articleTags.length > 0) {
      for (const tagId of articleTags) {
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
      [
        {
          feedUrl: feed.feedUrl,
          categoryName: feed.categoryName,
          url: feed.url,
          title: feed.title,
          description: feed.description,
          icon: feed.icon,
        },
      ],
      tags,
    );
    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, feed.feedUrl]));
  };

  const handleFollowAllCurated = (curatedFeeds: CuratedFeedWithCategory[]) => {
    const toFollow = curatedFeeds.filter(
      (f) => !existingFeedUrls.has(f.feedUrl) && !addedFeeds.has(f.feedUrl),
    );
    if (toFollow.length === 0) return;

    const vars = buildFollowVars(
      toFollow.map((f) => ({
        feedUrl: f.feedUrl,
        categoryName: f.categoryName,
        url: f.url,
        title: f.title,
        description: f.description,
        icon: f.icon,
      })),
      tags,
    );
    followFeedsAction(vars);
    setAddedFeeds((prev) => new Set([...prev, ...toFollow.map((f) => f.feedUrl)]));
  };

  return (
    <PageLayout title="Discover" mobileOnlyTitle>
      <div className="sm:py-4">
        <h2 className="mb-2 hidden text-2xl font-bold sm:block sm:text-3xl">Discover</h2>
        <p className="text-base-content/60 mb-4 sm:mb-6">
          Paste any link to find feeds to follow or save an article for later.
        </p>

        <form onSubmit={handleDiscover} className="flex gap-2">
          <label className="input input-bordered flex flex-1 items-center gap-2">
            <Search size={20} className="opacity-50" />
            <input
              type="text"
              placeholder="Try youtube.com/mkbhd"
              className="grow"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.currentTarget.value)}
              required
            />
            {inputUrl && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => {
                  setInputUrl('');
                  void navigate({ search: {} });
                }}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Discover'
            )}
          </button>
        </form>
      </div>

      {discoveryError && (
        <div className="alert alert-error mb-6">
          <CircleAlert size={20} />
          <span>{discoveryError}</span>
        </div>
      )}

      {searchUrl && !isLoading && (
        <div className="space-y-6">
          {hasFeeds && (
            <div>
              <h3 className="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                {discoveredFeeds.length === 1
                  ? 'Found 1 feed'
                  : `Found ${discoveredFeeds.length} feeds`}
              </h3>

              <div className="grid gap-3">
                {discoveredFeeds.map((feed) => {
                  const isAdded = addedFeeds.has(feed.url) || existingFeedUrls.has(feed.url);
                  const selectedTagIds = feedTagSelections[feed.url] || [];

                  return (
                    <Card key={feed.url}>
                      <div className="flex items-start gap-3">
                        {feed.icon ? (
                          <img
                            src={feed.icon}
                            alt="Feed icon"
                            className="bg-base-200 h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                            <Rss size={20} className="text-base-content/50" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="text-base-content text-base font-semibold">
                            {feed.title || feed.url}
                          </div>
                          {feed.description && (
                            <div className="text-base-content/65 mt-0.5 line-clamp-2 text-sm leading-snug">
                              {feed.description}
                            </div>
                          )}
                          <a
                            href={feed.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base-content/45 hover:text-base-content/65 mt-1 inline-flex max-w-full items-center gap-1.5 text-xs transition-colors"
                          >
                            <Globe size={12} className="flex-shrink-0" />
                            <span className="truncate font-mono">{formatFeedUrl(feed.url)}</span>
                            <ExternalLink size={11} className="flex-shrink-0" />
                          </a>
                        </div>
                      </div>

                      {!isAdded ? (
                        <div className="border-base-300 mt-4 border-t pt-3">
                          <div className="text-base-content/55 mb-2 flex items-center justify-between text-xs">
                            <span className="font-medium">Tags (optional)</span>
                            {selectedTagIds.length > 0 && (
                              <span>{selectedTagIds.length} selected</span>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            {tags.length > 0 && (
                              <MultiSelectTag
                                tags={tags}
                                selectedIds={selectedTagIds}
                                onSelectionChange={(ids) =>
                                  setFeedTagSelections((prev) => ({
                                    ...prev,
                                    [feed.url]: ids,
                                  }))
                                }
                              />
                            )}
                            <button
                              type="button"
                              className="btn btn-neutral h-10 px-5 sm:min-w-28"
                              onClick={() => handleFollowFeed(feed)}
                            >
                              Follow feed
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <span className="badge badge-success gap-1">Following</span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {!hasFeeds && !discoveryError && (
            <div className="alert alert-warning mb-4">
              <span>No feeds found for this site.</span>
            </div>
          )}

          {!savedArticle && (
            <div>
              <h3 className="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                {hasFeeds ? 'Or save this page' : 'Save as article'}
              </h3>

              <Card>
                <div className="flex items-center gap-3">
                  <div className="bg-base-200 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                    <Globe size={20} className="text-base-content/50" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{searchUrl}</div>
                    <div className="text-base-content/50 text-xs">Save this page as an article</div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSaveArticle}
                  >
                    <BookmarkPlus size={16} />
                    Save
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="mt-3">
                    <MultiSelectTag
                      tags={tags}
                      selectedIds={articleTags}
                      onSelectionChange={setArticleTags}
                    />
                  </div>
                )}
              </Card>
            </div>
          )}

          {savedArticle && (
            <div className="alert alert-success">
              <span>Article saved!</span>
            </div>
          )}

          {!hasFeeds && !addedFeeds.has(searchUrl) && !existingFeedUrls.has(searchUrl) && (
            <div>
              <h3 className="text-base-content/70 mb-3 text-sm font-semibold tracking-wide uppercase">
                Advanced
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleAddManually}>
                Add URL directly as a feed
              </button>
            </div>
          )}

          {!hasFeeds && (addedFeeds.has(searchUrl) || existingFeedUrls.has(searchUrl)) && (
            <div className="alert alert-success">
              <span>Feed followed! We'll start syncing it.</span>
            </div>
          )}
        </div>
      )}

      {isIdle && (
        <>
          {!opmlDismissed && (
            <div className="bg-base-200 mt-2 flex items-center gap-3 rounded-xl px-4 py-2.5">
              <FileUp size={16} className="text-base-content/50 flex-shrink-0" />
              <p className="text-base-content/70 flex-1 text-sm">
                Switching from another reader?{' '}
                <button
                  type="button"
                  className="link link-primary"
                  onClick={() => importOpmlModalRef.current.open()}
                >
                  Import your OPML file
                </button>
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
                onClick={dismissOpml}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mt-6 sm:mt-8">
            <p className="text-base-content/60 mb-3 text-sm">
              It works with any site that publishes content,{' '}
              <span className="text-base-content font-medium">not just blogs</span>.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                className="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://youtube.com/@mkbhd')}
              >
                <div className="flex items-center gap-2">
                  <YouTubeIcon className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm font-medium">YouTube</p>
                </div>
                <p className="text-base-content/60 mt-1 text-xs leading-snug">
                  Follow any channel to get new videos.
                </p>
                <p className="text-base-content/40 mt-1 truncate text-xs">youtube.com/@mkbhd</p>
              </button>
              <button
                type="button"
                className="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://www.reddit.com/r/movies.rss')}
              >
                <div className="flex items-center gap-2">
                  <RedditIcon className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm font-medium">Reddit</p>
                </div>
                <p className="text-base-content/60 mt-1 text-xs leading-snug">
                  Follow subreddits without an account.
                </p>
                <p className="text-base-content/40 mt-1 truncate text-xs">reddit.com/r/movies</p>
              </button>
              <button
                type="button"
                className="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://feeds.npr.org/510289/podcast.xml')}
              >
                <div className="flex items-center gap-2">
                  <Podcast size={16} className="flex-shrink-0" />
                  <p className="text-sm font-medium">Podcasts</p>
                </div>
                <p className="text-base-content/60 mt-1 text-xs leading-snug">
                  Get notified when new episodes drop.
                </p>
                <p className="text-base-content/40 mt-1 truncate text-xs">
                  feeds.npr.org/510289/...
                </p>
              </button>
              <button
                type="button"
                className="bg-base-200 hover:bg-base-300 rounded-xl px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3"
                onClick={() => handleExampleClick('https://seths.blog')}
              >
                <div className="flex items-center gap-2">
                  <Mail size={16} className="flex-shrink-0" />
                  <p className="text-sm font-medium">Newsletters</p>
                </div>
                <p className="text-base-content/60 mt-1 text-xs leading-snug">
                  Read without giving out your email.
                </p>
                <p className="text-base-content/40 mt-1 truncate text-xs">seths.blog</p>
              </button>
            </div>
          </div>

          <CuratedFeedsBrowser
            existingFeedUrls={existingFeedUrls}
            addedFeeds={addedFeeds}
            onFollow={handleFollowCurated}
            onFollowAll={handleFollowAllCurated}
          />
        </>
      )}

      <ImportOpmlModal
        controller={(c) => {
          importOpmlModalRef.current = c;
        }}
      />
    </PageLayout>
  );
}
