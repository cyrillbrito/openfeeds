import type { ArticleTag, Tag } from '@repo/domain/client';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { ColorIndicator } from '~/components/ColorIndicator';
import { getTagDotColor } from '~/utils/tagColors';

interface ArticleTagManagerProps {
  tags: Tag[];
  articleTags: ArticleTag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (articleTagId: string) => void;
}

export function ArticleTagManager({ tags, articleTags, onAddTag, onRemoveTag }: ArticleTagManagerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedTagIds = articleTags.map((at) => at.tagId);
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));
  const availableTags = tags.filter((tag) => !selectedTagIds.includes(tag.id));

  const removeTag = (tagId: string) => {
    const articleTag = articleTags.find((at) => at.tagId === tagId);
    if (articleTag) {
      onRemoveTag(articleTag.id);
    }
  };

  const addTag = (tagId: string) => {
    onAddTag(tagId);
    (popoverRef.current as any)?.hidePopover();
  };

  const openPopover = () => {
    if (!popoverRef.current || !triggerRef.current) return;
    (popoverRef.current as any).showPopover();
    const bounds = triggerRef.current.getBoundingClientRect();
    popoverRef.current.style.top = `${bounds.bottom + 4}px`;
    popoverRef.current.style.left = `${bounds.left}px`;
    popoverRef.current.style.minWidth = '200px';
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <div key={tag.id} className="badge badge-sm gap-1 transition-all hover:brightness-90">
            <ColorIndicator className={getTagDotColor(tag.color)} />
            <Link to="/tags/$tagId" params={{ tagId: tag.id }}>
              {tag.name}
            </Link>
            <button
              type="button"
              className="ml-0.5 text-xs opacity-60 hover:opacity-100"
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
        ))}

        <button
          ref={triggerRef}
          type="button"
          className="btn btn-ghost btn-xs gap-1"
          onClick={openPopover}
        >
          <Plus size={12} />
          <span>Tag</span>
        </button>
      </div>

      {/* Popover Dropdown - renders in top-layer */}
      <div
        ref={popoverRef}
        {...({ popover: 'auto' } as any)}
        className="dropdown-content border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
      >
        <div className="max-h-60 overflow-y-auto py-2">
          {availableTags.length === 0 ? (
            <div className="text-base-content/60 px-4 py-2 text-sm">All tags assigned</div>
          ) : (
            availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="hover:bg-base-200 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
                onClick={() => addTag(tag.id)}
              >
                <ColorIndicator className={getTagDotColor(tag.color)} />
                <span>{tag.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
