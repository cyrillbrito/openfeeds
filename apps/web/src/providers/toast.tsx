import {
  createContext,
  createSignal,
  For,
  onMount,
  Show,
  useContext,
  type ParentComponent,
} from 'solid-js';
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
  toasts: () => Toast[];
  showToast: (
    message: string,
    options?: { variant?: ToastVariant; action?: ToastAction; duration?: number },
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>();

const variantClass: Record<ToastVariant, string> = {
  success: 'alert-success',
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
};

export const ToastProvider: ParentComponent = (props) => {
  const [toasts, setToasts] = createSignal<Toast[]>([]);

  const showToast = (
    message: string,
    options?: { variant?: ToastVariant; action?: ToastAction; duration?: number },
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    const duration = options?.duration ?? 6000; // Default 6 seconds

    const toast: Toast = {
      id,
      message,
      variant: options?.variant ?? 'success',
      action: options?.action,
      duration,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-remove toast after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const value: ToastContextValue = {
    toasts,
    showToast,
    removeToast,
  };

  // Wire up the module-scope toast service so collection handlers can show toasts
  onMount(() => {
    toastService.showToast = showToast;
  });

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      {/* Toast container rendered as part of the provider */}
      <div class="toast toast-end toast-bottom">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={`alert ${variantClass[toast.variant]} flex items-center justify-between shadow-lg`}
            >
              <span>{toast.message}</span>
              <Show when={toast.action}>
                {(action) => (
                  <button
                    class="btn btn-sm btn-ghost"
                    onClick={() => {
                      action().onClick();
                      removeToast(toast.id);
                    }}
                  >
                    {action().label}
                  </button>
                )}
              </Show>
            </div>
          )}
        </For>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
