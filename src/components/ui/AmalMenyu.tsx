"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * "•••" AMALLAR MENYUSI.
 *
 * Nega kerak: qatorda 6 ta yonma-yon amal turganda foydalanuvchi ularni
 * o'qimaydi — nigoh sirg'alib ketadi va eng xavflisi ("O'chirish") eng
 * kerakligi ("Ochish") bilan bir xil ko'rinadi. Shu bois asosiy amal
 * qatorda qoladi, qolgani shu menyuga yig'iladi va xavfli amallar ajratuvchi
 * chiziqdan KEYIN, alohida rangda turadi.
 *
 * Bosish zonasi 44px — barmoq bilan aniq tegish uchun (mobil talab).
 */
export interface MenyuAmali {
  label: string;
  onClick?: () => void;
  href?: string;
  /** `xavf` — qaytarib bo'lmaydigan amal (o'chirish/tozalash). */
  tur?: "oddiy" | "xavf";
  /** Ajratuvchi chiziq shu amaldan OLDIN chiziladi. */
  ajrat?: boolean;
  disabled?: boolean;
}

export function AmalMenyu({
  amallar,
  label = "Boshqa amallar",
  className = "",
}: {
  amallar: MenyuAmali[];
  label?: string;
  className?: string;
}) {
  const [ochiq, setOchiq] = useState(false);
  const orash = useRef<HTMLDivElement>(null);
  const menyuId = useId();

  useEffect(() => {
    if (!ochiq) return;
    function tashqariBosish(e: MouseEvent) {
      if (!orash.current?.contains(e.target as Node)) setOchiq(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOchiq(false);
    }
    document.addEventListener("mousedown", tashqariBosish);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", tashqariBosish);
      document.removeEventListener("keydown", esc);
    };
  }, [ochiq]);

  if (amallar.length === 0) return null;

  return (
    <div ref={orash} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ochiq}
        aria-controls={ochiq ? menyuId : undefined}
        aria-label={label}
        onClick={() => setOchiq((v) => !v)}
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span aria-hidden className="text-lg leading-none tracking-widest">
          •••
        </span>
      </button>

      {ochiq && (
        <div
          id={menyuId}
          role="menu"
          className="absolute right-0 z-30 mt-1 w-60 rounded-2xl border border-line bg-surface shadow-lg p-1.5"
        >
          {amallar.map((a) => {
            const uslub = cn(
              "w-full text-left px-3 min-h-[44px] flex items-center rounded-xl text-sm transition",
              a.disabled
                ? "text-faint cursor-not-allowed"
                : a.tur === "xavf"
                  ? "text-expense hover:bg-expense-soft"
                  : "text-fg hover:bg-surface-2"
            );
            return (
              <div key={a.label}>
                {a.ajrat && <div className="my-1.5 border-t border-line" />}
                {a.href && !a.disabled ? (
                  <a href={a.href} role="menuitem" className={uslub} onClick={() => setOchiq(false)}>
                    {a.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={a.disabled}
                    className={uslub}
                    onClick={() => {
                      setOchiq(false);
                      a.onClick?.();
                    }}
                  >
                    {a.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
