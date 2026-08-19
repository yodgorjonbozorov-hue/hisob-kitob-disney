"use client";

import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";

/** Savatdagi bitta satr (client holati). */
export interface SavatSatri {
  productId: string;
  nomi: string;
  birlik: string;
  /** Katalogdagi narx — "narx o'zgartirildi" belgisini ko'rsatish uchun. */
  katalogNarx: number;
  /** Amaldagi birlik narxi (kassir tuzatgan bo'lishi mumkin). */
  birlikNarx: number;
  miqdor: number;
  /** Skanerlash paytidagi ombor qoldig'i — ortiqcha urishdan ogohlantirish uchun. */
  qoldiq: number;
}

/**
 * SAVAT — kassirning asosiy ish maydoni.
 *
 * Bitta mahsulot qayta skanerlansa yangi satr QO'SHILMAYDI, mavjud satrning
 * miqdori oshadi (1 → 2 → 3). Aks holda 12 dona olgan xaridorning cheki
 * 12 satrdan iborat bo'lardi.
 */
export function Savat({
  satrlar,
  onMiqdor,
  onNarx,
  onOchir,
}: {
  satrlar: SavatSatri[];
  onMiqdor: (productId: string, miqdor: number) => void;
  onNarx: (productId: string, narx: number) => void;
  onOchir: (productId: string) => void;
}) {
  if (satrlar.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-4xl mb-3">🛒</p>
        <p className="text-sm text-muted">Savat bo&apos;sh</p>
        <p className="text-xs text-faint mt-1">
          Mahsulotni skanerlang yoki qidiruvdan tanlang.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {satrlar.map((s) => {
        const ortiqcha = s.miqdor > s.qoldiq;
        return (
          <li key={s.productId} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg truncate">{s.nomi}</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={s.birlikNarx}
                    onChange={(e) => onNarx(s.productId, Number(e.target.value))}
                    aria-label={`${s.nomi} narxi`}
                    className="w-28 rounded-lg border border-line px-2 py-1 text-sm bg-surface"
                  />
                  <span className="text-xs text-faint">so&apos;m / {s.birlik}</span>
                  {s.birlikNarx !== s.katalogNarx && (
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-wash text-brand">
                      narx o&apos;zgartirildi
                    </span>
                  )}
                </div>
                {ortiqcha && (
                  <p className="text-xs text-expense-fg mt-1">
                    Omborda {s.qoldiq} {s.birlik} qoldi — bu chek o&apos;tmaydi.
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <Money value={s.birlikNarx * s.miqdor} size="md" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onMiqdor(s.productId, s.miqdor - 1)}
                    aria-label="Miqdorni kamaytirish"
                    className="w-8 h-8 rounded-lg border border-line text-lg leading-none"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={s.miqdor}
                    onChange={(e) => onMiqdor(s.productId, Number(e.target.value))}
                    aria-label={`${s.nomi} miqdori`}
                    className="w-14 text-center rounded-lg border border-line px-1 py-1 text-sm bg-surface"
                  />
                  <button
                    onClick={() => onMiqdor(s.productId, s.miqdor + 1)}
                    aria-label="Miqdorni oshirish"
                    className="w-8 h-8 rounded-lg border border-line text-lg leading-none"
                  >
                    +
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOchir(s.productId)}
                    aria-label={`${s.nomi} — savatdan olib tashlash`}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
