import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastProps extends ToastMessage {
  onClose: (id: string) => void;
}

function getToastIcon(type: ToastType) {
  switch (type) {
    case "success":
      return <CheckCircle className="w-5 h-5 text-primary" />;
    case "error":
      return <AlertCircle className="w-5 h-5 text-rose-400" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    case "info":
      return <Info className="w-5 h-5 text-blue-400" />;
  }
}

function getToastStyles(type: ToastType) {
  switch (type) {
    case "success":
      return "bg-teal-900/40 border-teal-500/30 text-teal-100";
    case "error":
      return "bg-rose-900/40 border-rose-500/30 text-rose-100";
    case "warning":
      return "bg-amber-900/40 border-amber-500/30 text-amber-100";
    case "info":
      return "bg-blue-900/40 border-blue-500/30 text-blue-100";
  }
}

export function Toast({ id, message, type, duration = 4000, action, onClose }: ToastProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 100 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={() => {
        if (duration > 0) {
          setTimeout(() => onClose(id), duration);
        }
      }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl ${getToastStyles(type)}`}
    >
      {getToastIcon(type)}
      <div className="flex-1 text-sm font-medium">{message}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs font-semibold underline opacity-80 hover:opacity-100 transition-opacity"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onClose(id)}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
