import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "../cx";
import type { StatusTone } from "./StatusChip";

export type ToastMessage = {
  id: string;
  tone: StatusTone;
  title: string;
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = { push: (toast: Omit<ToastMessage, "id">) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const DOT_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  critical: "bg-critical",
  info: "bg-info",
  unknown: "bg-unknown",
};

/** SRS §10.37. Toasts are announced via `aria-live` and auto-dismiss after 5s but remain keyboard-dismissible. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = (id: string) => setToasts((current) => current.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-toast flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-3 rounded-card border border-neutral-200 bg-white px-4 py-3 shadow-elevated"
          >
            <span
              className={cx("size-2 rounded-full", DOT_TONE_CLASSES[toast.tone])}
              aria-hidden="true"
            />
            <p className="text-body text-neutral-800">{toast.title}</p>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="text-supporting font-medium text-brand-700 hover:underline"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="ml-1 text-neutral-400 hover:text-neutral-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
