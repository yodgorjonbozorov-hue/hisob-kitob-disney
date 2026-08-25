"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ArrowDownLeft, ArrowUpRight, ClipboardList, HandCoins, CheckSquare } from "lucide-react";
import { QuickAddSheet } from "@/components/nav/QuickAddSheet";

/** Menyudagi bitta amal. `href` bo'lsa sahifaga o'tadi, aks holda oyna ochadi. */
export interface YangiAmal {
  kod: "kirim" | "chiqim" | "buyurtma" | "qarz" | "vazifa";
  label: string;
  href?: string;
}

const IKON = {
  kirim: ArrowDownLeft,
  chiqim: ArrowUpRight,
  buyurtma: ClipboardList,
  qarz: HandCoins,
  vazifa: CheckSquare,
} as const;

/**
 * "+ Yangi" — bosh sahifadagi tez amal tugmasi.
 *
 * Ro'yxatni SERVER beradi (`amallar`): modul yoqilmagan yoki huquq
 * yo'q bo'lsa amal umuman kelmaydi — bu yerda hech qanday tekshiruv
 * takrorlanmaydi (yagona manba serverda).
 *
 * FORMALAR QAYTA YOZILMAYDI:
 *   Kirim/Chiqim — mavjud `QuickAddSheet` (FAB bilan bitta komponent);
 *   Buyurtma/Qarz/Vazifa — o'z sahifasidagi mavjud oyna `?yangi=1` bilan
 *   ochiladi. Ularning formasi propsiz ishlamaydi (kategoriyalar, bosqichlar,
 *   xodimlar), shuning uchun bosh sahifaga ko'chirish o'sha ma'lumotni har
 *   dashboard yuklanishida qayta so'rashni anglatardi.
 */
export function YangiTugma({ amallar }: { amallar: YangiAmal[] }) {
  const [ochiq, setOchiq] = useState(false);
  const [quick, setQuick] = useState<"kirim" | "chiqim" | null>(null);
  const orash = useRef<HTMLDivElement>(null);

  // Tashqariga bosilganda va Esc'da menyu yopiladi.
  useEffect(() => {
    if (!ochiq) return;
    function bosildi(e: MouseEvent) {
      if (orash.current && !orash.current.contains(e.target as Node)) setOchiq(false);
    }
    function tugma(e: KeyboardEvent) {
      if (e.key === "Escape") setOchiq(false);
    }
    document.addEventListener("mousedown", bosildi);
    document.addEventListener("keydown", tugma);
    return () => {
      document.removeEventListener("mousedown", bosildi);
      document.removeEventListener("keydown", tugma);
    };
  }, [ochiq]);

  if (amallar.length === 0) return null;

  return (
    <div className="relative" ref={orash}>
      <button
        type="button"
        onClick={() => setOchiq((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ochiq}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-medium transition hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        Yangi
      </button>

      {ochiq && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-line bg-surface shadow-raised p-1.5 animate-fade-in"
        >
          {amallar.map((a) => {
            const Icon = IKON[a.kod];
            const ichi = (
              <>
                <Icon className="w-4 h-4 shrink-0 text-muted" aria-hidden />
                {a.label}
              </>
            );
            const stil =
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-fg text-left transition hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2";
            return a.href ? (
              <Link key={a.kod} href={a.href} role="menuitem" className={stil} onClick={() => setOchiq(false)}>
                {ichi}
              </Link>
            ) : (
              <button
                key={a.kod}
                type="button"
                role="menuitem"
                className={stil}
                onClick={() => {
                  setOchiq(false);
                  setQuick(a.kod === "chiqim" ? "chiqim" : "kirim");
                }}
              >
                {ichi}
              </button>
            );
          })}
        </div>
      )}

      <QuickAddSheet
        open={quick !== null}
        defaultTuri={quick ?? "kirim"}
        onClose={() => setQuick(null)}
      />
    </div>
  );
}
