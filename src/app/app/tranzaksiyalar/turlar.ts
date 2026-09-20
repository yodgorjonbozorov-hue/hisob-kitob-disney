import { tolovGuruhi, TOLOV_GURUHI_NOMI, TOLOV_GURUHI_BELGI } from "@/lib/tolovBolimi";
import { buOyDavri } from "@/lib/date";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";
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

/**
 * Formada tanlanadigan KASSA. `turi` va `egaIsm` faqat variant ostidagi
 * izoh uchun — QOLDIQ bu yerda uzatilmaydi (u maxfiy, "kassa.jami" huquqi).
 */
export interface AccountOption {
  id: string;
  nomi: string;
  turi?: string;
  egaIsm?: string | null;
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
  /** `hammasi` — standart "Bu oy" davri ataylab o'chirilgan (butun tarix). */
  davr: string;
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
  davr: "",
};

/**
 * STANDART DAVR — sahifa hech qanday filtrsiz ochilganda ko'rsatiladigan
 * oraliq. Server (app/tranzaksiyalar/page.tsx) ham AYNI funksiyani ishlatadi.
 */
export function standartDavr(): { from: string; to: string } {
  return buOyDavri();
}

/** Davr foydalanuvchi tomonidan o'zgartirilganmi (standart "Bu oy" emasmi). */
export function davrFiltriFaol(f: FiltrQiymati): boolean {
  if (f.davr === "hammasi") return true;
  const s = standartDavr();
  return f.from !== s.from || f.to !== s.to;
}

/**
 * Nechta filtr faol — mobil "Filter (3)" belgisi uchun.
 *
 * STANDART DAVR SANALMAYDI: sahifa endi har doim "Bu oy" bilan ochiladi
 * (audit K-7), va uni filtr deb ko'rsatish har kirishda "2 ta filtr faol"
 * degan soxta ogohlantirish berardi.
 */
export function faolFiltrSoni(f: FiltrQiymati): number {
  const { from: _from, to: _to, davr: _davr, ...qolgani } = f;
  return Object.values(qolgani).filter(Boolean).length + (davrFiltriFaol(f) ? 1 : 0);
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

/**
 * Kassa variantining ostidagi kichik izoh: shaxsiy kassa egasi yoki kassa
 * turi. Yaratish va TAHRIR formalari bittasidan foydalanadi.
 *
 * SUMMA ATAYLAB YO'Q: kassa qoldig'i "kassa.jami" huquqiga bog'liq maxfiy
 * ma'lumot (tests/kassa-maxfiylik.test.ts) — uni tanlov ro'yxatida
 * ko'rsatish har bir xodimga barcha kassalar qoldig'ini ochib berardi.
 */
export function kassaTavsifi(a: AccountOption): string | undefined {
  if (a.egaIsm) return `Shaxsiy · ${a.egaIsm}`;
  return a.turi ? (ACCOUNT_TURI_NOMI[a.turi as AccountTuri] ?? a.turi) : undefined;
}

/**
 * KLIENTDAN KETADIGAN SO'ROVLAR UCHUN EFFEKTIV FILTR.
 *
 * URL'da davr bo'lmasa sahifa standart "Bu oy" ni qo'llaydi (audit K-7),
 * shuning uchun eksport va kategoriya ichini yuklash ham SHU davrni olib
 * yurishi shart — aks holda ekrandagi summa bilan ro'yxat mos kelmasdi.
 */
export function effektivFiltrQuery(url: string, f: FiltrQiymati): string {
  const p = new URLSearchParams(url);
  for (const [kalit, qiymat] of [
    ["from", f.from],
    ["to", f.to],
  ] as const) {
    if (qiymat) p.set(kalit, qiymat);
    else p.delete(kalit);
  }
  return p.toString();
}
