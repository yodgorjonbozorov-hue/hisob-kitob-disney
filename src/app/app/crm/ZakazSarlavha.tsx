"use client";

import { formatMoney, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { TOLOV_HOLAT_NOMI, USTUN_NOMI, type TolovHolat, type Ustun } from "@/lib/crm/pipeline";
import { TOLOV_BELGISI } from "./BuyurtmaKarta";
import type { BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZ TAFSILOTINING SARLAVHASI: kategoriya, nomi, mijoz, narx, sana,
 * ustun va to'lov belgisi.
 *
 * `BuyurtmaSheet` dan ALOHIDA fayl: tafsilot oynasiga to'lovlar ledgeri
 * qo'shilgach u 250 satrlik chegaradan oshib ketardi (loyiha qoidasi).
 * Bu yerda faqat ko'rsatish — hech qanday so'rov yoki holat yo'q.
 *
 * TO'LOV RAQAMI SERVER HISOBIDAN keladi (`tolangan`), doskadagi eskirgan
 * snapshotdan emas: qo'shilgan to'lov darhol ko'rinishi kerak.
 */
export function ZakazSarlavha({
  b,
  ustun,
  tolov,
  tolangan,
  kechikkan,
  /** Zakazga sotuvchi biriktirilganmi — bo'lsa mas'ul qatori ko'rsatilmaydi. */
  sotuvchiBor,
}: {
  b: BuyurtmaDTO;
  ustun: Ustun;
  tolov: TolovHolat;
  tolangan: number;
  kechikkan: number;
  sotuvchiBor: boolean;
}) {
  return (
    <div className="space-y-1">
      {b.kategoriya && (
        <p className="text-2xs font-semibold text-brand uppercase tracking-wide">{b.kategoriya}</p>
      )}
      <h2 className="font-semibold text-fg text-lg">{b.nomi}</h2>
      <p className="text-sm text-muted">
        {b.kontakt ?? "Mijozsiz"}
        {b.tel ? ` · ${b.tel}` : ""}
      </p>
      <p className="text-sm text-fg tnum">
        {b.summa > 0 ? formatMoney(b.summa) : "Narx kiritilmagan"}
        {b.sana ? ` · ${formatDateUZ(new Date(b.sana))}` : ""}
      </p>
      {b.masulIsm && !sotuvchiBor && <p className="text-xs text-faint">Mas&apos;ul: {b.masulIsm}</p>}
      <div className="flex gap-1.5 flex-wrap pt-1">
        <Badge tone="neutral">{USTUN_NOMI[ustun]}</Badge>
        <Badge tone={TOLOV_BELGISI[tolov].tone}>
          {TOLOV_HOLAT_NOMI[tolov]}
          {tolov === "QISMAN" ? `: ${formatMoney(tolangan)}` : ""}
        </Badge>
        {kechikkan > 0 && <Badge tone="chiqim">🔴 {kechikkan} kun kechikkan</Badge>}
      </div>
      {b.izoh && <p className="text-xs text-muted whitespace-pre-line pt-1">{b.izoh}</p>}
    </div>
  );
}
