"use client";

import { useEffect } from "react";

/**
 * Desktop'da markazdagi dialog, mobil'da pastki sheet (bottom sheet).
 * ESC va backdrop bosilganda yopiladi; ochilganda body scroll bloklanadi.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface text-fg w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl p-6 pb-safe max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-fade-in"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="text-faint hover:text-fg text-2xl leading-none w-9 h-9 flex items-center justify-center -mr-2 rounded-lg hover:bg-surface-2"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
