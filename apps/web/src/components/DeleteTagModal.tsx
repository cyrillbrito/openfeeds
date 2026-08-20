import type { Tag } from '@repo/domain/client';
import { useRef } from 'react';
import { tagsCollection } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { TagBadge } from './TagBadge';

interface DeleteTagModalProps {
  controller: (controller: ModalController) => void;
  tag: Tag | null;
  onDeleteComplete?: () => void;
  onClose?: () => void;
}

export function DeleteTagModal({ controller, tag, onDeleteComplete, onClose }: DeleteTagModalProps) {
  const modalRef = useRef<ModalController>(null!);

  return (
    <LazyModal
      controller={(ctrl) => {
        modalRef.current = ctrl;
        controller(ctrl);
      }}
      className="max-w-md"
      title="Delete Tag"
      onClose={onClose}
    >
      {tag && (
        <DeleteTagForm
          tag={tag}
          onDeleteComplete={onDeleteComplete}
          onClose={() => modalRef.current.close()}
        />
      )}
    </LazyModal>
  );
}

interface DeleteTagFormProps {
  tag: Tag;
  onDeleteComplete?: () => void;
  onClose: () => void;
}

function DeleteTagForm({ tag, onDeleteComplete, onClose }: DeleteTagFormProps) {
  const handleDeleteConfirm = () => {
    tagsCollection.delete(tag.id);
    onDeleteComplete?.();
    onClose();
  };

  return (
    <>
      <div className="mb-6">
        <p className="mb-4">
          Are you sure you want to delete this tag? This will remove it from all feeds.
        </p>

        <div className="bg-base-200 flex items-center gap-3 rounded-lg p-4">
          <TagBadge name={tag.name} color={tag.color} />
        </div>
      </div>

      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-error" onClick={handleDeleteConfirm}>
          Delete Tag
        </button>
      </div>
    </>
  );
}
