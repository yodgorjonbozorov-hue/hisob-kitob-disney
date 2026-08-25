"use client";

import { formatMoneyCompact, formatMoney } from "@/lib/format";

/**
 * TANLANGAN DAVR YAKUNI — Jami kirim, Jami chiqim va Sof.
 *
 * FAQAT DIREKTOR/ADMINISTRATORGA ko'rsatiladi (chaqiruvchi tekshiradi):
 * kassir va sotuvchi biznesning umumiy aylanmasi va foydasini bilishi
 * shart emas, ular o'z yozuvlari bilan ishlaydi.
 *
 * Raqamlar serverdan (`listTransactions.totals`) keladi va joriy FILTRGA
 * bo'ysunadi — brauzerdagi sahifadan emas, butun to'plamdan hisoblanadi.
 * Qarz `sof` ga KIRMAYDI — u real pul emas (lib/qarzFiltr.ts).
 */
export function SummaryBar({
  jamiKirim,
  jamiChiqim,
  sof,
}: {
  jamiKirim: number;
  jamiChiqim: number;
  sof: number;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Karta yorliq="Kirim" qiymat={jamiKirim} belgi="+" rang="text-income" fon="bg-income-soft" />
        <Karta yorliq="Chiqim" qiymat={jamiChiqim} belgi="−" rang="text-expense" fon="bg-expense-soft" />
        <Karta
          yorliq="Sof"
          qiymat={sof}
          belgi={sof < 0 ? "−" : "+"}
          rang={sof < 0 ? "text-expense" : "text-fg"}
          fon="bg-surface-2"
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </div>
  );
}

function Karta({
  yorliq,
  qiymat,
  belgi,
  rang,
  fon,
  className = "",
}: {
  yorliq: string;
  qiymat: number;
  belgi: string;
  rang: string;
  fon: string;
  className?: string;
}) {
  return (
    // `title` — to'liq summa: ixcham ko'rinishda "4,9 mln" yozilgani uchun
    // aniq raqam kerak bo'lganda sichqoncha ostida chiqadi.
    <div className={`${fon} rounded-xl px-3 py-2 ${className}`} title={formatMoney(qiymat)}>
      <p className="text-2xs text-muted">{yorliq}</p>
      <p className={`font-display tnum font-semibold text-base sm:text-lg ${rang} whitespace-nowrap`}>
        {belgi} {formatMoneyCompact(Math.abs(qiymat))}
      </p>
    </div>
  );
}
