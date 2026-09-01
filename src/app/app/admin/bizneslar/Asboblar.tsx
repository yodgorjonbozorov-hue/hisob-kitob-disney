"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import { SARALASH_NOMLARI, type Filtr, type Saralash } from "./turlar";

const FILTRLAR: { kod: Filtr; nomi: string }[] = [
  { kod: "hammasi", nomi: "Barchasi" },
  { kod: "faol", nomi: "Faol" },
  { kod: "nofaol", nomi: "Nofaol" },
];

/**
 * QIDIRUV / FILTR / SARALASH paneli.
 *
 * Mobil'da qidiruv butun enni egallaydi, filtr esa chip qatori bo'lib
 * pastida turadi (barmoq uchun 40px balandlik). Desktopda hammasi bitta
 * qatorda — sahifa sarlavhasi ostida yagona boshqaruv chizig'i.
 */
export function Asboblar({
  qidiruv,
  filtr,
  saralash,
  sonlar,
  onQidiruv,
  onFiltr,
  onSaralash,
}: {
  qidiruv: string;
  filtr: Filtr;
  saralash: Saralash;
  /** Har filtr uchun topilgan biznes soni — chipda ko'rsatiladi. */
  sonlar: Record<Filtr, number>;
  onQidiruv: (v: string) => void;
  onFiltr: (v: Filtr) => void;
  onSaralash: (v: Saralash) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search
          size={16}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
        />
        <input
          type="search"
          value={qidiruv}
          onChange={(e) => onQidiruv(e.target.value)}
          placeholder="Biznes nomi bo'yicha qidirish..."
          aria-label="Biznes nomi bo'yicha qidirish"
          className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-brand"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Filtr chiplari o'z chizig'ida suriladi; saralash ro'yxati esa
            yonida QOLADI — aks holda 375px ekranda u chetga chiqib ketardi. */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 min-w-0 overflow-x-auto sm:overflow-visible">
          {FILTRLAR.map((f) => (
            <button
              key={f.kod}
              type="button"
              onClick={() => onFiltr(f.kod)}
              aria-pressed={filtr === f.kod}
              className={cn(
                "px-3 h-9 shrink-0 rounded-lg text-xs font-medium whitespace-nowrap transition",
                filtr === f.kod ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
              )}
            >
              {f.nomi}
              {/* Son telefonda YASHIRINADI: uchta chip + saralash ro'yxati
                  375px ga sig'maydi. Ma'lumot yo'qolmaydi — o'sha raqamlar
                  yuqoridagi xulosa kartochkalarida turibdi. */}
              <span className="ml-1.5 text-faint tnum hidden sm:inline">{sonlar[f.kod]}</span>
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="biznes-saralash">
          Saralash
        </label>
        <Select
          id="biznes-saralash"
          value={saralash}
          onChange={(v) => onSaralash(v as Saralash)}
          className="shrink-0 max-w-[8.5rem] sm:max-w-none"
          options={SARALASH_NOMLARI.map((s) => ({ value: s.kod, label: s.nomi }))}
        />
      </div>
    </div>
  );
}
