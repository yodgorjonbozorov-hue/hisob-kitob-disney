import type { KunlikHolatDTO } from "@/lib/queries/kunlik";

/**
 * KUN HOLATI — belgi, nom va rang uchun YAGONA manba.
 *
 * Holat bazadagi `DailyReport.holat` dan keladi: UI hech qanday "soxta"
 * holat o'ylab topmaydi. Uchta holat va ularning ma'nosi:
 *   OPEN      — kun ochiq, tushum kiritiladi;
 *   SUBMITTED — kassir topshirdi, direktor tasdig'i kutilmoqda (pul hali
 *               kassirda — o'tkazma "kutilmoqda" holatida);
 *   CONFIRMED — direktor qabul qildi, pul markaziy kassaga o'tdi, kun yopiq.
 */

export interface HolatKorinishi {
  belgi: string;
  nomi: string;
  /** Tailwind klasslari — Badge tone'lari bilan bir xil palitradan. */
  klass: string;
  /** Bir qatorlik tushuntirish — foydalanuvchi "keyin nima bo'ladi"ni bilsin. */
  izoh: string;
}

export const HOLAT_KORINISHI: Record<KunlikHolatDTO, HolatKorinishi> = {
  OPEN: {
    belgi: "\u{1F7E2}",
    nomi: "Ochiq",
    klass: "bg-income-soft text-income-fg",
    izoh: "Kun davom etmoqda — kirim va chiqim kiritilmoqda.",
  },
  SUBMITTED: {
    belgi: "\u{1F7E1}",
    nomi: "Direktorga yuborilgan",
    klass: "bg-debt-soft text-debt-fg",
    izoh: "Kassa topshirildi. Pul hali kassirda — direktor qabul qilgach ko'chadi.",
  },
  CONFIRMED: {
    belgi: "\u{2705}",
    nomi: "Tasdiqlangan",
    klass: "bg-brand-wash text-brand",
    izoh: "Kun yopildi, pul markaziy kassaga o'tdi. Raqamlar muzlatilgan.",
  },
};

/** Farq belgisi va rangi — kamomad/ortiqcha/mos. */
export interface FarqKorinishi {
  matn: string;
  klass: string;
}

export function farqKorinishi(farq: number | null): FarqKorinishi | null {
  if (farq === null) return null;
  if (farq === 0) return { matn: "✓ Farq yo'q", klass: "text-brand font-medium" };
  const abs = Math.abs(farq).toLocaleString("uz-UZ");
  return farq < 0
    ? { matn: `\u{1F534} Kamomad: ${abs} so'm`, klass: "text-expense font-semibold" }
    : { matn: `\u{1F7E2} Ortiqcha: ${abs} so'm`, klass: "text-income font-semibold" };
}
