import { TriangleAlert } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
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
  const modalRef = useRef<ModalController>(null!);

  return (
    <>
      <button type="button" onClick={() => modalRef.current.open()} disabled={props.disabled}>
        Mark All Archived
      </button>
      {createPortal(
        <LazyModal
          controller={(ctrl) => { modalRef.current = ctrl; }}
          className="max-w-md"
          title="Mark All as Archived"
        >
          <MarkAllArchivedConfirmation {...props} onClose={() => modalRef.current.close()} />
        </LazyModal>,
        document.body,
      )}
    </>
  );
}

interface MarkAllArchivedConfirmationProps extends MarkAllArchivedButtonProps {
  onClose: () => void;
}

function MarkAllArchivedConfirmation({
  totalCount,
  contextLabel,
  onConfirm,
  onClose,
}: MarkAllArchivedConfirmationProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirmMarkArchived = async () => {
    try {
      setIsProcessing(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Mark many archived failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <p className="mb-4">
          Are you sure you want to mark all unarchived articles as archived{' '}
          {contextLabel || ''}? This action cannot be undone.
        </p>

        {totalCount && totalCount > 0 && (
          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
            <p className="font-medium">
              {totalCount} unarchived article{totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div className="alert alert-info mt-4">
          <TriangleAlert size={20} />
          <span className="text-sm">Archived articles will no longer appear in your inbox.</span>
        </div>
      </div>

      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose} disabled={isProcessing}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirmMarkArchived}
          disabled={isProcessing}
        >
          {isProcessing && <span className="loading loading-spinner loading-sm"></span>}
          {isProcessing ? 'Archiving...' : 'Mark All Archived'}
        </button>
      </div>
    </>
  );
}
