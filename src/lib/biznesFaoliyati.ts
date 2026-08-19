/**
 * BIZNES FAOLIYATI — biznes yaratishda so'raladigan savol va uning javobiga
 * mos boshlang'ich sozlamalar.
 *
 * Nega kerak: Balansa modul tizimida "qaysi bo'lim kerak" degan qaror
 * foydalanuvchida. Lekin do'kon ochayotgan odam "ombor yuritiladimi" va
 * "magazin yuritiladimi" degan texnik savollarga emas, "biznesingiz qanday
 * ishlaydi" degan oddiy savolga javob bera oladi. Shu bois javob shu yerda
 * bayroqlarga o'giriladi.
 *
 * MUHIM: bu faqat BOSHLANG'ICH holat. Foydalanuvchi keyin Sozlamalar →
 * Modullar va Bizneslar bo'limidan istalganini o'zgartira oladi, ya'ni
 * "biznes turi" hech narsani qulflab qo'ymaydi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface Faoliyat {
  code: string;
  nomi: string;
  tavsif: string;
  /** Biznes rejimi (`Business.turi`). */
  turi: "umumiy" | "avto";
  /** Ombor (mahsulot qoldig'i) yuritiladimi. */
  omborli: boolean;
  /** Do'kon kassasi (POS) yuritiladimi. */
  magazin: boolean;
}

export const FAOLIYATLAR: Faoliyat[] = [
  {
    code: "xizmat",
    nomi: "Xizmat ko'rsatish",
    tavsif: "Tovar sotmaydi: SMM, ta'lim, logistika, ta'mirlash, konsalting va h.k.",
    turi: "umumiy",
    omborli: false,
    magazin: false,
  },
  {
    code: "mahsulot",
    nomi: "Mahsulot sotish (kassasiz)",
    tavsif:
      "Tovar sotiladi va qoldiq yuritiladi, lekin kassa (skaner, chek) kerak emas — " +
      "masalan buyurtma asosida sotuv yoki gul do'koni.",
    turi: "umumiy",
    omborli: true,
    magazin: false,
  },
  {
    code: "dokon",
    nomi: "Do'kon / chakana savdo",
    tavsif:
      "Kassada skaner bilan sotiladi: shtrix-kod, savat, chek. Ombor va magazin " +
      "moduli birga yoqiladi.",
    turi: "umumiy",
    omborli: true,
    magazin: true,
  },
  {
    code: "ulgurji",
    nomi: "Ulgurji savdo",
    tavsif: "Katta partiyalarda sotuv: ombor va qarzdorlik yuritiladi, kassa ixtiyoriy.",
    turi: "umumiy",
    omborli: true,
    magazin: false,
  },
  {
    code: "avto",
    nomi: "Avto olib-sotish",
    tavsif: "Har mashina alohida hisoblanadi: avtopark, mashina bo'yicha sof foyda.",
    turi: "avto",
    omborli: true,
    magazin: false,
  },
  {
    code: "boshqa",
    nomi: "Boshqa",
    tavsif: "Kerakli bo'limlarni keyin Sozlamalar → Modullar bo'limidan yoqasiz.",
    turi: "umumiy",
    omborli: false,
    magazin: false,
  },
];

export function faoliyatByCode(code: string | null | undefined): Faoliyat | null {
  if (!code) return null;
  return FAOLIYATLAR.find((f) => f.code === code) ?? null;
}

/**
 * Faoliyat tanlanganda yoqilishi kerak bo'lgan modul kodlari.
 *
 * DIQQAT: bu ro'yxat faqat YOQADI, hech qachon o'chirmaydi — mavjud biznes
 * yoki tenantning modullariga ta'sir qilmasligi uchun.
 */
export function faoliyatModullari(f: Faoliyat): string[] {
  const kodlar: string[] = [];
  if (f.omborli) kodlar.push("OMBOR");
  if (f.magazin) kodlar.push("MAGAZIN");
  return kodlar;
}
