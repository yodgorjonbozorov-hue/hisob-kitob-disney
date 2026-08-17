/** Yozuvlar sahifasi komponentlari (ro'yxat + tahrirlash oynasi) uchun umumiy tur. */
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
