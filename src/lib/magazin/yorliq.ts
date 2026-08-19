/**
 * YORLIQ (STIKER) O'LCHAMLARI — QR chop etish uchun.
 *
 * NEGA A4 EMAS: do'konlarda termal stiker printeri ishlatiladi (Xprinter,
 * Zebra va h.k.). U rulondan BITTALAB yorliq beradi, ya'ni chop etishda har
 * yorliq ALOHIDA SAHIFA bo'lishi va sahifa o'lchami yorliq o'lchamiga teng
 * bo'lishi kerak. A4 ga bir nechta stiker joylash oddiy printer uchun to'g'ri,
 * termal printer uchun esa umuman ishlamaydi — u qog'ozni noto'g'ri uzadi.
 *
 * Shu bois bu yerdagi har o'lcham `@page { size: ... }` ga aynan tushadi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface YorliqOlchami {
  code: string;
  /** Foydalanuvchi ko'radigan nom. */
  nomi: string;
  /** Sahifa (yorliq) kengligi, mm. */
  kengMm: number;
  /** Sahifa (yorliq) balandligi, mm. */
  balandMm: number;
  /** QR tomoni, mm — yorliq ichida qancha joy egallaydi. */
  qrMm: number;
  /** Tovar nomi shrifti, pt. */
  nomPt: number;
  /** Kalit (BALANSA-PRODUCT-...) shrifti, pt. */
  kodPt: number;
}

/**
 * Bozorda eng ko'p uchraydigan rulon o'lchamlari.
 *
 * QR tomoni ATAYLAB yorliq balandligidan kichik: yon-veriga "sokin zona"
 * (quiet zone) va nom uchun joy qolishi kerak. Skanerlar QR chetida bo'sh
 * oq maydon bo'lmasa o'qiy olmaydi.
 *
 * 2D skanerlar uchun 15 mm dan katta QR bemalol yetarli — 20 mm esa
 * qo'l skaneri bilan tez va ishonchli o'qiladi.
 */
export const YORLIQ_OLCHAMLARI: YorliqOlchami[] = [
  { code: "40x30", nomi: "40 × 30 mm", kengMm: 40, balandMm: 30, qrMm: 19, nomPt: 6.5, kodPt: 4.5 },
  { code: "58x40", nomi: "58 × 40 mm", kengMm: 58, balandMm: 40, qrMm: 26, nomPt: 8, kodPt: 5.5 },
  { code: "40x25", nomi: "40 × 25 mm", kengMm: 40, balandMm: 25, qrMm: 16, nomPt: 6, kodPt: 4 },
  // Eng kichigi: nom sig'maydi, faqat QR + kalit oxiri. Mayda tovarlar uchun.
  { code: "30x20", nomi: "30 × 20 mm (faqat QR)", kengMm: 30, balandMm: 20, qrMm: 14, nomPt: 0, kodPt: 3.5 },
];

/** Standart o'lcham — eng keng tarqalgani. */
export const STANDART_YORLIQ = "40x30";

export function yorliqByCode(code: string): YorliqOlchami {
  return YORLIQ_OLCHAMLARI.find((y) => y.code === code) ?? YORLIQ_OLCHAMLARI[0];
}

/**
 * Bitta chop etish yurishida beriladigan maksimal yorliq.
 *
 * Har QR ~7 KB SVG bo'lgani uchun 500 yorliq ~3.5 MB sahifa demakdir —
 * brauzerning chop etish oynasi bunda qotib qoladi. Chegara ochiq
 * ko'rsatiladi, jimgina kesib tashlanmaydi.
 */
export const MAKS_YORLIQ = 300;
