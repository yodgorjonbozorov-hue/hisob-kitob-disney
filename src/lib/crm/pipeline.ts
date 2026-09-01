/**
 * CRM ZAKAZ PIPELINE — USTUN QOIDALARI (SOF FUNKSIYALAR).
 *
 * Bu fayl ATAYLAB bazasiz: server ham, brauzer ham AYNI qoidadan
 * foydalanadi, shunda doska va statistika bir xil javob beradi.
 *
 * ENG MUHIM QAROR — "BUGUNGI" ALOHIDA HOLAT EMAS.
 * Zakaz sanasi kelganda uni "bugungi"ga ko'chiradigan hech narsa yozilmaydi:
 * ustun `holat` + `sana` dan HAR O'QISHDA hisoblanadi. Shu sabab:
 *   - kunlik cron kerak emas (ishlamay qolsa doska yolg'on ko'rsatardi);
 *   - admin qo'lda status almashtirmaydi;
 *   - kecha bajarilmagan zakaz yo'qolmaydi — u KUTILAYOTGAN ustunida
 *     "kechikkan" belgisi bilan qoladi (7-talab).
 *
 * SANA — ASIA/TASHKENT bo'yicha. "Bugun" ni chaqiruvchi `bugun` argumenti
 * bilan uzatadi (`todayTashkentDateOnlyString`), shunda UTC yarim tuni
 * zakazni bir kun oldin/keyin surib yubormaydi.
 */

// ---------------------------------------------------------------------------
// Ish jarayoni holati (Deal.holat)
// ---------------------------------------------------------------------------

export const ZAKAZ_HOLATLARI = ["KUTILMOQDA", "JARAYONDA", "YUTILDI", "YOQOTILDI"] as const;
export type ZakazHolat = (typeof ZAKAZ_HOLATLARI)[number];

export const ZAKAZ_HOLAT_NOMI: Record<ZakazHolat, string> = {
  KUTILMOQDA: "Kutilmoqda",
  JARAYONDA: "Jarayonda",
  YUTILDI: "Yutildi",
  YOQOTILDI: "Yo'qotildi",
};

/** Yopilgan holat — bosqich `yopilganAt` shu qoida bo'yicha yoziladi. */
export function yopiqHolat(holat: ZakazHolat): boolean {
  return holat === "YUTILDI" || holat === "YOQOTILDI";
}

// ---------------------------------------------------------------------------
// Doska ustunlari
// ---------------------------------------------------------------------------

/**
 * DOSKA USTUNLARI. `YOQOTILDI` — arxiv: asosiy 4 ustundan tashqarida turadi
 * va odatda ko'rsatilmaydi (16-talab: mobil gorizontal svayp 4 ustun bilan).
 */
export const USTUNLAR = ["KUTILAYOTGAN", "BUGUNGI", "JARAYONDA", "YUTILDI", "YOQOTILDI"] as const;
export type Ustun = (typeof USTUNLAR)[number];

/** Asosiy (ko'rinadigan) ustunlar — arxivsiz. */
export const ASOSIY_USTUNLAR: Ustun[] = ["KUTILAYOTGAN", "BUGUNGI", "JARAYONDA", "YUTILDI"];

export const USTUN_NOMI: Record<Ustun, string> = {
  KUTILAYOTGAN: "Kutilayotgan zakazlar",
  BUGUNGI: "Bugungi zakazlar",
  JARAYONDA: "Jarayonda",
  YUTILDI: "Yutildi",
  YOQOTILDI: "Yo'qotildi",
};

/**
 * ZAKAZ QAYSI USTUNDA TURADI.
 *
 *   YUTILDI/YOQOTILDI holati  → o'z ustuni (sana ahamiyatsiz);
 *   JARAYONDA holati          → "Jarayonda";
 *   KUTILMOQDA + sana = bugun → "Bugungi zakazlar";
 *   qolgani (kelajak, o'tgan  → "Kutilayotgan zakazlar".
 *   kun yoki sanasiz)
 *
 * O'TGAN KUN ATAYLAB "Kutilayotgan"da: bajarilmagan eski zakaz "Bugungi"dan
 * chiqib ketib ko'zdan yo'qolmasin (7-talab). U `kechikkanKun` bilan
 * belgilanadi va ustunning boshida turadi.
 */
export function zakazUstuni(holat: string, sana: string | null, bugun: string): Ustun {
  if (holat === "YUTILDI") return "YUTILDI";
  if (holat === "YOQOTILDI") return "YOQOTILDI";
  if (holat === "JARAYONDA") return "JARAYONDA";
  if (sana && sana === bugun) return "BUGUNGI";
  return "KUTILAYOTGAN";
}

const KUN_MS = 24 * 60 * 60 * 1000;

/**
 * Necha kun kechikkan (0 — kechikmagan). Faqat YAKUNLANMAGAN zakaz
 * kechikadi: yutilgan yoki yo'qotilgan zakazning sanasi o'tgani muammo emas.
 */
export function kechikkanKun(holat: string, sana: string | null, bugun: string): number {
  if (!sana) return 0;
  if (holat === "YUTILDI" || holat === "YOQOTILDI") return 0;
  const farq = Date.parse(`${bugun}T00:00:00.000Z`) - Date.parse(`${sana}T00:00:00.000Z`);
  return farq > 0 ? Math.round(farq / KUN_MS) : 0;
}

// ---------------------------------------------------------------------------
// To'lov holati
// ---------------------------------------------------------------------------

export const TOLOV_HOLATLARI = ["TOLANGAN", "QISMAN", "QARZ"] as const;
export type TolovHolat = (typeof TOLOV_HOLATLARI)[number];

export const TOLOV_HOLAT_NOMI: Record<TolovHolat, string> = {
  TOLANGAN: "To'langan",
  QISMAN: "Qisman to'langan",
  QARZ: "Qarzga",
};

/**
 * TO'LOV HOLATI — `tolangan` va `summa` dan HISOBLANADI, saqlanmaydi.
 * Alohida ustun ikkinchi haqiqat manbai bo'lardi va summa tahrirlanganda
 * jimgina yolg'onga aylanardi (`Debt.status` bilan bir xil qoida).
 *
 * YUTILDI — biznes yakuni, to'lov holati esa ALOHIDA o'lchov (5-talab):
 * zakaz yutilgan bo'lishi va shu bilan birga to'liq qarzga qolishi mumkin.
 */
export function tolovHolati(summa: number, tolangan: number): TolovHolat {
  if (summa <= 0) return "QARZ";
  if (tolangan >= summa) return "TOLANGAN";
  if (tolangan > 0) return "QISMAN";
  return "QARZ";
}

/** Yutilganda KIRIMga yoziladigan summa (to'langan qism, summadan oshmaydi). */
export function kirimUlushi(summa: number, tolangan: number): number {
  return Math.max(0, Math.min(tolangan, summa));
}

/** Yutilganda QARZDORLIKKA o'tadigan summa (qolgan qism). */
export function qarzUlushi(summa: number, tolangan: number): number {
  return Math.max(0, summa - kirimUlushi(summa, tolangan));
}
