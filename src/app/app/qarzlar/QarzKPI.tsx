"use client";

import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import type { QarzDashboardDTO } from "@/lib/queries/qarz";

/**
 * QARZLAR DASHBOARDI — beshta ko'rsatkich.
 *
 * Raqamlar SERVERDA jamlanadi (lib/queries/qarz.ts): ro'yxat 1000 yozuv
 * bilan chegaralangan, minglab qarzi bor biznesda brauzerda jamlash
 * yolg'on natija berardi.
 */
export function QarzKPI({ d }: { d: QarzDashboardDTO }) {
  const kartalar = [
    {
      label: "Jami ochiq qarz",
      qiymat: d.ochiqJami,
      cls: "text-debt",
      izoh: "Bizga qarzdorlar — kelishi kerak bo'lgan pul",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl shadow-card border border-line p-4">
          <p className="text-muted text-sm mb-1">Jami mijozlar qarzi</p>
          <p className="text-lg font-semibold text-fg tnum">
            {d.mijozlarSoni} ta mijoz · {formatSomLabel(d.ochiqJami)}
          </p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-4">
          <p className="text-muted text-sm mb-1">Biz qarzdormiz</p>
          <p className="text-lg font-semibold text-expense tnum">
            {formatSomLabel(d.beriladiganJami)}
          </p>
        </div>
      </div>
    </div>
  );
}
