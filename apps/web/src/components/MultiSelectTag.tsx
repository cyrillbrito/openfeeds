import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import type { Tag } from '@repo/domain/client';
import { autofocus } from '@solid-primitives/autofocus';
import { Check, ChevronDown, Search, Tag as TagIcon } from 'lucide-solid';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';
import { TagBadge } from './TagBadge';

// prevents from being tree-shaken by TS
void autofocus;

interface MultiSelectTagProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function MultiSelectTag(props: MultiSelectTagProps) {
  let triggerRef: HTMLDivElement | undefined;
  let popoverRef: HTMLDivElement | undefined;
  let cleanupAutoUpdate: (() => void) | undefined;

  const [isOpen, setIsOpen] = createSignal(false);

  const selectedTags = () => props.tags.filter((t) => props.selectedIds.includes(t.id));

  const updatePosition = () => {
    if (!triggerRef || !popoverRef) return;
    computePosition(triggerRef, popoverRef, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        offset(3),
        flip(),
        shift({ padding: 8 }),
        size({
          apply({ rects, elements }) {
            Object.assign(elements.floating.style, { width: `${rects.reference.width}px` });
          },
        }),
      ],
    }).then(({ x, y }) => {
      if (!popoverRef) return;
      Object.assign(popoverRef.style, { top: `${y}px`, left: `${x}px` });
    });
  };

  const openPopover = () => {
    if (!popoverRef || !triggerRef) return;
    popoverRef.showPopover();
    setIsOpen(true);
    // Keep position updated while open (handles scroll, resize, layout shifts)
    cleanupAutoUpdate = autoUpdate(triggerRef, popoverRef, updatePosition);
  };

  const closePopover = () => {
    if (!popoverRef) return;
    popoverRef.hidePopover();
    setIsOpen(false);
    cleanupAutoUpdate?.();
    cleanupAutoUpdate = undefined;
  };

  const togglePopover = () => {
    if (isOpen()) {
      closePopover();
    } else {
      openPopover();
    }
  };

  // Handle popover toggle event (fires on light dismiss)
  createEffect(() => {
    if (!popoverRef) return;

    const handleToggle = (e: ToggleEvent) => {
      const nowOpen = e.newState === 'open';
      setIsOpen(nowOpen);
      if (!nowOpen) {
        cleanupAutoUpdate?.();
        cleanupAutoUpdate = undefined;
      }
    };

    popoverRef.addEventListener('toggle', handleToggle);
    onCleanup(() => {
      popoverRef?.removeEventListener('toggle', handleToggle);
      cleanupAutoUpdate?.();
    });
  });

  return (
    <div class="relative">
      {/* Trigger */}
      <div
        ref={(el) => (triggerRef = el)}
        class="border-base-300 bg-base-100 hover:bg-base-200 flex min-h-12 cursor-pointer items-center rounded-lg border px-3 py-2 transition-colors"
        classList={{ 'ring-primary/50 ring-2': isOpen() }}
        tabIndex="0"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        onClick={togglePopover}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePopover();
          }
        }}
      >
        <Show
          when={selectedTags().length > 0}
          fallback={
            <div class="text-base-content/40 flex flex-1 items-center gap-2">
              <TagIcon size={14} />
              <span class="text-sm">Select tags...</span>
            </div>
          }
        >
          <div class="flex flex-1 flex-wrap gap-1.5">
            <For each={selectedTags()}>
              {(tag) => <TagBadge name={tag.name} color={tag.color} size="sm" />}
            </For>
          </div>
        </Show>
        <ChevronDown
          size={16}
          class="text-base-content/40 ml-2 shrink-0 transition-transform"
          classList={{ 'rotate-180': isOpen() }}
        />
      </div>

      {/* Popover Dropdown - renders in top-layer */}
      <div
        ref={(el) => (popoverRef = el)}
        popover="auto"
        class="dropdown-content border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
      >
        <MultiSelectTagDropdown
          tags={props.tags}
          selectedIds={props.selectedIds}
          onSelectionChange={props.onSelectionChange}
        />
      </div>
    </div>
  );
}

interface MultiSelectTagDropdownProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function MultiSelectTagDropdown(props: MultiSelectTagDropdownProps) {
  const showSearch = () => props.tags.length > 5;

  const [searchQuery, setSearchQuery] = createSignal('');

  const filteredTags = () => {
    const query = searchQuery().toLowerCase();
    return props.tags.filter((tag) => tag.name.toLowerCase().includes(query));
  };

  const toggle = (tagId: string) => {
    const isSelected = props.selectedIds.includes(tagId);
    const newIds = isSelected
      ? props.selectedIds.filter((id) => id !== tagId)
      : [...props.selectedIds, tagId];
    props.onSelectionChange(newIds);
  };

  return (
    <>
      {/* Search Input */}
      <Show when={showSearch()}>
        <label class="input input-ghost outline-none!">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search tags..."
            autofocus
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </label>
        <div class="bg-base-300 h-px w-full"></div>
      </Show>

      {/* Tag List */}
      <div role="listbox" aria-multiselectable="true" class="max-h-60 overflow-y-auto p-1">
        <For
          each={filteredTags()}
          fallback={<div class="text-base-content/60 py-4 text-center text-sm">No tags found</div>}
        >
          {(tag) => {
            const isSelected = () => props.selectedIds.includes(tag.id);

            return (
              <div
                role="option"
                aria-selected={isSelected()}
                tabIndex="0"
                class="focus:ring-primary/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none focus:ring-2"
                classList={{
                  'bg-primary/10': isSelected(),
                  'hover:bg-base-200 focus:bg-base-200': !isSelected(),
                }}
                onClick={() => toggle(tag.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(tag.id);
                  }
                }}
              >
                <div class="flex w-5 items-center justify-center">
                  <Show when={isSelected()}>
                    <Check size={16} class="text-primary" />
                  </Show>
                </div>
                <ColorIndicator class={getTagDotColor(tag.color)} />
                <div class="flex-1 text-sm">{tag.name}</div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
