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

/** Xodim lavozimi (Sotuvchi/Animator/Videochi/...) — faol a'zolari bilan. */
export interface XodimKategoriyaDTO {
  id: string;
  nomi: string;
  /** "sotuvchi" | "ijrochi" — sotuvchi selektorida joriy xodim oldindan tanlanadi. */
  turi: string;
  /** Bir zakazga bir nechta xodim (Videochilar, Bezakchilar). */
  kopXodim: boolean;
  azolar: XodimAzoDTO[];
}

/**
 * ZAKAZNI OLGAN SOTUVCHI. Ijrochilardan (ZakazXodimDTO) ATAYLAB alohida
 * tur: sotuvchi — birinchi darajali maydon, statistika va bonus shunga
 * bog'lanadi (38-talab).
 */
export interface SotuvchiDTO {
  /** Employee.id */
  id: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  /** Tizim hisobi (User.id) — avto-tanlash uchun. */
  userId: string | null;
}

/** Zakazga biriktirilgan sotuvchi (doskada va tafsilotda ko'rinadi). */
export interface ZakazSotuvchiDTO {
  employeeId: string;
  ism: string;
  isActive: boolean;
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
  isActive: boolean;
  /** Sifat nazorati bahosi (1..10) yoki null. */
  baho: number | null;
}

export interface BuyurtmaDTO {
  id: string;
  /** Xizmat/zakaz nomi. */
  nomi: string;
  summa: number;
  /** Haqiqatda olingan pul — to'lov holati shundan hisoblanadi. */
  tolangan: number;
  /** Pul kanali: "naqd" | "click" | "qarz" (yoki null). */
  tolovTuri: string | null;
  /** Ish jarayoni holati: KUTILMOQDA | JARAYONDA | YUTILDI | YOQOTILDI. */
  holat: string;
  stageId: string;
  categoryId: string | null;
  kategoriya: string | null;
  kontakt: string | null;
  tel: string | null;
  /**
   * ZAKAZ SANASI "YYYY-MM-DD" — xizmat qaysi kunga belgilangan (UI'da
   * ko'rinadigan asosiy sana). `createdAt` bilan aralashtirilmaydi.
   */
  sana: string | null;
  /**
   * ZAKAZ QACHON JORIY HOLATIGA O'TGAN (ISO). Doska ustuni ichidagi tartib
   * SHU maydondan hisoblanadi — "Yutildi"ga endigina o'tgan zakaz eng tepada
   * turadi (`lib/crm/pipeline.ts` → `zakazlarniTartibla`).
   */
  holatAt: string | null;
  /** Yopilgan vaqt (ISO) — `holatAt` yo'q eski yozuvlar uchun zaxira. */
  yopilganAt: string | null;
  /** Yaratilish vaqti (ISO) — oxirgi zaxira tartib kaliti. */
  createdAt: string;
  izoh: string | null;
  masulId: string;
  masulIsm: string | null;
  /** Bog'langan kirim tranzaksiyasi — null bo'lsa kirim hali yozilmagan. */
  transactionId: string | null;
  /** Yakunlashda ochilgan qarz yozuvi (to'lanmagan qism). */
  debtId: string | null;
  /** Kirimga o'tgan REAL summa (tranzaksiyadan; o'chirilgani 0). */
  kirimSumma: number;
  /** Ochilgan qarzning qoldig'i (qarz yozuvidan). */
  qarzQoldiq: number;
  /** Zakazni olgan sotuvchi (biriktirilmagan bo'lsa null). */
  sotuvchi: ZakazSotuvchiDTO | null;
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

/**
 * Ochilgan qarzga havola. Qarzdorlik sahifasi faqat `turi` filtrini
 * o'qiydi (mijoz bo'yicha qidiruv sahifaning o'zida) — shuning uchun
 * havola olinadigan qarzlar ro'yxatini ochadi.
 */
export const QARZ_HAVOLASI = "/app/qarzlar?turi=olinadigan";
