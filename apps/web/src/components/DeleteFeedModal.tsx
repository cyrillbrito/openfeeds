import type { Feed } from '@repo/domain/client';
import { useRef } from 'react';
import { feedsCollection } from '~/entities/feeds';
import { LazyModal, type ModalController } from './LazyModal';

interface DeleteFeedModalProps {
  controller: (controller: ModalController) => void;
  feeds: Feed[];
  onDeleteComplete?: () => void;
}

export function DeleteFeedModal({ controller, feeds, onDeleteComplete }: DeleteFeedModalProps) {
  const modalRef = useRef<ModalController>(null!);

  const count = feeds.length;

  const handleConfirm = () => {
    feedsCollection.delete(feeds.map((f) => f.id));
    onDeleteComplete?.();
    modalRef.current.close();
  };

  return (
    <LazyModal
      controller={(ctrl) => {
        modalRef.current = ctrl;
        controller(ctrl);
      }}
      className="max-w-sm"
      title={count === 1 ? 'Unfollow Feed' : 'Unfollow Feeds'}
    >
      <p className="text-base-content/70 text-sm">
        Unfollow{' '}
        <span className="text-base-content font-medium">
          {count === 1 ? feeds[0]?.title : `${count} feeds`}
        </span>
        ? All {count === 1 ? 'its' : 'their'} articles will also be removed.
      </p>

      <div className="modal-action">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => modalRef.current.close()}>
          Cancel
        </button>
        <button type="button" className="btn btn-error btn-sm" onClick={handleConfirm}>
          Unfollow
        </button>
      </div>
    </LazyModal>
  );
}
