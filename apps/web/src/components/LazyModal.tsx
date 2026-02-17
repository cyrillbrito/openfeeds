import posthog from 'posthog-js';
import {
  createEffect,
  createSignal,
  ErrorBoundary,
  onCleanup,
  Show,
  Suspense,
  type JSXElement,
} from 'solid-js';
import { twMerge } from 'tailwind-merge';

export interface ModalController {
  open: () => void;
  close: () => void;
}

interface LazyModalProps {
  controller: (controller: ModalController) => void;
  class?: string;
  title: string;
  children: JSXElement;
  disableBackdropClose?: boolean;
  onClose?: () => void;
}

export function LazyModal(props: LazyModalProps) {
  let dialogRef: HTMLDialogElement | undefined;
  const [isOpen, setIsOpen] = createSignal(false);

  const openModal = () => {
    setIsOpen(true);
    dialogRef?.showModal();
    // iOS Safari: overflow:hidden on :root doesn't reliably prevent scrolling.
    // Lock body scroll explicitly via touch-action + fixed positioning.
    document.body.style.setProperty('touch-action', 'none');
    document.body.style.setProperty('overflow', 'hidden');
  };

  const closeModal = () => {
    dialogRef?.close();
  };

  props.controller({
    open: openModal,
    close: closeModal,
  });

  const handleBackdropClick = (event: MouseEvent) => {
    if (!props.disableBackdropClose && event.target === dialogRef) {
      closeModal();
    }
  };

  // Track visual viewport height to handle mobile keyboard.
  // On iOS Safari, dvh/vh don't shrink when the keyboard opens.
  // VisualViewport.height reflects the actual visible area.
  const updateViewportHeight = () => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    dialogRef?.style.setProperty('--modal-vh', `${vh}px`);
  };

  createEffect(() => {
    const dialog = dialogRef;
    if (dialog) {
      const handleCancel = (event: Event) => {
        if (props.disableBackdropClose) {
          event.preventDefault();
        }
      };

      const handleClose = () => {
        setIsOpen(false); // Destroy the component when dialog closes
        document.body.style.removeProperty('touch-action');
        document.body.style.removeProperty('overflow');
        props.onClose?.();
      };

      dialog.addEventListener('cancel', handleCancel);
      dialog.addEventListener('close', handleClose);

      updateViewportHeight();
      window.visualViewport?.addEventListener('resize', updateViewportHeight);

      onCleanup(() => {
        dialog.removeEventListener('cancel', handleCancel);
        dialog.removeEventListener('close', handleClose);
        window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      });
    }
  });

  return (
    <dialog
      ref={(el) => (dialogRef = el)}
      class="modal"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <div class={twMerge('modal-box border-base-300 border shadow-sm', props.class)}>
        <h3 class="mb-4 text-lg font-bold">{props.title}</h3>
        <ErrorBoundary
          fallback={(err) => {
            posthog.captureException(err);
            return (
              <div class="alert alert-error">
                <span>Something went wrong: {err.toString()}</span>
              </div>
            );
          }}
        >
          <Suspense
            fallback={
              <div class="flex justify-center py-4">
                <span class="loading loading-spinner loading-md"></span>
              </div>
            }
          >
            <Show when={isOpen()}>{props.children}</Show>
          </Suspense>
        </ErrorBoundary>
      </div>
    </dialog>
  );
}
