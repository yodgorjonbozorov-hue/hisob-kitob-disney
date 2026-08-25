"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * IMPORT / EKSPORT — ikkilamchi menyu.
 *
 * Bu amallar kunda bir marta ham ishlatilmaydi, shuning uchun ular
 * "Kirim"/"Chiqim" tugmalari yonida joy egallamaydi. Eksport havolasi
 * joriy FILTR parametrlarini oladi: ekranda ko'ringan to'plam yuklanadi.
 *
 * CSV import faqat direktor/administratorga ko'rinadi — server ham
 * `requireManager` bilan tekshiradi (tugmani yashirish himoya emas).
 */
export function ImportExportMenu({
  exportUrl,
  onImport,
}: {
  exportUrl: string;
  /** Berilmasa — import bandi umuman chiqmaydi (huquq yo'q). */
  onImport?: () => void;
}) {
  const [ochiq, setOchiq] = useState(false);
  const oram = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ochiq) return;
    const tashqari = (e: MouseEvent) => {
      if (!oram.current?.contains(e.target as Node)) setOchiq(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOchiq(false);
    };
    document.addEventListener("mousedown", tashqari);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", tashqari);
      document.removeEventListener("keydown", esc);
    };
  }, [ochiq]);

  const BAND = "block w-full text-left px-3 py-2.5 text-sm min-h-[44px] hover:bg-surface-2 transition";

  return (
    <div ref={oram} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOchiq((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ochiq}
        aria-label="Import va eksport"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg border border-line
          bg-surface-2 text-fg text-sm font-medium hover:border-brand transition"
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Import / Export</span>
      </button>

      {ochiq && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[12rem] rounded-xl border border-line
            bg-surface shadow-lg overflow-hidden py-1"
        >
          <a role="menuitem" href={exportUrl} className={BAND} onClick={() => setOchiq(false)}>
            ⬇ Excel&apos;ga yuklash
          </a>
          {onImport && (
            <button
              role="menuitem"
              className={BAND}
              onClick={() => {
                setOchiq(false);
                onImport();
              }}
            >
              ⬆ CSV import
            </button>
          )}
        </div>
      )}
    </div>
  );
}
