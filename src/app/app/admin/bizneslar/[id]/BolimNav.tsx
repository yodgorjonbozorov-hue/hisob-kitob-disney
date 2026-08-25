"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { BOLIMLAR, type Bolim } from "./bolimlar";

/**
 * BO'LIMLAR NAVIGATSIYASI.
 *
 * Desktop — gorizontal tab qatori. Mobil — navigatsiya KARTOCHKALARI: 6 ta
 * tab 375px ekranda o'qib bo'lmaydigan darajaga siqiladi, shuning uchun
 * telefonda avval ro'yxat ko'rinadi, bo'lim tanlangach esa uning ichi
 * ("‹ Bo'limlar" bilan ortga qaytiladi).
 */
export function DesktopTablar({
  faol,
  korinadigan,
  onTanla,
}: {
  faol: Bolim;
  korinadigan: typeof BOLIMLAR;
  onTanla: (b: Bolim) => void;
}) {
  return (
    <div className="hidden lg:flex items-center gap-1 border-b border-line" role="tablist">
      {korinadigan.map((b) => (
        <button
          key={b.kod}
          type="button"
          role="tab"
          aria-selected={faol === b.kod}
          onClick={() => onTanla(b.kod)}
          className={cn(
            "px-3 h-10 text-sm font-medium border-b-2 -mb-px transition",
            faol === b.kod
              ? "border-brand text-fg"
              : "border-transparent text-muted hover:text-fg",
            b.kod === "xavfsizlik" && faol !== b.kod && "text-expense/80 hover:text-expense"
          )}
        >
          {b.nomi}
        </button>
      ))}
    </div>
  );
}

export function MobilRoyxat({
  korinadigan,
  onTanla,
}: {
  korinadigan: typeof BOLIMLAR;
  onTanla: (b: Bolim) => void;
}) {
  return (
    <ul className="lg:hidden list-none space-y-2">
      {korinadigan.map((b) => (
        <li key={b.kod}>
          <button
            type="button"
            onClick={() => onTanla(b.kod)}
            className={cn(
              "w-full flex items-center justify-between gap-3 text-left rounded-2xl border p-4 min-h-[44px] transition active:scale-[0.99]",
              b.kod === "xavfsizlik"
                ? "border-expense/40 bg-expense-soft/40"
                : "border-line bg-surface"
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">{b.nomi}</span>
              <span className="block text-xs text-muted mt-0.5">{b.tavsif}</span>
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MobilOrqaga({ nomi, onOrqaga }: { nomi: string; onOrqaga: () => void }) {
  return (
    <button
      type="button"
      onClick={onOrqaga}
      className="lg:hidden inline-flex items-center gap-1 min-h-[44px] text-sm text-muted hover:text-fg transition"
    >
      <ChevronLeft size={16} aria-hidden />
      Bo&apos;limlar
      <span className="text-faint">· {nomi}</span>
    </button>
  );
}
