import type { Prisma } from "@prisma/client";

/**
 * SHAXSIY KASSA REJIMI — yozuv qaysi kassaga tushishini hal qiladi.
 *
 * Oddiy rejimda naqd yozuv biznesning UMUMIY naqd kassasiga tushadi. Shaxsiy
 * kassa rejimida (`Business.shaxsiyKassa`) esa u yozuvni KIRITGAN xodimning
 * o'z kassasiga tushadi. Shu bitta o'zgarish tufayli "kimning qo'lida qancha
 * naqd bor" savoliga ledger javob beradi — alohida ikkinchi hisob kerak emas.
 *
 * QOIDA: faqat NAQD. Click/plastik pul xodimning qo'liga tushmaydi — u
 * terminal kassasida qoladi. Qarz esa umuman pul emas.
 *
 * Bayroq o'chirilgan bizneslarda bu modul har doim `null` qaytaradi, ya'ni
 * eski xatti-harakat bir bitga ham o'zgarmaydi.
 */

/**
 * `prisma` ham, tranzaksiya ichidagi xom `tx` ham qanoatlantiradigan shakl.
 * Prisma delegatlarining o'zidan olinadi — qo'lda yozilgan imzo generik
 * `SelectSubset` bilan mos kelmaydi.
 */
export type KassaOquvchi = Pick<Prisma.TransactionClient, "account" | "business">;

/** Naqd to'lovmi — to'lov turi ko'rsatilmagan eski yozuvlar ham naqd hisoblanadi. */
export function naqdTolovmi(tolovTuri?: string | null): boolean {
  return !tolovTuri || tolovTuri === "naqd";
}

/**
 * Shaxsiy kassa rejimida xodimning o'z kassasi. Rejim o'chiq bo'lsa, to'lov
 * naqd bo'lmasa yoki xodimning kassasi hali ochilmagan bo'lsa — `null`
 * (chaqiruvchi odatdagi kassa tanlashga qaytadi).
 */
export async function shaxsiyKassaId(
  db: KassaOquvchi,
  businessId: string,
  userId: string | null | undefined,
  tolovTuri?: string | null
): Promise<string | null> {
  if (!userId || !naqdTolovmi(tolovTuri)) return null;

  const biznes = await db.business.findFirst({
    where: { id: businessId },
    select: { shaxsiyKassa: true },
  });
  if (!biznes?.shaxsiyKassa) return null;

  const kassa = await db.account.findFirst({
    where: { businessId, userId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return kassa?.id ?? null;
}
