import type { Tag, TagColor } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { CircleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tagsCollection, useTags } from '~/entities/tags';
import { availableTagColors, getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';
import { LazyModal, type ModalController } from './LazyModal';

interface TagModalProps {
  controller: (controller: ModalController) => void;
  editTag?: Tag | null;
  onEditComplete?: () => void;
}

export function TagModal({ controller, editTag, onEditComplete }: TagModalProps) {
  const modalRef = useRef<ModalController>(null!);
  const isEditMode = !!editTag;

  return (
    <LazyModal
      controller={(ctrl) => {
        modalRef.current = ctrl;
        controller(ctrl);
      }}
      className="max-w-md"
      title={isEditMode ? 'Edit Tag' : 'Create New Tag'}
    >
      <TagForm
        editTag={editTag}
        onEditComplete={onEditComplete}
        onClose={() => modalRef.current.close()}
      />
    </LazyModal>
  );
}

interface TagFormProps {
  editTag?: Tag | null;
  onEditComplete?: () => void;
  onClose: () => void;
}

function TagForm({ editTag, onEditComplete, onClose }: TagFormProps) {
  const isEditMode = !!editTag;
  const tags = useTags();

  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState<TagColor>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form when editTag changes
  useEffect(() => {
    if (editTag) {
      setTagName(editTag.name);
      setTagColor(editTag.color);
    } else {
      setTagName('');
      setTagColor(null);
    }
    setError(null);
  }, [editTag]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = tagName.trim();

    if (!name) {
      setError('Tag name is required');
      return;
    }

    setError(null);

    if (isEditMode) {
      tagsCollection.update(editTag!.id, (draft) => {
        draft.name = name;
        draft.color = tagColor;
      });
      onEditComplete?.();
    } else {
      const now = new Date().toISOString();
      const maxOrder = tags.length > 0 ? Math.max(-1, ...tags.map((t) => t.order)) : -1;
      tagsCollection.insert({
        id: createId(),
        userId: '',
        name,
        color: tagColor,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    setTagName('');
    setTagColor(null);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-control mb-4 w-full">
        <label className="label">
          <span className="label-text">Tag Name</span>
        </label>
        <input
          type="text"
          placeholder="Enter tag name"
          className="input input-bordered w-full"
          value={tagName}
          onChange={(e) => setTagName(e.currentTarget.value)}
          required
        />
      </div>

      <div className="form-control mb-4 w-full">
        <label className="label">
          <span className="label-text">Tag Color</span>
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`badge badge-md sm:badge-lg border-base-300 cursor-pointer gap-1.5 border px-3 py-2 transition-all sm:gap-2 sm:px-4 sm:py-3 ${
              tagColor === null ? 'ring-primary ring-2' : 'hover:ring-base-content/20 hover:ring-1'
            }`}
            onClick={() => setTagColor(null)}
            title="Default (gray)"
          >
            <ColorIndicator className={getTagDotColor(null)} />
            <span className="text-xs sm:text-sm">Default</span>
          </button>
          {availableTagColors.map((colorOption) => (
            <button
              key={colorOption}
              type="button"
              className={`badge badge-md sm:badge-lg border-base-300 cursor-pointer gap-1.5 border px-3 py-2 transition-all sm:gap-2 sm:px-4 sm:py-3 ${
                tagColor === colorOption
                  ? 'ring-primary ring-2'
                  : 'hover:ring-base-content/20 hover:ring-1'
              }`}
              onClick={() => setTagColor(colorOption)}
              title={colorOption}
            >
              <ColorIndicator className={getTagDotColor(colorOption)} />
              <span className="text-xs capitalize sm:text-sm">{colorOption}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <CircleAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditMode ? 'Update Tag' : 'Create Tag'}
        </button>
      </div>
    </form>
  );
}
