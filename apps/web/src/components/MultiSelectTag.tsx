import type { Tag } from '@repo/shared/types';
import { autofocus } from '@solid-primitives/autofocus';
import SearchIcon from 'lucide-solid/icons/search';
import { createSignal, For, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getTagDotColor } from '../utils/tagColors';
import { ColorIndicator } from './ColorIndicator';

// prevents from being tree-shaken by TS
void autofocus;

interface MultiSelectTagProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelectTag(props: MultiSelectTagProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [triggerEl, setTriggerEl] = createSignal<HTMLElement>();
  const [dropdownStyle, setDropdownStyle] = createSignal<JSX.CSSProperties>({});

  const [selectedIds, setSelectedIds] = createSignal(props.selectedIds);

  const selectedTags = () => props.tags.filter((t) => selectedIds().includes(t.id));

  return (
    <>
      <div
        ref={setTriggerEl}
        class="select flex cursor-pointer items-center overflow-hidden"
        tabIndex="0"
        onClick={() => {
          setIsOpen(!isOpen());
          const bounds = triggerEl()!.getBoundingClientRect();
          setDropdownStyle({
            top: `${bounds.bottom}px`,
            left: `${bounds.left + 2}px`,
            width: `${bounds.width - 4}px`,
          });
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

      {/* Dropdown */}
      <Show when={isOpen()}>
        <Portal>
          <MultiSelectTagDropdown
            tags={props.tags}
            selectedIds={props.selectedIds}
            onSelectionChange={(ids) => {
              setSelectedIds(ids);
              props.onSelectionChange(ids);
            }}
            onClose={() => {
              setIsOpen(false);
            }}
            style={dropdownStyle()}
          />
        </Portal>
      </Show>
    </>
  );
}

interface MultiSelectTagDropdownProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onClose: () => void;

  // x: number;
  // y: number;
  // width: number;
  style: JSX.CSSProperties;
}

function MultiSelectTagDropdown(props: MultiSelectTagDropdownProps) {
  const showSearch = () => props.tags.length > 5;

  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal(props.selectedIds);

  const filteredTags = () => {
    const query = searchQuery().toLowerCase();
    return props.tags.filter((tag) => tag.name.toLowerCase().includes(query));
  };

  const toggle = (isSelected: boolean, tagId: string) => {
    setSelectedIds((prev) => {
      if (isSelected) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });

    props.onSelectionChange(selectedIds());
  };

  return (
    <>
      <div class="fixed inset-0 z-30" onClick={() => props.onClose()}></div>
      <div
        class="dropdown-content border-base-300 bg-base-100 fixed z-30 mt-1 rounded-lg border shadow-lg"
        style={props.style}
      >
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
        <div class="max-h-60 space-y-1 overflow-y-auto py-2">
          <For
            each={filteredTags()}
            fallback={
              <div class="text-base-content/60 py-4 text-center text-sm">No tags found</div>
            }
          >
            {(tag) => {
              const isSelected = () => props.selectedIds.includes(tag.id);

              return (
                <div
                  class="hover:bg-base-200 m-1 flex cursor-pointer items-center gap-2 rounded p-2"
                  onClick={() => {
                    toggle(isSelected(), tag.id);
                    props.onClose();
                  }}
                >
                  {/* Checkbox area - visible on hover or when selected */}
                  <div
                    class="flex w-8 items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(isSelected(), tag.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      class={`checkbox checkbox-primary checkbox-sm transition-opacity`}
                      checked={isSelected()}
                    />
                  </div>

                  <ColorIndicator class={getTagDotColor(tag.color)} />
                  <div class="flex-1">{tag.name}</div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </>
  );
}
