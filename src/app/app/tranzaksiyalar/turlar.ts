import { tolovGuruhi, TOLOV_GURUHI_NOMI, TOLOV_GURUHI_BELGI } from "@/lib/tolovBolimi";
import type { TransactionDTO } from "@/lib/queries/transactions";

/** Kirim/Chiqim sahifasi komponentlari (forma, ro'yxat, tafsilot) uchun umumiy turlar. */
export interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
  /**
   * KG SAVDOSI kategoriyasi (mijozga xos — Fortex Selos): summa qo'lda
   * kiritilmaydi, miqdor (kg) × 1 kg narxidan chiqadi.
   */
  kgAsosli?: boolean;
}

export interface XodimOption {
  id: string;
  ism: string;
}

/** Ro'yxat/filtrda foydalaniladigan URL filtr qiymatlari (bo'sh satr — filtrsiz). */
export interface FiltrQiymati {
  from: string;
  to: string;
  turi: string;
  tolov: string;
  categoryId: string;
  xodimId: string;
  q: string;
  minSumma: string;
  maxSumma: string;
}

export const BOSH_FILTR: FiltrQiymati = {
  from: "",
  to: "",
  turi: "",
  tolov: "",
  categoryId: "",
  xodimId: "",
  q: "",
  minSumma: "",
  maxSumma: "",
};

/** Nechta filtr faol — mobil "Filter (3)" belgisi uchun. */
export function faolFiltrSoni(f: FiltrQiymati): number {
  return Object.values(f).filter(Boolean).length;
}

/**
 * Yozuvning to'lov usuli — YAGONA qoida `lib/tolovBolimi.ts` dan olinadi:
 * aniq `tolovTuri` ustun, bo'lmasa kassa turidan, kassasiz eski yozuv — naqd.
 * Shu tufayli ro'yxatdagi belgi bilan yuqoridagi taqsimot HECH QACHON
 * bir-biriga zid bo'lmaydi.
 */
export function tolovYorligi(t: {
  tolovTuri: string | null;
  account?: { turi: string } | null;
}): string {
  const guruh = tolovGuruhi(t.tolovTuri, t.account?.turi ?? null);
  return `${TOLOV_GURUHI_BELGI[guruh]} ${TOLOV_GURUHI_NOMI[guruh]}`;
}

/** Yozuvni tahrirlash/o'chirish mumkinmi (RBAC oynasi — server baribir qayta tekshiradi). */
export function ozgartirsaBoladi(
  t: TransactionDTO,
  currentUserId: string,
  manager: boolean
): boolean {
  return manager || t.userId === currentUserId;
}
