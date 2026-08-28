"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * "•••" AMALLAR MENYUSI.
 *
 * Nega menyu, nega qatorda emas: qatorda turgan "Parol tiklash / Login
 * tiklash / Nofaollashtirish / O'chirish" to'plami ikki muammo tug'diradi —
 * qator o'qilmaydigan darajada band bo'ladi, va "O'chirish" tugmasi barmoq
 * ostida, tasodifan bosiladigan joyda turadi. Menyu ichida esa xavfli amal
 * ATAYLAB izlab topiladi.
 */

export interface MenuAmali {
  label: string;
  onClick: () => void;
  /** `xavf` — pastda, qizil, ajratuvchi chiziq ustida. */
  tur?: "oddiy" | "xavf";
  /** Ruxsat yo'q yoki mantiqan mumkin emas — sabab bilan o'chirilgan. */
  ochirilgan?: string;
}

export function AmalMenu({ amallar, label }: { amallar: MenuAmali[]; label: string }) {
  const [ochiq, setOchiq] = useState(false);
  const orash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ochiq) return;
    const tashqariBosildi = (e: MouseEvent) => {
      if (!orash.current?.contains(e.target as Node)) setOchiq(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOchiq(false);
    };
    document.addEventListener("mousedown", tashqariBosildi);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", tashqariBosildi);
      document.removeEventListener("keydown", esc);
    };
  }, [ochiq]);

  const oddiy = amallar.filter((a) => a.tur !== "xavf");
  const xavfli = amallar.filter((a) => a.tur === "xavf");

  return (
    <div ref={orash} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={`${label} — amallar`}
        aria-haspopup="menu"
        aria-expanded={ochiq}
        onClick={(e) => {
          // Qator bosilishi (tafsilot ochish) bilan chalkashmasin.
          e.stopPropagation();
          setOchiq((v) => !v);
        }}
        className="w-11 h-11 lg:w-9 lg:h-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <MoreHorizontal size={18} />
      </button>

      {ochiq && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-line bg-surface shadow-xl py-1 animate-fade-in"
        >
          {[...oddiy, ...xavfli].map((a, i) => (
            <div key={a.label}>
              {a.tur === "xavf" && i > 0 && <div className="my-1 border-t border-line" />}
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(a.ochirilgan)}
                title={a.ochirilgan}
                onClick={() => {
                  setOchiq(false);
                  a.onClick();
                }}
                className={cn(
                  "w-full text-left px-3 min-h-[44px] text-sm transition",
                  a.ochirilgan
                    ? "text-faint cursor-not-allowed"
                    : a.tur === "xavf"
                      ? "text-expense hover:bg-expense-soft"
                      : "text-fg hover:bg-surface-2"
                )}
              >
                {a.label}
                {a.ochirilgan && <span className="block text-2xs text-faint">{a.ochirilgan}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
