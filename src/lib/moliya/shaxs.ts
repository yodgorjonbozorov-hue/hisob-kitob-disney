/**
 * PUL KIMDAN OLINDI / KIMGA BERILDI — tomon (shaxs) katalogi.
 *
 * Nega yangi jadval emas: tizimda odamlar allaqachon uch xil joyda yashaydi
 * va ular BIRLASHTIRILMAYDI (har biri boshqa munosabat):
 *   - `Contact`  — mijoz (bizga qarzdor bo'ladi);
 *   - `Supplier` — ta'minotchi (biz unga qarzdormiz);
 *   - `User`     — xodim (oylik, avans, shaxsiy kassa).
 * To'rtinchi "moliya kontragenti" jadvali ochilsa, bir odam ikki joyda
 * turib ikki xil qarz ko'rsatardi. Shuning uchun bu yerda faqat TOMON TURI
 * va uning IDsi saqlanadi — manba jadval o'zgarmaydi.
 *
 * "shaxs", "filial" va "boshqa" — kartochkasiz tomonlar: ular uchun faqat
 * nom yoziladi (`shaxsId` null). Bu ataylab: usta, haydovchi yoki qo'shni
 * filial uchun kartochka ochib o'tirish kundalik ishni sekinlashtirardi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export const SHAXS_TURLARI = [
  "mijoz",
  "taminotchi",
  "xodim",
  "shaxs",
  "filial",
  "boshqa",
] as const;

export type ShaxsTuri = (typeof SHAXS_TURLARI)[number];

export function isShaxsTuri(v: unknown): v is ShaxsTuri {
  return SHAXS_TURLARI.includes(v as ShaxsTuri);
}

/** Kirim formasi: "Pul kimdan olindi?" */
export const SHAXS_KIMDAN: Record<ShaxsTuri, string> = {
  mijoz: "Mijoz",
  taminotchi: "Ta'minotchi",
  xodim: "Xodim",
  shaxs: "Boshqa shaxs",
  filial: "Filial",
  boshqa: "Boshqa",
};

/** Chiqim formasi: "Pul kimga berildi?" — yorliqlar bir xil, tartib boshqa. */
export const SHAXS_KIMGA: Record<ShaxsTuri, string> = SHAXS_KIMDAN;

/**
 * TARTIB — eng ko'p ishlatiladigani birinchi (video referensidagi tezlik).
 * Kirimda pul ko'pincha mijozdan keladi, chiqimda ta'minotchiga ketadi.
 */
export const KIRIM_SHAXS_TARTIBI: ShaxsTuri[] = [
  "mijoz",
  "taminotchi",
  "xodim",
  "shaxs",
  "filial",
  "boshqa",
];

export const CHIQIM_SHAXS_TARTIBI: ShaxsTuri[] = [
  "taminotchi",
  "xodim",
  "mijoz",
  "shaxs",
  "filial",
  "boshqa",
];

/**
 * KARTOCHKALI TOMONLARmi — shundaylari uchun bazadan qidiruv ochiladi
 * (`/api/moliya/shaxslar`), qolganlarida oddiy matn maydoni qoladi.
 */
export function kartochkaliMi(turi: ShaxsTuri): boolean {
  return turi === "mijoz" || turi === "taminotchi" || turi === "xodim";
}

/**
 * QARZ YO'NALISHI — shu tomon bilan qanday qarz bo'lishi mumkin.
 *
 * Mijoz BIZGA qarzdor ("olinadigan"), ta'minotchiga esa BIZ qarzdormiz
 * ("beriladigan"). Xodim ikkalasi ham bo'lishi mumkin (avans oldi — bizga
 * qarzdor; biz unga oylik qarzdormiz), shuning uchun uning yo'nalishi
 * amalning yo'nalishidan chiqariladi.
 */
export function qarzYonalishi(
  shaxsTuri: ShaxsTuri,
  yonalish: "kirim" | "chiqim"
): "olinadigan" | "beriladigan" {
  if (shaxsTuri === "mijoz") return "olinadigan";
  if (shaxsTuri === "taminotchi") return "beriladigan";
  // Qolganlari: pul KELSA kimdir bizga qarzdor edi, pul KETSA biz qarzdor edik.
  return yonalish === "kirim" ? "olinadigan" : "beriladigan";
}
