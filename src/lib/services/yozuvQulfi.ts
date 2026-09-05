import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";

/**
 * QARZGA BOG'LANGAN YOZUV QULFI.
 *
 * MUAMMO. Qarz to'lovi IKKI joyga yoziladi: `DebtPayment` (qarz qoldig'i) va
 * `Transaction` (kassa ledgeri). Kassa qoldig'i ledgerdan hisoblanadi, qarz
 * qoldig'i esa `Debt.tolangan` da saqlanadi — ular BIRGA yoziladi
 * (`lib/services/qarz.ts`). Agar tranzaksiyani umumiy Kirim/Chiqim
 * sahifasidan alohida tahrirlash yoki o'chirish mumkin bo'lsa, kassa
 * o'zgaradi-yu qarz o'sha-o'sha qoladi: 2 mln to'lov 10 mln ga tuzatilsa
 * kassa 10 mln ko'rsatadi, qarzdan esa 2 mln ayrilgan bo'lib qolaveradi.
 *
 * Bu qulf shu ikkilanishni yopadi: qarz to'lovi yozuvi FAQAT o'z oqimidan
 * tuzatiladi (Moliya bo'limi — bekor qilib qayta yozadi, `lib/services/
 * pulOqimiTuzatish.ts`), u yerda qarz ham AYNI tranzaksiyada to'g'rilanadi.
 */

const QULF_XABARI =
  "Bu yozuv qarz to'lovi bilan bog'langan — uni alohida tahrirlab yoki " +
  "o'chirib bo'lmaydi (kassa o'zgarib, qarz qoldig'i o'sha-o'sha qolardi). " +
  "Moliya bo'limidan tuzating yoki bekor qiling.";

/** Berilgan yozuvlar ichidan qarz to'loviga bog'langanlarining IDlari. */
export async function qarzgaBogliqYozuvlar(
  businessId: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.debtPayment.findMany({
    where: { businessId, transactionId: { in: ids } },
    select: { transactionId: true },
  });
  return new Set(rows.map((r) => r.transactionId as string));
}

/**
 * Bitta yozuv qarzga bog'liq bo'lsa `ForbiddenError`.
 * Tahrirlash va o'chirishdan OLDIN chaqiriladi.
 */
export async function qarzQulfiniTekshir(businessId: string, id: string): Promise<void> {
  const bogliq = await qarzgaBogliqYozuvlar(businessId, [id]);
  if (bogliq.has(id)) throw new ForbiddenError(QULF_XABARI);
}

/**
 * Ommaviy amal uchun: qarzga bog'langan yozuvlar ro'yxatdan CHIQARILADI.
 *
 * Butun so'rovni rad etish o'rniga qulflanganlari o'tkazib yuboriladi —
 * kassir 50 ta yozuvni belgilaganda bittasi qarz to'lovi bo'lgani uchun
 * hammasi bloklanib qolmasin. Chaqiruvchi nechtasi o'tkazib yuborilganini
 * foydalanuvchiga qaytaradi.
 */
export async function qarzsizYozuvlar(
  businessId: string,
  ids: string[]
): Promise<{ ruxsat: string[]; qulflangan: number }> {
  const bogliq = await qarzgaBogliqYozuvlar(businessId, ids);
  return {
    ruxsat: ids.filter((id) => !bogliq.has(id)),
    qulflangan: bogliq.size,
  };
}
