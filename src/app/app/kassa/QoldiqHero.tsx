"use client";

import { Money } from "@/components/ui/Money";
import { formatMoneyCompact } from "@/lib/format";

/**
 * Taqsimotdagi QISQA nomlar. To'liq nomlar ("Naqd kassa", "Bank
 * hisob-raqami") bu yerda kassa NOMLARI bilan adashtirardi — pastdagi
 * kartalar ham xuddi shunday atalishi mumkin.
 */
const TUR_QISQA: Record<string, string> = {
  naqd: "Naqd",
  plastik: "Plastik",
  bank: "Bank",
};

/**
 * SAHIFA SARLAVHASI — "hozir jami qancha pul bor" savoliga 5 soniyada javob.
 *
 * Eng katta element — JAMI QOLDIQ (barcha kassalardagi joriy pul, tarixiy
 * kirim emas). Ostida qoldiqning kassa turlari bo'yicha taqsimoti: naqd pul
 * qo'lda, plastik terminalda, bank hisobda turadi — bu uch xil "tayyorlik
 * darajasi" va ularni bitta raqamga qo'shib ko'rsatish yetarli emas.
 *
 * Undan keyin bugungi harakat: kirim, chiqim, sof va tasdiq kutayotganlar
 * soni. To'rttasi ham bitta qatorda — mobil'da 2×2 to'r (gorizontal siljish
 * bo'lmaydi), planshet va desktopda bitta qator.
 */
export function QoldiqHero({
  jamiQoldiq,
  turBoyicha,
  bugungiKirim,
  bugungiChiqim,
  bugungiSof,
  kutilayotganSoni,
  amallar,
}: {
  jamiQoldiq: number;
  turBoyicha: { turi: string; summa: number }[];
  bugungiKirim: number;
  bugungiChiqim: number;
  bugungiSof: number;
  kutilayotganSoni: number;
  /** Desktop amallari (mobil'da pastdagi yopishqoq tugma ishlatiladi). */
  amallar?: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-line rounded-2xl shadow-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wider text-faint">Jami qoldiq</p>
          <div className="mt-1">
            <Money
              value={jamiQoldiq}
              size="display"
              tone={jamiQoldiq >= 0 ? "brand" : "expense"}
            />
          </div>
          {turBoyicha.length > 0 && (
            <p className="mt-2 text-2xs text-muted flex flex-wrap gap-x-2 gap-y-1">
              {turBoyicha.map((t, i) => (
                <span key={t.turi} className="whitespace-nowrap">
                  {i > 0 && <span className="text-faint mr-2">·</span>}
                  {TUR_QISQA[t.turi] ?? t.turi}{" "}
                  <span className="tnum font-medium text-fg">{formatMoneyCompact(t.summa)}</span>
                </span>
              ))}
            </p>
          )}
        </div>
        {amallar && <div className="hidden sm:flex gap-2 shrink-0">{amallar}</div>}
      </div>

      <dl className="mt-4 pt-4 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3">
        <Kpi yorliq="Bugungi kirim" qiymat={bugungiKirim} belgi="+" rang="text-income" />
        <Kpi yorliq="Bugungi chiqim" qiymat={bugungiChiqim} belgi="−" rang="text-expense" />
        <Kpi
          yorliq="Bugungi sof"
          qiymat={Math.abs(bugungiSof)}
          belgi={bugungiSof > 0 ? "+" : bugungiSof < 0 ? "−" : ""}
          rang={bugungiSof > 0 ? "text-income" : bugungiSof < 0 ? "text-expense" : "text-fg"}
        />
        <div className="min-w-0">
          <dt className="text-2xs text-muted truncate">Kutilmoqda</dt>
          <dd
            className={`mt-0.5 font-display tnum text-lg ${
              kutilayotganSoni > 0 ? "text-debt" : "text-fg"
            }`}
          >
            {kutilayotganSoni}
            <span className="font-sans text-2xs text-faint ml-1">ta</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Bitta KPI ustuni — ixcham qilib faqat mln/ming ko'rsatiladi (375px sig'ishi uchun). */
function Kpi({
  yorliq,
  qiymat,
  belgi,
  rang,
}: {
  yorliq: string;
  qiymat: number;
  belgi: string;
  rang: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs text-muted truncate">{yorliq}</dt>
      <dd className={`mt-0.5 font-display tnum text-lg whitespace-nowrap ${rang}`}>
        {belgi && `${belgi} `}
        {formatMoneyCompact(qiymat)}
      </dd>
    </div>
  );
}
