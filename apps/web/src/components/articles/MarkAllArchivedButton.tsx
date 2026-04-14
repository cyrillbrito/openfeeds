import { TriangleAlert } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { LazyModal, type ModalController } from '~/components/LazyModal';

// NOTE: The trigger renders a plain <button> (no btn classes) so it works
// as a daisyUI menu item when placed inside <li> within a <Dropdown>.
// The modal is portalled to document.body so it isn't destroyed when
// the dropdown popover closes.

interface MarkAllArchivedButtonProps {
  totalCount?: number;
  contextLabel?: string; // e.g., "in this feed", "in this tag", "globally"
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}

export function MarkAllArchivedButton(props: MarkAllArchivedButtonProps) {
  let modalController!: ModalController;

  return (
    <>
      <button type="button" onClick={() => modalController.open()} disabled={props.disabled}>
        Mark All Archived
      </button>
      <Portal>
        <LazyModal
          controller={(controller) => (modalController = controller)}
          class="max-w-md"
          title="Mark All as Archived"
        >
          <MarkAllArchivedConfirmation {...props} onClose={() => modalController.close()} />
        </LazyModal>
      </Portal>
    </>
  );
}

interface MarkAllArchivedConfirmationProps extends MarkAllArchivedButtonProps {
  onClose: () => void;
}

function MarkAllArchivedConfirmation(props: MarkAllArchivedConfirmationProps) {
  const [isProcessing, setIsProcessing] = createSignal(false);

  const handleConfirmMarkArchived = async () => {
    try {
      setIsProcessing(true);
      await props.onConfirm();
      props.onClose();
    } catch (err) {
      console.error('Mark many archived failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div class="mb-6">
        <p class="mb-4">
          Are you sure you want to mark all unarchived articles as archived{' '}
          {props.contextLabel || ''}? This action cannot be undone.
        </p>

        <Show when={props.totalCount && props.totalCount > 0}>
          <div class="bg-base-200 rounded-lg p-4">
            <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
            <p class="font-medium">
              {props.totalCount} unarchived article{props.totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        </Show>

        <div class="alert alert-info mt-4">
          <TriangleAlert size={20} />
          <span class="text-sm">Archived articles will no longer appear in your inbox.</span>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()} disabled={isProcessing()}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onClick={handleConfirmMarkArchived}
          disabled={isProcessing()}
        >
          {isProcessing() && <span class="loading loading-spinner loading-sm"></span>}
          {isProcessing() ? 'Archiving...' : 'Mark All Archived'}
        </button>
      </div>
    </>
  );
}
