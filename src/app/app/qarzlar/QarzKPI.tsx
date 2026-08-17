"use client";

import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { QarzDashboardDTO } from "@/lib/queries/qarz";

/**
 * QARZLAR DASHBOARDI.
 *
 * Raqamlar SERVERDA jamlanadi (lib/queries/qarz.ts): ro'yxat 1000 yozuv
 * bilan chegaralangan, minglab qarzi bor biznesda brauzerda jamlash
 * yolg'on natija berardi.
 *
 * Birinchi karta — sahifaning bosh raqami: jami qarzdorlik va NECHTA
 * qarzdor. U bosh sahifadagi "Menga qarzdor" kartasi bilan bir xil manbadan
 * (ochiq qarzlar qoldig'i) chiqadi, shuning uchun ikki ekranda ikki xil
 * raqam bo'lishi mumkin emas.
 */
export function QarzKPI({ d }: { d: QarzDashboardDTO }) {
  const kartalar = [
    {
      label: "Jami qarzdorlik",
      qiymat: d.ochiqJami,
      cls: "text-debt",
      izoh: `${d.mijozlarSoni} ta qarzdor · kelishi kerak bo'lgan pul`,
    },
    {
      label: "Bugun berilgan",
      qiymat: d.bugunBerilgan,
      cls: "text-fg",
      izoh: "Bugun qarzga yozilgan savdo",
    },
    {
      label: "Bugun yopilgan",
      qiymat: d.bugunYopilgan,
      cls: "text-income",
      izoh: "Bugun qabul qilingan to'lovlar",
    },
    {
      label: "Muddati o'tgan",
      qiymat: d.muddatiOtgan,
      cls: "text-expense",
      izoh: "Kelishilgan muddat o'tib ketgan qarzlar",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kartalar.map((k) => (
          <div key={k.label} className="bg-surface rounded-2xl shadow-card border border-line p-4">
            <p className="text-muted text-sm mb-1">{k.label}</p>
            <p className={`text-xl font-semibold tnum ${k.cls}`} title={formatSomLabel(k.qiymat)}>
              {formatMoneyCompact(k.qiymat)}
            </p>
            <p className="text-2xs text-faint mt-1">{k.izoh}</p>
          </div>
        ))}
      </div>
      {/* "Men qarzdorman" — teskari yo'nalish. Nol bo'lsa ko'rsatilmaydi:
          qarzi yo'q biznesda ekranda keraksiz nol turmasin. */}
      {d.beriladiganJami > 0 && (
        <div className="bg-surface rounded-2xl shadow-card border border-line p-4">
          <p className="text-muted text-sm mb-1">Men qarzdorman</p>
          <p className="text-lg font-semibold text-expense tnum">
            {formatSomLabel(d.beriladiganJami)}
          </p>
          <p className="text-2xs text-faint mt-1">Ta&apos;minotchi va boshqalarga to&apos;lanadigan pul</p>
        </div>
      )}
    </div>
  );
}
