import type { MarkManyReadRequest } from '@repo/shared/types';
import TriangleAlertIcon from 'lucide-solid/icons/triangle-alert';
import { createSignal, Show } from 'solid-js';
import { useMarkManyRead } from '../hooks/queries';
import { LazyModal, type ModalController } from './LazyModal';

interface MarkAllReadButtonProps {
  context: MarkManyReadRequest['context'];
  feedId?: number;
  tagId?: number;
  totalCount?: number;
  contextLabel?: string; // e.g., "in this feed", "in this tag", "globally"
  disabled?: boolean;
}

export function MarkAllReadButton(props: MarkAllReadButtonProps) {
  let modalController!: ModalController;

  return (
    <>
      <MarkAllReadButtonTrigger {...props} onOpenModal={() => modalController.open()} />
      <LazyModal
        controller={(controller) => (modalController = controller)}
        class="max-w-md"
        title="Mark All as Read"
      >
        <MarkAllReadConfirmation {...props} onClose={() => modalController.close()} />
      </LazyModal>
    </>
  );
}

interface MarkAllReadButtonTriggerProps extends MarkAllReadButtonProps {
  onOpenModal: () => void;
}

function MarkAllReadButtonTrigger(props: MarkAllReadButtonTriggerProps) {
  const [isProcessing] = createSignal(false);

  const getButtonText = () => {
    const count = props.totalCount;
    if (count && count > 0) {
      return `Mark All Read (${count})`;
    }
    return 'Mark All Read';
  };

  return (
    <button
      type="button"
      class="btn btn-outline btn-sm"
      onClick={() => props.onOpenModal()}
      disabled={props.disabled || isProcessing()}
    >
      <Show when={isProcessing()} fallback={getButtonText()}>
        <span class="loading loading-spinner loading-sm"></span>
        Processing...
      </Show>
    </button>
  );
}

interface MarkAllReadConfirmationProps extends MarkAllReadButtonProps {
  onClose: () => void;
}

function MarkAllReadConfirmation(props: MarkAllReadConfirmationProps) {
  console.log(`🎯 MarkAllReadConfirmation: FRESH component created! Timestamp: ${Date.now()}`);

  const markManyReadMutation = useMarkManyRead();
  const [isProcessing, setIsProcessing] = createSignal(false);

  const getContextLabel = () => {
    if (props.contextLabel) return props.contextLabel;

    switch (props.context) {
      case 'all':
        return 'globally';
      case 'feed':
        return 'in this feed';
      case 'tag':
        return 'in this tag';
      default:
        return '';
    }
  };

  const handleConfirmMarkRead = async () => {
    try {
      setIsProcessing(true);

      const request: MarkManyReadRequest = {
        context: props.context,
        ...(props.feedId && { feedId: props.feedId }),
        ...(props.tagId && { tagId: props.tagId }),
      };

      await markManyReadMutation.mutateAsync(request);
      props.onClose();
    } catch (err) {
      console.error('Mark many read failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div class="mb-6">
        <p class="mb-4">
          Are you sure you want to mark all unread articles as read {getContextLabel()}? This action
          cannot be undone.
        </p>

        <Show when={props.totalCount && props.totalCount > 0}>
          <div class="bg-base-200 rounded-lg p-4">
            <h4 class="text-base-content-gray mb-1 text-sm font-semibold">Articles to mark:</h4>
            <p class="font-medium">
              {props.totalCount} unread article{props.totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        </Show>

        <div class="alert alert-info mt-4">
          <TriangleAlertIcon size={20} />
          <span class="text-sm">Marked articles will no longer appear in your unread lists.</span>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()} disabled={isProcessing()}>
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onClick={handleConfirmMarkRead}
          disabled={isProcessing()}
        >
          {isProcessing() && <span class="loading loading-spinner loading-sm"></span>}
          {isProcessing() ? 'Marking as Read...' : 'Mark All Read'}
        </button>
      </div>
    </>
  );
}
