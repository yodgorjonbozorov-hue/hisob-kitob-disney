/**
 * KASSA MAJBURIYLIGI — KLIENT VA SERVER UCHUN UMUMIY QOIDA.
 *
 * Bu fayl ataylab BOG'LANISHSIZ (prisma, next/server import qilmaydi):
 * brauzerdagi forma ham, API route ham AYNI matn va AYNI shartdan
 * foydalanishi kerak. Server tomondagi tekshiruv — lib/services/kassaTalab.ts.
 *
 * Audit K-1: kassa maydoni bo'sh qolganda yozuv jimgina foydalanuvchining
 * shaxsiy kassasiga tushardi. Endi ikkala qatlam ham bir xil to'xtatadi.
 */

/**
 * Kassa so'ralishi kerakmi. QARZ — pul kassaga umuman tushmagan
 * (majburiyat yozildi), shuning uchun kassa ham so'ralmaydi.
 */
export function kassaKerakmi(tolovTuri?: string | null): boolean {
  return tolovTuri !== "qarz";
}

/** Foydalanuvchiga ko'rinadigan matn — forma ham, API ham AYNI matnni beradi. */
export const KASSA_TANLANMADI =
  "Kassani tanlang — pul qaysi kassaga tushganini ko'rsatish shart";
