"use client";

import type { Sanoq } from "./useXodimlar";

/**
 * TEPADAGI IXCHAM KPI.
 *
 * Faqat javob beradigan raqamlar: nechta xodim bor, nechtasi ishlayapti,
 * nechtasi kirolmaydi. "Bir nechta biznesda" — qo'shimcha ko'rsatkich va
 * faqat shunday xodim BOR bo'lganda chiqadi; 375px ekranda esa umuman
 * chiqmaydi (uchta karta bir qatorga sig'adi, to'rttasi siqilib ketardi).
 */
function Kpi({ nom, qiymat }: { nom: string; qiymat: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="text-2xs text-muted">{nom}</p>
      <p className="text-xl font-semibold text-fg tnum">{qiymat}</p>
    </div>
  );
}

export function KpiQator({ sanoq }: { sanoq: Sanoq }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <Kpi nom="Jami xodimlar" qiymat={sanoq.jami} />
      <Kpi nom="Faol" qiymat={sanoq.faol} />
      <Kpi nom="Nofaol" qiymat={sanoq.nofaol} />
      {sanoq.kopBiznes > 0 && (
        <div className="hidden sm:block">
          <Kpi nom="Bir nechta biznesda" qiymat={sanoq.kopBiznes} />
        </div>
      )}
    </div>
  );
}
