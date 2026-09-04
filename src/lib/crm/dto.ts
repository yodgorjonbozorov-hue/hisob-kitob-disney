import { utcDateToDateOnlyString } from "@/lib/date";
import type { UstunSahifa } from "@/lib/crm/service";
import type { BuyurtmaDTO, UstunSahifaDTO } from "@/app/app/crm/turlar";

/**
 * ZAKAZ → BRAUZER DTO — YAGONA joyda.
 *
 * Nega alohida modul: doskani endi IKKI joy to'ldiradi — sahifaning o'zi
 * (birinchi 10 ta) va "Yana ko'rsatish" so'rovi (`/api/crm/board`). Xarita
 * ikki nusxada bo'lsa ular jimgina ajralib ketardi: masalan kirim summasi
 * bir joyda qatorlardan, ikkinchisida eski bog'lanishdan hisoblanardi.
 */

/** Zakazning kirim summasi — YOZUVLARNING O'ZIDAN (o'chirilgani sanalmaydi). */
function kirimSummasi(d: {
  transaction: { summa: number; deletedAt: Date | null } | null;
  tolovlar: Array<{ transaction: { summa: number; deletedAt: Date | null } | null }>;
}): number {
  // ARALASH TO'LOV: har kanal alohida kirim yozadi, shuning uchun raqam
  // qatorlardan yig'iladi. Qatorsiz (eski) zakazda — bitta bog'langan yozuv.
  if (d.tolovlar.length > 0) {
    return d.tolovlar.reduce(
      (s, t) => s + (t.transaction && !t.transaction.deletedAt ? t.transaction.summa : 0),
      0
    );
  }
  return d.transaction && !d.transaction.deletedAt ? d.transaction.summa : 0;
}

type XomZakaz = UstunSahifa["deals"][number];

export function zakazDTO(
  d: XomZakaz,
  masulIsm: string | null,
  sotuvchi: { employeeId: string; ism: string; isActive: boolean } | undefined
): BuyurtmaDTO {
  return {
    id: d.id,
    nomi: d.nomi,
    summa: d.summa,
    tolangan: d.tolangan,
    tolovTuri: d.tolovTuri,
    holat: d.holat,
    stageId: d.stageId,
    categoryId: d.categoryId,
    kategoriya: d.category?.nomi ?? null,
    kontakt: d.contact?.ism ?? null,
    tel: d.contact?.tel ?? null,
    sana: d.sana ? utcDateToDateOnlyString(d.sana) : null,
    // Ustun ichidagi tartib vaqtlari (ISO) — brauzer ham server bilan AYNI
    // qoidadan tartiblaydi (`lib/crm/pipeline.ts`).
    holatAt: d.holatAt ? d.holatAt.toISOString() : null,
    yopilganAt: d.yopilganAt ? d.yopilganAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    izoh: d.izoh,
    masulId: d.masulId,
    masulIsm,
    transactionId: d.transactionId,
    debtId: d.debtId,
    kirimSumma: kirimSummasi(d),
    qarzQoldiq: d.debt ? Math.max(0, d.debt.jamiSumma - d.debt.tolangan) : 0,
    tolovlar: d.tolovlar.map((t) => ({ id: t.id, kanal: t.kanal, summa: t.summa })),
    sotuvchi: sotuvchi
      ? { employeeId: sotuvchi.employeeId, ism: sotuvchi.ism, isActive: sotuvchi.isActive }
      : null,
  };
}

/** Bir ustunning sahifasi — sarlavha raqamlari va keyingi sahifa kaliti bilan. */
export function ustunSahifaDTO(sahifa: UstunSahifa, ismlar: Map<string, string>): UstunSahifaDTO {
  return {
    ustun: sahifa.ustun,
    zakazlar: sahifa.deals.map((d) =>
      zakazDTO(d, ismlar.get(d.masulId) ?? null, sahifa.sotuvchilar.get(d.id))
    ),
    kursor: sahifa.kursor,
    jami: sahifa.jami,
    summa: sahifa.summa,
  };
}
