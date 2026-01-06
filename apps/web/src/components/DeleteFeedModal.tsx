import type { Feed } from '@repo/shared/types';
import { deleteFeed } from '~/entities/feeds';
import TriangleAlertIcon from 'lucide-solid/icons/triangle-alert';
import { Show } from 'solid-js';
import { LazyModal, type ModalController } from './LazyModal';

interface DeleteFeedModalProps {
  controller: (controller: ModalController) => void;
  feed: Feed | null;
  onDeleteComplete?: () => void;
}

export function DeleteFeedModal(props: DeleteFeedModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-md"
      title="Delete Feed"
    >
      <Show when={props.feed}>
        {(feed) => (
          <DeleteFeedForm
            feed={feed()}
            onDeleteComplete={props.onDeleteComplete}
            onClose={() => modalController.close()}
          />
        )}
      </Show>
    </LazyModal>
  );
}

interface DeleteFeedFormProps {
  feed: Feed;
  onDeleteComplete?: () => void;
  onClose: () => void;
}

function DeleteFeedForm(props: DeleteFeedFormProps) {
  const handleDeleteConfirm = () => {
    deleteFeed(props.feed.id);
    props.onDeleteComplete?.();
    props.onClose();
  };

  return (
    <>
      <div class="mb-6">
        <p class="mb-4">Are you sure you want to delete this feed? This action cannot be undone.</p>

        <div class="bg-base-200 rounded-lg p-4">
          <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Feed to delete:</h4>
          <p class="font-medium">{props.feed.title}</p>
          <p class="text-base-content-gray mt-1 text-sm">{props.feed.url}</p>
        </div>

        <div class="alert alert-warning mt-4">
          <TriangleAlertIcon size={20} />
          <span class="text-sm">All articles from this feed will also be deleted.</span>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()}>
          Cancel
        </button>
        <button type="button" class="btn btn-error" onClick={handleDeleteConfirm}>
          Delete Feed
        </button>
      </div>
    </>
  );
}
