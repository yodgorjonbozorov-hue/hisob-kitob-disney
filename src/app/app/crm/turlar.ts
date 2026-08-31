/** CRM kunlik buyurtmalari — mijoz (brauzer) tomonidagi umumiy turlar. */

export interface StageDTO {
  id: string;
  nomi: string;
  turi: string; // OPEN | WON | LOST
}

/** KIRIM kategoriyasi — Kirim modulidagi aynan o'sha kategoriya. */
export interface KategoriyaDTO {
  id: string;
  nomi: string;
}

export interface XodimDTO {
  id: string;
  ism: string;
}

/** Kategoriya a'zosi (Employee) — zakaz formasining selektorlari uchun. */
export interface XodimAzoDTO {
  id: string;
  ism: string;
  /** Tizim hisobi (User.id) — o'z-o'zini oldindan tanlash uchun. */
  userId: string | null;
}

/** Xodim kategoriyasi (Sotuvchi/Diktor/...) — faol a'zolari bilan. */
export interface XodimKategoriyaDTO {
  id: string;
  nomi: string;
  /** "sotuvchi" | "ijrochi" — sotuvchi selektorida joriy xodim oldindan tanlanadi. */
  turi: string;
  azolar: XodimAzoDTO[];
}

/** Zakazga biriktirilgan xodim (tafsilot oynasi ko'rsatadi). */
export interface ZakazXodimDTO {
  id: string;
  categoryId: string;
  kategoriyaNomi: string;
  kategoriyaTuri: string;
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
}

export interface BuyurtmaDTO {
  id: string;
  /** Xizmat/buyurtma nomi. */
  nomi: string;
  summa: number;
  stageId: string;
  categoryId: string | null;
  kategoriya: string | null;
  kontakt: string | null;
  tel: string | null;
  /** "YYYY-MM-DD" yoki null. */
  sana: string | null;
  izoh: string | null;
  masulId: string;
  masulIsm: string | null;
  /** Bog'langan kirim tranzaksiyasi — null bo'lsa kirim hali yozilmagan. */
  transactionId: string | null;
}

export interface KunlikXulosaDTO {
  sana: string;
  jami: number;
  kirimga: number;
  kutilmoqda: number;
  soni: number;
}

export interface KategoriyaStatDTO {
  categoryId: string | null;
  nomi: string;
  soni: number;
  jami: number;
  kirimga: number;
  kutilmoqda: number;
}

/**
 * Kirim yozuviga havola. Tranzaksiyalar sahifasida ID bo'yicha filtr yo'q,
 * shuning uchun mavjud filtrlar bilan aniq yozuvgacha toraytiriladi.
 */
export function kirimHavolasi(b: BuyurtmaDTO): string {
  const p = new URLSearchParams({ turi: "kirim" });
  if (b.categoryId) p.set("categoryId", b.categoryId);
  if (b.sana) {
    p.set("from", b.sana);
    p.set("to", b.sana);
  }
  p.set("q", b.nomi);
  return `/app/tranzaksiyalar?${p.toString()}`;
}
