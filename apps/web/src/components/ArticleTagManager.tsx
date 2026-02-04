import type { Tag } from '@repo/shared/types';
import { createId } from '@repo/shared/utils';
import { eq, useLiveQuery } from '@tanstack/solid-db';
import { Link } from '@tanstack/solid-router';
import PlusIcon from 'lucide-solid/icons/plus';
import { For } from 'solid-js';
import { articleTagsCollection } from '~/entities/article-tags';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

interface ArticleTagManagerProps {
  articleId: string;
  tags: Tag[];
}

export function ArticleTagManager(props: ArticleTagManagerProps) {
  let triggerRef: HTMLButtonElement | undefined;
  let popoverRef: HTMLDivElement | undefined;

  // Query article tags for this specific article
  const articleTagsQuery = useLiveQuery((q) =>
    q
      .from({ articleTag: articleTagsCollection })
      .where(({ articleTag }) => eq(articleTag.articleId, props.articleId)),
  );

  const selectedTagIds = () => (articleTagsQuery.data ?? []).map((at) => at.tagId);
  const selectedTags = () => props.tags.filter((t) => selectedTagIds().includes(t.id));
  const availableTags = () => props.tags.filter((tag) => !selectedTagIds().includes(tag.id));

  const removeTag = (tagId: string) => {
    const articleTag = (articleTagsQuery.data ?? []).find((at) => at.tagId === tagId);
    if (articleTag) {
      articleTagsCollection.delete(articleTag.id);
    }
  };

  const addTag = (tagId: string) => {
    articleTagsCollection.insert({
      id: createId(),
      userId: '', // Will be set by server
      articleId: props.articleId,
      tagId,
    });
    popoverRef?.hidePopover();
  };

  const updatePosition = () => {
    if (!triggerRef || !popoverRef) return;
    const bounds = triggerRef.getBoundingClientRect();
    popoverRef.style.top = `${bounds.bottom + 4}px`;
    popoverRef.style.left = `${bounds.left}px`;
    popoverRef.style.minWidth = '200px';
  };

  const openPopover = () => {
    if (!popoverRef) return;
    popoverRef.showPopover();
    updatePosition();
  };

  return (
    <div class="relative">
      <div class="flex flex-wrap items-center gap-1.5">
        <For each={selectedTags()}>
          {(tag) => (
            <div class="badge badge-sm gap-1 transition-all hover:brightness-90">
              <ColorIndicator class={getTagDotColor(tag.color)} />
              <Link to="/tags/$tagId" params={{ tagId: tag.id.toString() }}>
                {tag.name}
              </Link>
              <button
                type="button"
                class="ml-0.5 text-xs opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTag(tag.id);
                }}
                title="Remove tag"
              >
                ×
              </button>
            </div>
          )}
        </For>

        <button
          ref={(el) => (triggerRef = el)}
          type="button"
          class="btn btn-ghost btn-xs gap-1"
          onClick={openPopover}
        >
          <PlusIcon size={12} />
          <span>Tag</span>
        </button>
      </div>

      {/* Popover Dropdown - renders in top-layer */}
      <div
        ref={(el) => (popoverRef = el)}
        popover="auto"
        class="dropdown-content border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
      >
        <div class="max-h-60 overflow-y-auto py-2">
          <For
            each={availableTags()}
            fallback={<div class="text-base-content/60 px-4 py-2 text-sm">All tags assigned</div>}
          >
            {(tag) => (
              <button
                type="button"
                class="hover:bg-base-200 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
                onClick={() => addTag(tag.id)}
              >
                <ColorIndicator class={getTagDotColor(tag.color)} />
                <span>{tag.name}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
