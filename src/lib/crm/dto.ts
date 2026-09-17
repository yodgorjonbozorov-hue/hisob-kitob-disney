import { utcDateToDateOnlyString } from "@/lib/date";
import { zakazQarzdormi } from "@/lib/crm/pipeline";
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

/** `zakazMoliyaSnapshot` uchun minimal shakl (doska ham, PATCH javobi ham beradi). */
export interface XomZakazMoliya {
  transactionId: string | null;
  debtId: string | null;
  transaction: { summa: number; deletedAt: Date | null } | null;
  tolovlar: Array<{ transaction: { summa: number; deletedAt: Date | null } | null }>;
  debt: { jamiSumma: number; tolangan: number; status: string; isYopilgan: boolean } | null;
}

/** Zakazning MOLIYAVIY natijasi — YAGONA joyda hisoblanadi. */
export interface ZakazMoliyaDTO {
  transactionId: string | null;
  debtId: string | null;
  /** Kirimga o'tgan REAL summa (o'chirilgani sanalmaydi). */
  kirimSumma: number;
  /** Ochilgan qarzning QOLDIG'I (jami − to'langan). */
  qarzQoldiq: number;
  /** Qarz OCHIQmi (bekor qilingani va to'liq to'langani — yo'q). */
  qarzOchiq: boolean;
  /** Qarz holati: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED"; qarz yo'q — null. */
  qarzHolat: string | null;
}

/**
 * ZAKAZNING MOLIYAVIY NATIJASI.
 *
 * ═══ NEGA `debtId` NING O'ZI YETARLI EMAS ═══
 * CRM ilgari "Qarzdorlikka yozildi" ni FAQAT `debtId` bor-yo'qligidan
 * ko'rsatardi. Qarz keyin to'liq to'langan (`PAID`) yoki bekor qilingan
 * (`CANCELLED`) bo'lsa ham karta "🔴 Qarzdorlikka yozildi · Qoldiq: 0 so'm"
 * deb turardi va "Qarzdorlikni ochish" foydalanuvchini Qarzdorlar
 * ro'yxatiga olib borardi — u yerda esa mijoz YO'Q, chunki ro'yxat ochiq
 * qarzlarni ko'rsatadi (`listQarzdorlar` qoldiqsizni tashlaydi). Endi
 * QARZNING HOLATI ham qaytadi, ya'ni UI "ochiq qarz", "to'langan" va
 * "bekor qilingan" ni ajratib ko'rsata oladi.
 */
export function zakazMoliyaSnapshot(d: XomZakazMoliya): ZakazMoliyaDTO {
  return {
    transactionId: d.transactionId,
    debtId: d.debtId,
    kirimSumma: kirimSummasi(d),
    qarzQoldiq: d.debt ? Math.max(0, d.debt.jamiSumma - d.debt.tolangan) : 0,
    // OCHIQ QARZ — "Qarz" ustunining sharti. Serverda hisoblanadi, shunda
    // brauzer qarz yozuvining ichki maydonlariga bog'lanmaydi va doska
    // ustuni ikkala tarafda AYNI qoidadan chiqadi (lib/crm/pipeline.ts).
    qarzOchiq: zakazQarzdormi(d.debt),
    qarzHolat: d.debt ? d.debt.status : null,
  };
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
    // YO'QOTILGAN ZAKAZ KARTASI (direktor arxivi): sabab va yo'qotilgan
    // sana. Sana alohida maydon emas — u `yopilganAt` (yuqorida).
    yoqotishSababi: d.yoqotishSababi,
    masulId: d.masulId,
    masulIsm,
    ...zakazMoliyaSnapshot(d),
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
