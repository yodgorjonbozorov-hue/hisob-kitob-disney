/**
 * OMBOR TABLARI — sahifa va klient komponentlar uchun yagona ro'yxat.
 *
 * Tab URL'da (`?tab=...`) turadi, lokal state'da emas: shu bois sahifani
 * yangilash yoki havolani ulashish foydalanuvchini o'sha joyga qaytaradi va
 * server faqat KERAKLI tab ma'lumotini yuklaydi.
 */
export const OMBOR_TABLAR = [
  { kalit: "mahsulotlar", nomi: "Mahsulotlar" },
  { kalit: "taminotlar", nomi: "Ta'minotlar" },
  { kalit: "inventarizatsiya", nomi: "Inventarizatsiya" },
] as const;

export type OmborTab = (typeof OMBOR_TABLAR)[number]["kalit"];
