import type { ToastVariant } from '~/providers/toast';

type ShowToastFn = (
  message: string,
  options?: { variant?: ToastVariant; duration?: number },
) => void;

/**
 * Module-scope toast service.
 * ToastProvider sets `showToast` on mount. Collection handlers call it directly.
 * Works because mutations only fire after the app is mounted.
 */
export const toastService = {
  showToast: null as ShowToastFn | null,

  error(message: string) {
    if (this.showToast) {
      this.showToast(message, { variant: 'error', duration: 8000 });
    } else {
      console.error('[toast-service] showToast not registered yet:', message);
    }
  },
};
