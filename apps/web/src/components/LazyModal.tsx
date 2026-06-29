import { posthog } from 'posthog-js';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { twMerge } from 'tailwind-merge';

export interface ModalController {
  open: () => void;
  close: () => void;
}

interface LazyModalProps {
  controller: (controller: ModalController) => void;
  className?: string;
  title: string;
  children: ReactNode;
  disableBackdropClose?: boolean;
  onClose?: () => void;
}

export function LazyModal({
  controller,
  className,
  title,
  children,
  disableBackdropClose,
  onClose,
}: LazyModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const updateViewportHeight = () => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    dialogRef.current?.style.setProperty('--modal-vh', `${vh}px`);
  };

  const openModal = () => {
    setIsOpen(true);
    dialogRef.current?.showModal();
    document.body.style.setProperty('touch-action', 'none');
    document.body.style.setProperty('overflow', 'hidden');
    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  controller({ open: openModal, close: closeModal });

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (!disableBackdropClose && event.target === dialogRef.current) {
      closeModal();
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      if (disableBackdropClose) {
        event.preventDefault();
      }
    };

    const handleClose = () => {
      setIsOpen(false);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      document.body.style.removeProperty('touch-action');
      document.body.style.removeProperty('overflow');
      onClose?.();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      document.body.style.removeProperty('touch-action');
      document.body.style.removeProperty('overflow');
    };
  }, [disableBackdropClose, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <div
        className={twMerge('modal-box border-base-300 border shadow-sm', className)}
        style={{ maxHeight: 'min(var(--modal-vh, 100dvh), 90dvh)' }}
      >
        <h3 className="mb-4 text-lg font-bold">{title}</h3>
        <ErrorBoundary
          fallbackRender={({ error }) => {
            posthog.captureException(error);
            return (
              <div className="alert alert-error">
                <span>Something went wrong: {error.toString()}</span>
              </div>
            );
          }}
        >
          <Suspense
            fallback={
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            }
          >
            {isOpen && children}
          </Suspense>
        </ErrorBoundary>
      </div>
    </dialog>
  );
}
