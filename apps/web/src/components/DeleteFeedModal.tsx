import type { Feed } from '@repo/domain/client';
import { feedsCollection } from '~/entities/feeds';
import { LazyModal, type ModalController } from './LazyModal';

interface DeleteFeedModalProps {
  controller: (controller: ModalController) => void;
  feeds: Feed[];
  onDeleteComplete?: () => void;
}

export function DeleteFeedModal(props: DeleteFeedModalProps) {
  let modalController!: ModalController;

  const count = () => props.feeds.length;

  const handleConfirm = () => {
    feedsCollection.delete(props.feeds.map((f) => f.id));
    props.onDeleteComplete?.();
    modalController.close();
  };

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-sm"
      title={count() === 1 ? 'Unfollow Feed' : 'Unfollow Feeds'}
    >
      <p class="text-base-content/70 text-sm">
        Unfollow{' '}
        <span class="text-base-content font-medium">
          {count() === 1 ? props.feeds[0]?.title : `${count()} feeds`}
        </span>
        ? All {count() === 1 ? 'its' : 'their'} articles will also be removed.
      </p>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost btn-sm" onClick={() => modalController.close()}>
          Cancel
        </button>
        <button type="button" class="btn btn-error btn-sm" onClick={handleConfirm}>
          Unfollow
        </button>
      </div>
    </LazyModal>
  );
}
