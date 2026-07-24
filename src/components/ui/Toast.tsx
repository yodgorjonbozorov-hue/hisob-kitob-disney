"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ToastAction {
  label: string;
  onClick: () => void;
}
type Tone = "success" | "error" | "neutral";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: ToastAction;
}
interface ToastInput {
  message: string;
  tone?: Tone;
  action?: ToastAction;
  duration?: number;
}

const ToastCtx = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast ToastProvider ichida ishlatilishi kerak");
  return c;
}

const toneClass: Record<Tone, string> = {
  success: "border-l-4 border-income",
  error: "border-l-4 border-expense",
  neutral: "border-l-4 border-line",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, tone = "neutral", action, duration = 5000 }: ToastInput) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message, tone, action }]);
      setTimeout(() => remove(id), duration);
    },
    [remove]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-20 lg:bottom-6 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto bg-surface text-fg shadow-lg rounded-xl border border-line ${toneClass[t.tone]} px-4 py-3 flex items-center justify-between gap-3 animate-slide-up`}
          >
            <span className="text-sm">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  remove(t.id);
                }}
                className="text-sm font-semibold text-brand shrink-0 min-h-[36px] px-2"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
