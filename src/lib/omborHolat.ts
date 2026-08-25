/**
 * MAHSULOT HOLATI — "Yetarli / Kam qolgan / Tugagan".
 *
 * NEGA ALOHIDA FAYL: qoidani ham server so'rovlari (`lib/queries/ombor.ts`),
 * ham brauzerdagi kartochka ishlatadi. Agar u so'rov faylida qolsa, klient
 * komponent uni import qilishi bilan butun ma'lumotlar bazasi qatlami
 * (prisma, `pg`) brauzer to'plamiga tortilardi — Next.js build'i aynan shu
 * sababdan yiqiladi.
 *
 * Bu yerda faqat sof funksiya va matn bor — hech qanday server importi yo'q.
 */

export type MahsulotHolati = "yetarli" | "kam" | "tugagan";

/**
 * Chegarasi belgilanmagan mahsulot hech qachon "kam" bo'lmaydi: tuxum
 * sotuvchi bilan avtosalon uchun bitta sobit chegara ma'nosiz (ilgari butun
 * tizimda 5 dona edi). Nol qoldiq esa alohida holat — "Tugagan".
 */
export function mahsulotHolati(miqdor: number, minQoldiq: number): MahsulotHolati {
  if (miqdor <= 0) return "tugagan";
  if (minQoldiq > 0 && miqdor <= minQoldiq) return "kam";
  return "yetarli";
}

export const HOLAT_NOMI: Record<MahsulotHolati, string> = {
  yetarli: "Yetarli",
  kam: "Kam qolgan",
  tugagan: "Tugagan",
};

export const HOLAT_BELGI: Record<MahsulotHolati, string> = {
  yetarli: "\u{1F7E2}",
  kam: "\u{1F7E0}",
  tugagan: "\u{1F534}",
};
