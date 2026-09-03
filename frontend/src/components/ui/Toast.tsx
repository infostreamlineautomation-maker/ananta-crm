"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import clsx from "clsx";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"]) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const success = useCallback((message: string) => push(message, "success"), [push]);
  const error = useCallback((message: string) => push(message, "error"), [push]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[13.5px] font-semibold shadow-[var(--shadow-pop)]",
              t.tone === "success" ? "border-success-500/20 bg-white text-success-700" : "border-primary-100 bg-white text-primary-600",
            )}
          >
            {t.tone === "success" ? <CheckCircle2 className="h-4 w-4 flex-none" /> : <TriangleAlert className="h-4 w-4 flex-none" />}
            {t.message}
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 text-ink-faint hover:text-ink-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
