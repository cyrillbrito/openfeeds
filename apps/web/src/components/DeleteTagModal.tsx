import type { Tag } from '@repo/shared/types';
import { Show } from 'solid-js';
import { tagsCollection } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { TagBadge } from './TagBadge';

interface DeleteTagModalProps {
  controller: (controller: ModalController) => void;
  tag: Tag | null;
  onDeleteComplete?: () => void;
  onClose?: () => void;
}

export function DeleteTagModal(props: DeleteTagModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-md"
      title="Delete Tag"
      onClose={props.onClose}
    >
      <Show when={props.tag}>
        {(tag) => (
          <DeleteTagForm
            tag={tag()}
            onDeleteComplete={props.onDeleteComplete}
            onClose={() => modalController.close()}
          />
        )}
      </Show>
    </LazyModal>
  );
}

interface DeleteTagFormProps {
  tag: Tag;
  onDeleteComplete?: () => void;
  onClose: () => void;
}

function DeleteTagForm(props: DeleteTagFormProps) {
  const handleDeleteConfirm = () => {
    tagsCollection.delete(props.tag.id);
    props.onDeleteComplete?.();
    props.onClose();
  };

  return (
    <>
      <div class="mb-6">
        <p class="mb-4">
          Are you sure you want to delete this tag? This will remove it from all feeds.
        </p>

        <div class="bg-base-200 flex items-center gap-3 rounded-lg p-4">
          <TagBadge name={props.tag.name} color={props.tag.color} />
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()}>
          Cancel
        </button>
        <button type="button" class="btn btn-error" onClick={handleDeleteConfirm}>
          Delete Tag
        </button>
      </div>
    </>
  );
}
