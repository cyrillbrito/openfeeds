import type { Tag } from '@repo/shared/types';
import { Link } from '@tanstack/solid-router';
import PlusIcon from 'lucide-solid/icons/plus';
import { createSignal, For, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getTagDotColor } from '../utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

interface ArticleTagManagerProps {
  tags: Tag[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export function ArticleTagManager(props: ArticleTagManagerProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [triggerEl, setTriggerEl] = createSignal<HTMLElement>();
  const [dropdownStyle, setDropdownStyle] = createSignal<JSX.CSSProperties>({});

  const selectedTags = () => props.tags.filter((t) => props.selectedIds.includes(t.id));

  const removeTag = (tagId: number) => {
    const newIds = props.selectedIds.filter((id) => id !== tagId);
    props.onSelectionChange(newIds);
  };

  const openDropdown = () => {
    setIsOpen(true);
    const bounds = triggerEl()!.getBoundingClientRect();
    setDropdownStyle({
      top: `${bounds.bottom + 4}px`,
      left: `${bounds.left}px`,
      'min-width': '200px',
    });
  };

  return (
    <>
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
          ref={setTriggerEl}
          type="button"
          class="btn btn-ghost btn-xs gap-1"
          onClick={openDropdown}
        >
          <PlusIcon size={12} />
          <span>Tag</span>
        </button>
      </div>

      <Show when={isOpen()}>
        <Portal>
          <ArticleTagDropdown
            tags={props.tags}
            selectedIds={props.selectedIds}
            onSelectionChange={(ids) => {
              props.onSelectionChange(ids);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
            style={dropdownStyle()}
          />
        </Portal>
      </Show>
    </>
  );
}

interface ArticleTagDropdownProps {
  tags: Tag[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onClose: () => void;
  style: JSX.CSSProperties;
}

function ArticleTagDropdown(props: ArticleTagDropdownProps) {
  const availableTags = () => props.tags.filter((tag) => !props.selectedIds.includes(tag.id));

  const addTag = (tagId: number) => {
    const newIds = [...props.selectedIds, tagId];
    props.onSelectionChange(newIds);
  };

  return (
    <>
      <div class="fixed inset-0 z-30" onClick={() => props.onClose()}></div>
      <div
        class="dropdown-content border-base-300 bg-base-100 fixed z-30 rounded-lg border shadow-lg"
        style={props.style}
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
    </>
  );
}
