import type { Tag } from '@repo/domain/client';
import { autofocus } from '@solid-primitives/autofocus';
import { Check, ChevronDown, Search, Tag as TagIcon } from 'lucide-solid';
import { createSignal, createUniqueId, For, Show } from 'solid-js';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';
import { TagBadge } from './TagBadge';

// prevents from being tree-shaken by TS
void autofocus;

let counter = 0;

interface MultiSelectTagProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function MultiSelectTag(props: MultiSelectTagProps) {
  const id = `multi-select-tag-${createUniqueId()}`;
  const anchor = `--anchor-${++counter}`;

  const [isOpen, setIsOpen] = createSignal(false);

  const selectedTags = () => props.tags.filter((t) => props.selectedIds.includes(t.id));

  return (
    <div class="relative">
      {/* Trigger */}
      <button
        type="button"
        class="border-base-300 bg-base-100 hover:bg-base-200 flex min-h-12 w-full cursor-pointer items-center rounded-lg border px-3 py-2 text-left transition-colors"
        classList={{ 'ring-primary/50 ring-2': isOpen() }}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        aria-controls={id}
        popovertarget={id}
        style={{ 'anchor-name': anchor }}
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
      </button>

      {/* Popover Dropdown - renders in top-layer, positioned via CSS anchor */}
      <div
        id={id}
        popover="auto"
        class="border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
        style={{
          'position-anchor': anchor,
          'position-area': 'bottom span-right',
          width: `anchor-size(width)`,
        }}
        onToggle={(e) => setIsOpen(e.newState === 'open')}
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
                  'bg-primary/10 hover:bg-primary/15': isSelected(),
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
