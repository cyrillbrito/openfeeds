import type { FollowFeedsWithTags } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { createOptimisticAction } from '@tanstack/solid-db';
import { feedTagsCollection } from '~/entities/feed-tags';
import { feedsCollection } from '~/entities/feeds';
import { $$followFeedsWithTags } from '~/entities/feeds.server';
import { tagsCollection } from '~/entities/tags';

// ---------------------------------------------------------------------------
// Optimistic action: follow feeds + tags in one transaction
// ---------------------------------------------------------------------------

export const followFeedsAction = createOptimisticAction<FollowFeedsWithTags>({
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
    const { txid } = await $$followFeedsWithTags({ data: vars });

    // createOptimisticAction doesn't auto-wire txid like electricCollectionOptions,
    // so we must explicitly await sync confirmation on each touched collection.
    // This keeps the optimistic overlay active until Electric confirms the mutation.
    const awaitPromises = [feedsCollection.utils.awaitTxId(txid)];
    if (vars.newTags.length > 0) awaitPromises.push(tagsCollection.utils.awaitTxId(txid));
    if (vars.feedTags.length > 0) awaitPromises.push(feedTagsCollection.utils.awaitTxId(txid));
    await Promise.all(awaitPromises);
  },
});

/**
 * Build FollowFeedsWithTags vars for feeds that should be auto-tagged by category.
 * Resolves existing tags (case-insensitive) or creates new ones.
 */
export function buildFollowVars(
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
