import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import type { ToastMessage, ToastType } from "../components/ui/Toast";

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const generateId = () => `toast-${Date.now()}-${Math.random()}`;

  const addToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 4000) => {
      const id = generateId();
      const toast: ToastMessage = { id, message, type, duration };
      setToasts((prev) => [...prev, toast]);
      return id;
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number) => addToast(message, "success", duration),
    [addToast],
  );

  const showError = useCallback(
    (message: string, duration?: number) => addToast(message, "error", duration),
    [addToast],
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => addToast(message, "warning", duration),
    [addToast],
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => addToast(message, "info", duration),
    [addToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
