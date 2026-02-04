import type { Tag } from '@repo/shared/types';
import { autofocus } from '@solid-primitives/autofocus';
import CheckIcon from 'lucide-solid/icons/check';
import SearchIcon from 'lucide-solid/icons/search';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

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

  const [isOpen, setIsOpen] = createSignal(false);
  const [selectedIds, setSelectedIds] = createSignal(props.selectedIds);

  const selectedTags = () => props.tags.filter((t) => selectedIds().includes(t.id));

  const updatePosition = () => {
    if (!triggerRef || !popoverRef) return;
    const bounds = triggerRef.getBoundingClientRect();
    popoverRef.style.top = `${bounds.bottom + 3}px`;
    popoverRef.style.left = `${bounds.left}px`;
    popoverRef.style.width = `${bounds.width}px`;
  };

  const openPopover = () => {
    if (!popoverRef) return;
    popoverRef.showPopover();
    updatePosition();
    setIsOpen(true);
  };

  const closePopover = () => {
    if (!popoverRef) return;
    popoverRef.hidePopover();
    setIsOpen(false);
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
      setIsOpen(e.newState === 'open');
    };

    popoverRef.addEventListener('toggle', handleToggle);
    onCleanup(() => popoverRef?.removeEventListener('toggle', handleToggle));
  });

  return (
    <div class="relative">
      <div
        ref={(el) => (triggerRef = el)}
        class="select flex cursor-pointer items-center overflow-hidden"
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
        <Show when={selectedIds().length <= 3} fallback={<>{selectedIds().length} Selected Tags</>}>
          <For each={selectedTags()} fallback={<>No tag selected</>}>
            {(tag) => (
              <div class="badge badge-sm min-w-2">
                <ColorIndicator class={getTagDotColor(tag.color)} />
                <span class="truncate">{tag.name}</span>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Popover Dropdown - renders in top-layer */}
      <div
        ref={(el) => (popoverRef = el)}
        popover="auto"
        class="dropdown-content border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
      >
        <MultiSelectTagDropdown
          tags={props.tags}
          selectedIds={selectedIds()}
          onSelectionChange={(ids) => {
            setSelectedIds(ids);
            props.onSelectionChange(ids);
          }}
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
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search..."
            autofocus
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </label>
        <div class="bg-base-300 h-px w-full"></div>
      </Show>

      {/* Tag List */}
      <div
        role="listbox"
        aria-multiselectable="true"
        class="max-h-60 space-y-1 overflow-y-auto py-2"
      >
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
                class="focus:ring-primary/50 m-1 flex cursor-pointer items-center gap-2 rounded p-2 outline-none focus:ring-2"
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
                    <CheckIcon size={16} class="text-primary" />
                  </Show>
                </div>
                <ColorIndicator class={getTagDotColor(tag.color)} />
                <div class="flex-1">{tag.name}</div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
