import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3.5 rounded-2xl shadow-lg border pointer-events-auto animate-slide-in transition-all ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300"
                : t.type === "error"
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle size={16} />}
              {t.type === "error" && <AlertCircle size={16} />}
              {t.type === "info" && <Info size={16} />}
            </div>
            <p className="text-xs font-medium flex-1 leading-normal">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
