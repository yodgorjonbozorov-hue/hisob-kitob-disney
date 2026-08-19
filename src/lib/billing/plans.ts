/** Tarif rejalari. Hozircha bitta STANDARD; keyinchalik shu ro'yxatga qo'shiladi. */
export interface Plan {
  code: string;
  nomi: string;
  /** Oylik narx (so'm). */
  oylikNarx: number;
  tavsif: string;
  /** Bu tarifda ochiq modullar (lib/modules/registry.ts kodlari). Core modullar har doim ochiq. */
  modullar: string[];
}

export const PLANLAR: Plan[] = [
  {
    code: "STANDARD",
    nomi: "Standart",
    oylikNarx: 199_000,
    tavsif: "Cheksiz biznes, foydalanuvchi va tranzaksiya · Hisobotlar (PDF/Excel) · Telegram bot",
    // MAGAZIN — Standartga kiritilgan: bu tarif allaqachon OMBOR (savdo)
    // bilan keladi va do'kon uchun kassa uning tabiiy davomi. Tarifda
    // borligi modulni YOQMAYDI: tenant uni Sozlamalar → Modullar'dan
    // o'zi yoqadi, ya'ni mavjud mijozlarda hech narsa o'zgarmaydi.
    modullar: ["MOLIYA", "OMBOR", "KUNLIK", "MAGAZIN"],
  },
  {
    code: "AVTO",
    nomi: "Avto",
    tavsif:
      "Avto olib-sotarlar uchun: avtopark (har mashina alohida), har mashina bo'yicha sof foyda, ikki tomonlama qarzdorlik · Hisobotlar · Telegram bot",
    oylikNarx: 200_000,
    modullar: ["MOLIYA", "OMBOR", "KUNLIK"],
  },
  {
    code: "PRO",
    nomi: "Pro",
    oylikNarx: 399_000,
    tavsif:
      "Standart'dagi hammasi + Xarid (ta'minotchi, buyurtma, qabul qilish) + CRM (bitimlar kanbani, kontaktlar) + Vazifalar + AI yordamchi",
    modullar: [
      "MOLIYA", "OMBOR", "KUNLIK", "MAGAZIN", "XARID", "TASDIQLASH",
      "MIJOZLAR", "HR", "HUJJATLAR", "CRM", "VAZIFALAR", "AI",
    ],
  },
  {
    // DO'KON tarifi — chakana savdo uchun to'plam. Kelajakda modul-tarif
    // bog'lanishi shu yerdan kengaytiriladi: to'lov/obuna tizimiga
    // TEGILMAGAN, tarif faqat "qaysi modul ochiq" ro'yxatidan iborat.
    code: "SHOP",
    nomi: "Do'kon",
    oylikNarx: 299_000,
    tavsif:
      "Do'kon va chakana savdo uchun: kassa (POS), shtrix-kod va QR, ombor qoldig'i, " +
      "xarid va ta'minotchilar, mijozlar kartochkasi · Hisobotlar · Telegram bot",
    modullar: ["MOLIYA", "OMBOR", "KUNLIK", "MAGAZIN", "XARID", "MIJOZLAR"],
  },
];

export function planByCode(code: string): Plan | null {
  return PLANLAR.find((p) => p.code === code) ?? null;
}

/** Obuna davri uzunligi (kun). */
export const OBUNA_DAVRI_KUN = 30;
