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

export const TOLOV_HOLATLARI = ["TOLANGAN", "QISMAN", "QARZ", "TANLANMAGAN"] as const;
export type TolovHolat = (typeof TOLOV_HOLATLARI)[number];

export const TOLOV_HOLAT_NOMI: Record<TolovHolat, string> = {
  TOLANGAN: "To'langan",
  QISMAN: "Qisman to'langan",
  QARZ: "Qarzga",
  TANLANMAGAN: "To'lov tanlanmagan",
};

/** Foydalanuvchi "Qarzga" ni tanlaganda `Deal.tolovTuri` da turadigan qiymat. */
export const QARZ_KANALI = "qarz";

/**
 * TO'LOV HOLATI — FAQAT FOYDALANUVCHI TANLOVIDAN kelib chiqadi; saqlanmaydi,
 * `summa`, `tolangan` va `tolovTuri` dan HISOBLANADI (alohida ustun
 * ikkinchi haqiqat manbai bo'lardi va summa tahrirlanganda yolg'onga
 * aylanardi).
 *
 *   to'liq to'langan (tolangan >= summa)  → TOLANGAN
 *   qisman (0 < tolangan < summa)         → QISMAN (qolgani qarz)
 *   "Qarzga" tanlangan (tolovTuri="qarz") → QARZ
 *   boshqasi                              → TANLANMAGAN
 *
 * ESKI XATO: `tolangan = 0` ning o'zi "Qarzga" deb o'qilardi. Shunda to'lovi
 * hali belgilanmagan zakaz (bot orqali kelgan lead, narxsiz yaratilgan
 * zakaz, eski yozuv) foydalanuvchi tanlamasa ham "Qarzga" bo'lib ko'rinar
 * va YUTILDI bosilganda unga avtomatik QARZ ochilardi. Endi "Qarzga" faqat
 * foydalanuvchi shuni tanlaganda; tanlov yo'q — holat yo'q (TANLANMAGAN),
 * moliyaviy yozuv ham yo'q.
 *
 * YUTILDI — biznes yakuni, to'lov holati esa ALOHIDA o'lchov (5-talab):
 * zakaz yutilgan bo'lishi va shu bilan birga to'liq qarzga qolishi mumkin.
 */
export function tolovHolati(summa: number, tolangan: number, tolovTuri: string | null | undefined): TolovHolat {
  if (summa > 0 && tolangan >= summa) return "TOLANGAN";
  if (tolangan > 0) return "QISMAN";
  if (tolovTuri === QARZ_KANALI) return "QARZ";
  return "TANLANMAGAN";
}

/** Yutilganda KIRIMga yoziladigan summa (haqiqatda olingan qism, summadan oshmaydi). */
export function kirimUlushi(summa: number, tolangan: number): number {
  return Math.max(0, Math.min(tolangan, summa));
}

/**
 * Yutilganda QARZDORLIKKA o'tadigan summa (qolgan qism).
 *
 * FAQAT foydalanuvchi tanlovi bo'lganda: qisman to'lovda qolgani, "Qarzga"
 * tanlanganda butun summa. To'lov tanlanmagan zakazga qarz OCHILMAYDI —
 * YUTILDI bilan QARZ orasidagi avtomatik bog'lanish ataylab yo'q.
 */
export function qarzUlushi(summa: number, tolangan: number, tolovTuri: string | null | undefined): number {
  const holat = tolovHolati(summa, tolangan, tolovTuri);
  if (holat !== "QISMAN" && holat !== "QARZ") return 0;
  return Math.max(0, summa - kirimUlushi(summa, tolangan));
}

// ---------------------------------------------------------------------------
// Ustun ichidagi tartib
// ---------------------------------------------------------------------------

/**
 * Tartiblash uchun kerak bo'ladigan MINIMAL maydonlar. Server (Prisma `Date`)
 * ham, brauzer (ISO matn) ham ayni funksiyani chaqiradi — shuning uchun vaqt
 * ikkala ko'rinishda qabul qilinadi.
 */
export interface TartibZakaz {
  holat: string;
  sana: string | null;
  /** Holat oxirgi marta o'zgargan vaqt (`Deal.holatAt`). */
  holatAt?: string | Date | null;
  /** Yopilgan vaqt — eski yozuvlar uchun zaxira manba. */
  yopilganAt?: string | Date | null;
  createdAt: string | Date;
}

function vaqtMs(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  const ms = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * ZAKAZ QACHON JORIY HOLATIGA O'TGAN (ms).
 *
 * Manbalar tartibi migratsiyadagi to'ldirish qoidasi bilan AYNI:
 * `holatAt` → `yopilganAt` → `createdAt`. Shu bois migratsiya qo'llanmagan
 * (yoki eski) yozuv ham to'g'ri joyda turadi, "0" bo'lib tepaga/pastga
 * otilib ketmaydi.
 */
export function holatVaqti(z: TartibZakaz): number {
  return vaqtMs(z.holatAt) ?? vaqtMs(z.yopilganAt) ?? vaqtMs(z.createdAt) ?? 0;
}

/**
 * USTUN ICHIDAGI TARTIB — ikki xil mantiq, ustunning MA'NOSIGA qarab.
 *
 * YUTILDI / YOQOTILDI / JARAYONDA — TARIX ustunlari: zakaz shu holatga
 * o'tgani muhim voqea. Eng oxirgi o'tgani ENG TEPADA (kamayish tartibi),
 * chunki odam endigina bosgan zakazni darhol ko'rishi kerak. Zakaz sanasi
 * bu yerda tartibga TA'SIR QILMAYDI: eski sanali zakaz bugun yutilsa ham
 * tepada turadi.
 *
 * KUTILAYOTGAN / BUGUNGI — REJA ustunlari: bu yerda "qachon bajarish kerak"
 * muhim, "qachon holat o'zgargani" emas. Shuning uchun avvalgi qoida
 * saqlanadi (7-talab): kechikkanlar eng tepada, keyin yaqin kun.
 *
 * Teng qiymatlarda holat vaqti bo'yicha (yangi tepada) — tartib barqaror
 * bo'lsin, har render'da kartalar joyini almashtirmasin.
 */
export function zakazlarniTartibla<T extends TartibZakaz>(zakazlar: T[], ustun: Ustun, bugun: string): T[] {
  const yangiOldin = (a: T, b: T) => holatVaqti(b) - holatVaqti(a);

  if (ustun === "YUTILDI" || ustun === "YOQOTILDI" || ustun === "JARAYONDA") {
    return [...zakazlar].sort(yangiOldin);
  }

  return [...zakazlar].sort((a, b) => {
    const ka = kechikkanKun(a.holat, a.sana, bugun);
    const kb = kechikkanKun(b.holat, b.sana, bugun);
    if (ka !== kb) return kb - ka;
    const sa = a.sana ?? "9999-99-99";
    const sb = b.sana ?? "9999-99-99";
    if (sa !== sb) return sa.localeCompare(sb);
    return yangiOldin(a, b);
  });
}
