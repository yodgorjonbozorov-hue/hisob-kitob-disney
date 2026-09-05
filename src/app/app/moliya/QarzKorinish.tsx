"use client";

import { formatSom } from "@/lib/format";

/**
 * BALANS KO'RINISHI (10-talab) — tanlangan tomonning qarzi va to'lovdan
 * KEYINGI qoldiq. Summa yozilayotganda darhol yangilanadi.
 *
 * Faqat qarzga bog'langan sababda ko'rinadi: oddiy xarajatda qarz
 * tushunchasi yo'q va bo'sh panel foydalanuvchini chalg'itardi.
 */
export function QarzKorinish({
  ism,
  hozirgi,
  tolanmoqda,
  yuklanmoqda,
}: {
  ism: string;
  hozirgi: number | null;
  tolanmoqda: number;
  yuklanmoqda: boolean;
}) {
  if (yuklanmoqda) {
    return (
      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs text-faint">
        Qarz o&apos;qilmoqda...
      </div>
    );
  }
  if (hozirgi === null) return null;

  const keyin = hozirgi - tolanmoqda;
  const oshib = keyin < 0;

  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 space-y-1">
      <p className="text-xs text-muted">
        <span className="font-medium text-fg">{ism}</span> — jami qarzi
      </p>
      <p className="text-sm text-debt tnum">{formatSom(hozirgi)} so&apos;m</p>
      {tolanmoqda > 0 && (
        <>
          <p className="text-2xs text-muted">
            To&apos;lanmoqda: <span className="tnum">{formatSom(tolanmoqda)}</span>
          </p>
          <p className={`text-sm font-medium tnum ${oshib ? "text-expense" : "text-fg"}`}>
            To&apos;lovdan keyin: {formatSom(Math.max(keyin, 0))} so&apos;m
          </p>
          {oshib && (
            <p className="text-2xs text-expense">
              Summa qarzdan {formatSom(-keyin)} so&apos;m ko&apos;p — bunday to&apos;lov
              qabul qilinmaydi.
            </p>
          )}
        </>
      )}
    </div>
  );
}
