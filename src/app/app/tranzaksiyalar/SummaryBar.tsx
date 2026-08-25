"use client";

import { formatMoneyCompact, formatMoney } from "@/lib/format";
import { TOLOV_GURUHI_BELGI, TOLOV_GURUHI_NOMI } from "@/lib/tolovBolimi";

export interface Taqsimot {
  naqd: number;
  click: number;
  karta: number;
}

/**
 * TANLANGAN DAVR YAKUNI — ro'yxat tepasida, ixcham.
 *
 * MUHIM INVARIANT: kirim va chiqim taqsimotlari ARALASHMAYDI. Ular ikki
 * alohida qatorda, har biri o'z yorlig'i bilan turadi — "Naqd 12 mln"
 * degan yolg'iz raqam kirimmi yoki chiqimmi ekani noaniq bo'lib qolmaydi.
 *
 * Raqamlar serverdan (`listTransactions.totals`) keladi va joriy FILTRGA
 * bo'ysunadi — brauzerdagi sahifadan emas, butun to'plamdan hisoblanadi.
 * Qarz esa ATAYLAB alohida: u real pul emas va `sof` ga kirmaydi.
 */
export function SummaryBar({
  jamiKirim,
  jamiChiqim,
  sof,
  kirimTaqsimot,
  chiqimTaqsimot,
  qarzSumma,
  hideProfit = false,
  turiFiltri,
}: {
  jamiKirim: number;
  jamiChiqim: number;
  sof: number;
  kirimTaqsimot: Taqsimot;
  chiqimTaqsimot: Taqsimot;
  /** Qarzga berilgan jami (qarz yozuvlari + kunlik hisobot). null — qarz yo'q. */
  qarzSumma: number | null;
  hideProfit?: boolean;
  /** "" | "kirim" | "chiqim" — filtrlangan tomon qatorlarigina ko'rsatiladi. */
  turiFiltri: string;
}) {
  const kirimKor = turiFiltri !== "chiqim";
  const chiqimKor = turiFiltri !== "kirim";

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Karta yorliq="Kirim" qiymat={jamiKirim} belgi="+" rang="text-income" fon="bg-income-soft" />
        <Karta yorliq="Chiqim" qiymat={jamiChiqim} belgi="−" rang="text-expense" fon="bg-expense-soft" />
        {!hideProfit && (
          <Karta
            yorliq="Sof"
            qiymat={sof}
            belgi={sof < 0 ? "−" : "+"}
            rang={sof < 0 ? "text-expense" : "text-fg"}
            fon="bg-surface-2"
            className="col-span-2 sm:col-span-1"
          />
        )}
      </div>

      <div className="space-y-1.5 pt-1 border-t border-line">
        {kirimKor && (
          <Qator yorliq="Kirim" rang="text-income" taqsimot={kirimTaqsimot} qarz={qarzSumma} />
        )}
        {chiqimKor && (
          <Qator yorliq="Chiqim" rang="text-expense" taqsimot={chiqimTaqsimot} qarz={null} />
        )}
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
    <div className={`${fon} rounded-xl px-3 py-2 ${className}`} title={formatMoney(qiymat)}>
      <p className="text-2xs text-muted">{yorliq}</p>
      <p className={`font-display tnum font-semibold text-base sm:text-lg ${rang} whitespace-nowrap`}>
        {belgi} {formatMoneyCompact(Math.abs(qiymat))}
      </p>
    </div>
  );
}

function Qator({
  yorliq,
  rang,
  taqsimot,
  qarz,
}: {
  yorliq: string;
  rang: string;
  taqsimot: Taqsimot;
  /** Faqat kirim qatorida — qarz chiqimda bo'lmaydi. */
  qarz: number | null;
}) {
  const bandlar: { kalit: "naqd" | "click" | "karta" | "qarz"; summa: number }[] = [
    { kalit: "naqd", summa: taqsimot.naqd },
    { kalit: "click", summa: taqsimot.click },
    { kalit: "karta", summa: taqsimot.karta },
  ];
  if (qarz !== null) bandlar.push({ kalit: "qarz", summa: qarz });

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className={`text-2xs font-medium ${rang} w-12 shrink-0`}>{yorliq}</span>
      {bandlar.map((b) => (
        <span key={b.kalit} className="text-muted whitespace-nowrap" title={formatMoney(b.summa)}>
          <span aria-hidden="true">{TOLOV_GURUHI_BELGI[b.kalit]}</span> {TOLOV_GURUHI_NOMI[b.kalit]}{" "}
          <span className="tnum font-medium text-fg">{formatMoneyCompact(b.summa)}</span>
        </span>
      ))}
    </div>
  );
}
