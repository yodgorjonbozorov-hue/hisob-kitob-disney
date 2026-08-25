"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * QATOR AMALLARI — "⋯" menyusi.
 *
 * Ilgari har qatorda "Tahrirlash" va "O'chirish" matnlari turardi: ular
 * jadval kengligining o'ndan birini yeb, ko'z esa har qatorda o'sha ikki
 * so'zga qaytib urilardi. Endi bitta belgi, amallar esa bosilganda chiqadi.
 *
 * `Batafsil` HAR DOIM bor — u ko'rish amali. Tahrirlash/o'chirish esa
 * huquq bo'lsagina (RBAC): tugmani yashirish himoya emas, shuning uchun
 * server ham har so'rovda egalikni qayta tekshiradi.
 */
export function AmalMenu({
  onBatafsil,
  onTahrirlash,
  onOchirish,
}: {
  onBatafsil: () => void;
  onTahrirlash?: () => void;
  onOchirish?: () => void;
}) {
  const [ochiq, setOchiq] = useState(false);
  const oram = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ochiq) return;
    const tashqariBosildi = (e: MouseEvent) => {
      if (!oram.current?.contains(e.target as Node)) setOchiq(false);
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

  const BAND =
    "w-full text-left px-3 py-2.5 text-sm min-h-[44px] hover:bg-surface-2 transition";

  return (
    <div ref={oram} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOchiq((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ochiq}
        aria-label="Amallar"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface-2 transition"
      >
        <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
      </button>

      {ochiq && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] rounded-xl border border-line
            bg-surface shadow-lg overflow-hidden py-1"
        >
          <button
            role="menuitem"
            className={BAND}
            onClick={() => {
              setOchiq(false);
              onBatafsil();
            }}
          >
            Batafsil
          </button>
          {onTahrirlash && (
            <button
              role="menuitem"
              className={BAND}
              onClick={() => {
                setOchiq(false);
                onTahrirlash();
              }}
            >
              Tahrirlash
            </button>
          )}
          {onOchirish && (
            <button
              role="menuitem"
              className={`${BAND} text-expense`}
              onClick={() => {
                setOchiq(false);
                onOchirish();
              }}
            >
              O&apos;chirish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
