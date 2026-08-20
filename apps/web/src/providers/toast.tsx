import { createContext, use, useCallback, useEffect, useState } from 'react';
import { toastService } from '~/lib/toast-service';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (
    message: string,
    options?: { variant?: ToastVariant; action?: ToastAction; duration?: number },
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantClass: Record<ToastVariant, string> = {
  success: 'alert-success',
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      options?: { variant?: ToastVariant; action?: ToastAction; duration?: number },
    ) => {
      const variant = options?.variant ?? 'success';

      setToasts((prev) => {
        // Skip duplicate: same message + variant already visible
        if (prev.some((t) => t.message === message && t.variant === variant)) return prev;

        const id = Date.now().toString() + Math.random().toString(36).substring(7);
        const duration = options?.duration ?? 6000;
        const toast: Toast = { id, message, variant, action: options?.action, duration };

        setTimeout(() => removeToast(id), duration);
        return [...prev, toast];
      });
    },
    [removeToast],
  );

  useEffect(() => {
    toastService.showToast = showToast;
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="toast toast-end toast-bottom z-50 max-w-md">
        {toasts.slice(-5).map((toast) => (
          <div
            key={toast.id}
            className={`alert ${variantClass[toast.variant]} flex items-center justify-between shadow-lg`}
          >
            <span className="line-clamp-3 break-words">{toast.message}</span>
            {toast.action && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  toast.action!.onClick();
                  removeToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
