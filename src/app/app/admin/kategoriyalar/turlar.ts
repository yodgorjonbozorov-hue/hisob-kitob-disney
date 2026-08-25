import type { KategoriyaSatr } from "@/lib/services/kategoriya";

/** Sahifadagi bitta kategoriya qatori (server hisoblab beradi). */
export type Kategoriya = KategoriyaSatr;

export type Tur = "kirim" | "chiqim";

/** Holat filtri. Boshlang'ich qiymat `faol` — kundalik ish shu ro'yxat ustida. */
export type HolatFiltr = "faol" | "nofaol" | "barcha";

export const HOLAT_VARIANTLARI: { value: HolatFiltr; label: string }[] = [
  { value: "faol", label: "Faol" },
  { value: "nofaol", label: "Nofaol" },
  { value: "barcha", label: "Barchasi" },
];

/**
 * Qidiruv uchun normallashtirish — trim + registrsiz.
 *
 * `lib/kategoriyaNom.ts` dagi dublikat qoidasi bilan bir xil bo'lishi shart
 * emas (u ichki bo'shliqni ham siqadi), lekin qidiruvda ham xuddi shu
 * funksiyani ishlatish "yozganim topilmadi" holatini oldini oladi.
 */
export function qidiruvMos(nomi: string, q: string): boolean {
  return nomi.trim().toLowerCase().includes(q.trim().toLowerCase());
}

/** Tab + qidiruv + holat filtri — sahifadagi YAGONA ro'yxat qoidasi. */
export function filtrla(
  royxat: Kategoriya[],
  tur: Tur,
  q: string,
  holat: HolatFiltr
): Kategoriya[] {
  return royxat.filter((c) => {
    if (c.turi !== tur) return false;
    if (holat === "faol" && !c.isActive) return false;
    if (holat === "nofaol" && c.isActive) return false;
    if (q.trim() && !qidiruvMos(c.nomi, q)) return false;
    return true;
  });
}
