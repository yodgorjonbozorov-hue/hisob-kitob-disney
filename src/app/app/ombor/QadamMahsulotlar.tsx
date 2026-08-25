"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { MahsulotQidiruv } from "./MahsulotQidiruv";
import type { OmborMahsulotDTO } from "@/lib/queries/ombor";

export interface TaminotSatr {
  productId: string;
  nomi: string;
  birlik: string;
  /** Bo'sh matn — foydalanuvchi hali yozmagan (0 dan farqli). */
  miqdor: string;
  birlikNarx: string;
}

/** Satr summasi — bittada ham, jamida ham AYNI shu funksiya ishlatiladi. */
export function satrSummasi(s: TaminotSatr): number {
  const m = Number(s.miqdor.replace(/[^0-9]/g, "")) || 0;
  return m * parseSomInput(s.birlikNarx);
}

export function jamiSumma(satrlar: TaminotSatr[]): number {
  return satrlar.reduce((a, s) => a + satrSummasi(s), 0);
}

/**
 * 3-QADAM — NIMA KELDI?
 *
 * Bir ta'minotda bir nechta mahsulot bo'lishi mumkin. Har satr uchun faqat
 * ikki raqam so'raladi — miqdor va narx; jami esa HAR YOZUVDA darhol
 * qayta hisoblanadi, foydalanuvchi kalkulyator ochmasin.
 *
 * `inputMode="numeric"` — telefonda raqam klaviaturasi ochiladi.
 */
export function QadamMahsulotlar({
  satrlar,
  onChange,
  onYangiMahsulot,
}: {
  satrlar: TaminotSatr[];
  onChange: (s: TaminotSatr[]) => void;
  onYangiMahsulot: (nomi: string) => void;
}) {
  const [qoshish, setQoshish] = useState(satrlar.length === 0);

  function qosh(m: OmborMahsulotDTO) {
    onChange([
      ...satrlar,
      {
        productId: m.id,
        nomi: m.nomi,
        birlik: m.birlik,
        miqdor: "",
        // Oxirgi tannarx taklif qilinadi — ko'pincha narx o'zgarmaydi.
        birlikNarx: m.kelganNarx > 0 ? formatSom(m.kelganNarx) : "",
      },
    ]);
    setQoshish(false);
  }

  function yangila(i: number, patch: Partial<TaminotSatr>) {
    onChange(satrlar.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-fg">Nima keldi?</p>

      {satrlar.map((s, i) => (
        <div key={s.productId} className="rounded-xl border border-line p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm text-fg min-w-0 break-words">{s.nomi}</p>
            <button
              type="button"
              onClick={() => onChange(satrlar.filter((_, idx) => idx !== i))}
              aria-label={`${s.nomi} ni olib tashlash`}
              className="shrink-0 text-faint hover:text-expense text-lg leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2"
            >
              &times;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-2xs text-muted mb-1" htmlFor={`m-${s.productId}`}>
                Miqdor ({s.birlik})
              </label>
              <input
                id={`m-${s.productId}`}
                inputMode="numeric"
                value={s.miqdor}
                onChange={(e) => yangila(i, { miqdor: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-2xs text-muted mb-1" htmlFor={`n-${s.productId}`}>
                Narxi (1 {s.birlik})
              </label>
              <input
                id={`n-${s.productId}`}
                inputMode="numeric"
                value={s.birlikNarx}
                onChange={(e) =>
                  yangila(i, {
                    birlikNarx: e.target.value ? formatSom(parseSomInput(e.target.value)) : "",
                  })
                }
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <p className="text-sm text-right tnum text-fg">
            <span className="text-muted text-xs">
              {s.miqdor || 0} {s.birlik} &times; {s.birlikNarx || 0} ={" "}
            </span>
            <span className="font-semibold">{formatSomLabel(satrSummasi(s))}</span>
          </p>
        </div>
      ))}

      {qoshish ? (
        <div className="rounded-xl border border-line p-3">
          <MahsulotQidiruv
            onTanla={qosh}
            onYangi={onYangiMahsulot}
            tanlanganIdlar={satrlar.map((s) => s.productId)}
          />
          {satrlar.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setQoshish(false)} className="mt-2 w-full">
              Yopish
            </Button>
          )}
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setQoshish(true)} className="w-full">
          + Mahsulot qo&apos;shish
        </Button>
      )}

      {satrlar.length > 0 && (
        <div className="flex items-center justify-between px-1 pt-1 border-t border-line">
          <span className="text-sm text-muted">Jami</span>
          <span className="text-lg font-bold text-fg tnum">
            {formatSomLabel(jamiSumma(satrlar))}
          </span>
        </div>
      )}
    </div>
  );
}
