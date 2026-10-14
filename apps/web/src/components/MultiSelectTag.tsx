import type { Tag } from '@repo/domain/client';
import { Check, ChevronDown, Search, Tag as TagIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';
import { TagBadge } from './TagBadge';

interface MultiSelectTagProps {
  tags: Tag[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function MultiSelectTag({ tags, selectedIds, onSelectionChange }: MultiSelectTagProps) {
  const uid = useId();
  const id = `multi-select-tag-${uid}`;
  const anchor = `--multi-select-tag-${uid}`;

  const [isOpen, setIsOpen] = useState(false);

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        className={`border-base-300 bg-base-100 hover:bg-base-200 flex min-h-12 w-full cursor-pointer items-center rounded-lg border px-3 py-2 text-left transition-colors${isOpen ? ' ring-primary/50 ring-2' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={id}
        popoverTarget={id}
        style={{ anchorName: anchor } as React.CSSProperties}
      >
        {selectedTags.length > 0 ? (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
          </div>
        ) : (
          <div className="text-base-content/40 flex flex-1 items-center gap-2">
            <TagIcon size={14} />
            <span className="text-sm">Select tags...</span>
          </div>
        )}
        <ChevronDown
          size={16}
          className={`text-base-content/40 ml-2 shrink-0 transition-transform${isOpen ? ' rotate-180' : ''}`}
        />
      </button>

      {/* Popover Dropdown - renders in top-layer, positioned via CSS anchor */}
      <div
        id={id}
        popover="auto"
        className="border-base-300 bg-base-100 m-0 rounded-lg border p-0 shadow-lg"
        style={
          {
            positionAnchor: anchor,
            positionArea: 'bottom span-right',
            width: 'anchor-size(width)',
          } as React.CSSProperties
        }
        onToggle={(e) => setIsOpen(e.newState === 'open')}
      >
        <MultiSelectTagDropdown
          tags={tags}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
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

function MultiSelectTagDropdown({ tags, selectedIds, onSelectionChange }: MultiSelectTagDropdownProps) {
  const showSearch = tags.length > 5;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggle = (tagId: string) => {
    const isSelected = selectedIds.includes(tagId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    onSelectionChange(newIds);
  };

  return (
    <>
      {/* Search Input */}
      {showSearch && (
        <>
          <label className="input input-ghost outline-none!">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search tags..."
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </label>
          <div className="bg-base-300 h-px w-full"></div>
        </>
      )}

      {/* Tag List */}
      <div role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto p-1">
        {filteredTags.length === 0 ? (
          <div className="text-base-content/60 py-4 text-center text-sm">No tags found</div>
        ) : (
          filteredTags.map((tag) => {
            const isSelected = selectedIds.includes(tag.id);
            return (
              <div
                key={tag.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={`focus:ring-primary/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none focus:ring-2${isSelected ? ' bg-primary/10 hover:bg-primary/15' : ' hover:bg-base-200 focus:bg-base-200'}`}
                onClick={() => toggle(tag.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(tag.id);
                  }
                }}
              >
                <div className="flex w-5 items-center justify-center">
                  {isSelected && <Check size={16} className="text-primary" />}
                </div>
                <ColorIndicator className={getTagDotColor(tag.color)} />
                <div className="flex-1 text-sm">{tag.name}</div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
