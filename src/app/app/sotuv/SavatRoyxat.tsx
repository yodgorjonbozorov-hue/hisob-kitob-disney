"use client";

import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { Money } from "@/components/ui/Money";

export interface SavatQatori {
  productId: string;
  nomi: string;
  birlik: string;
  /** Ombordagi qoldiq — miqdor shundan oshmaydi. */
  qoldiq: number;
  miqdor: number;
  /** Kelishilgan birlik narxi (so'm). 0 — hali kiritilmagan. */
  narx: number;
  /** Mahsulotning standart sotuv narxi — farqni ko'rsatish uchun. */
  standartNarx: number;
}

/**
 * SAVAT — sotuvga qo'shilgan mahsulotlar.
 *
 * Har qatorda miqdor va birlik narxi ALOHIDA tahrirlanadi: bir sotuvda
 * bir tovar chegirma bilan, boshqasi standart narxda ketishi mumkin.
 * Miqdor ombordagi qoldiqdan oshmaydi (server ham buni atomik tekshiradi).
 */
export function SavatRoyxat({
  qatorlar,
  onOzgart,
  onOchir,
  disabled,
  avto,
}: {
  qatorlar: SavatQatori[];
  onOzgart: (productId: string, qism: Partial<SavatQatori>) => void;
  onOchir: (productId: string) => void;
  disabled?: boolean;
  avto: boolean;
}) {
  if (qatorlar.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
        Savat bo&apos;sh — «Mahsulot qo&apos;shish» tugmasi bilan tanlang.
      </p>
    );
  }

  const jami = qatorlar.reduce((s, q) => s + q.miqdor * q.narx, 0);

  return (
    <div className="space-y-2" data-test="savat">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {qatorlar.map((q) => {
          const farq = q.standartNarx > 0 && q.narx > 0 ? q.narx - q.standartNarx : 0;
          return (
            <li
              key={q.productId}
              data-test="savat-qator"
              data-nomi={q.nomi}
              className="px-3 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{q.nomi}</p>
                  <p className="text-2xs text-faint">
                    Qoldiq: {q.qoldiq} {q.birlik}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOchir(q.productId)}
                  disabled={disabled}
                  aria-label={`${q.nomi} — savatdan olib tashlash`}
                  className="shrink-0 rounded-lg px-2 py-1 text-2xs text-expense hover:bg-expense-soft"
                >
                  O&apos;chirish
                </button>
              </div>

              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="block">
                  <span className="block text-2xs text-muted mb-1">
                    Miqdor ({q.birlik})
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={q.miqdor || ""}
                    disabled={disabled || avto}
                    onChange={(e) => {
                      // 0 ATAYLAB ruxsat: maydonni tozalab qayta yozish
                      // mumkin bo'lsin. Bo'sh qator yuborishni yakuniy
                      // tekshiruv to'sadi ("Miqdorni kiriting").
                      const xom = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                      onOzgart(q.productId, { miqdor: Math.min(q.qoldiq, xom) });
                    }}
                    className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm tnum min-h-[40px]"
                  />
                </label>
                <label className="block">
                  <span className="block text-2xs text-muted mb-1">Birlik narx</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={q.narx ? formatSom(q.narx) : ""}
                    disabled={disabled}
                    placeholder={q.standartNarx > 0 ? formatSom(q.standartNarx) : "Narxni yozing"}
                    onChange={(e) => onOzgart(q.productId, { narx: parseSomInput(e.target.value) })}
                    className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm tnum min-h-[40px]"
                  />
                </label>
                <p className="pb-2 text-sm font-medium tnum text-fg whitespace-nowrap">
                  {formatSomLabel(q.miqdor * q.narx)}
                </p>
              </div>

              {farq !== 0 && (
                <p className={`text-2xs ${farq < 0 ? "text-expense" : "text-income"}`}>
                  Standart {formatSomLabel(q.standartNarx)} — {formatSomLabel(Math.abs(farq))}{" "}
                  {farq < 0 ? "arzon" : "qimmat"}
                </p>
              )}
              {q.narx <= 0 && (
                <p className="text-2xs text-expense">
                  Narx kiritilmagan — bu mahsulotga standart narx qo&apos;yilmagan.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-brand/25 bg-brand-wash px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">
          Jami · {qatorlar.length} ta mahsulot
        </span>
        <Money value={jami} size="xl" tone="brand" />
      </div>
    </div>
  );
}
