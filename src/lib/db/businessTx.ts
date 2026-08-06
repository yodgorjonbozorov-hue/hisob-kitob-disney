import type { Prisma } from "@prisma/client";
import { rawPrisma } from "./rawPrisma";
import { currentTenantId } from "./tenantContext";
import { ForbiddenError } from "@/lib/auth/guard";

/**
 * BIZNESGA BOG'LANGAN ATOMIK TRANZAKSIYA.
 *
 * Nima uchun kerak: sotuv, qarz to'lovi, mashina qabul qilish kabi amallar
 * bir necha jadvalni ketma-ket o'zgartiradi. O'rtada uzilish bo'lsa ma'lumot
 * buziladi (tovar ombordan ayrildi — sotuv yozuvi yo'q). Shuning uchun ular
 * `$transaction` ichida bajarilishi SHART.
 *
 * Nega tenant-scoped `@/lib/prisma` emas: tenant extension har unique amalda
 * `rawPrisma` bilan qo'shimcha `findFirst` qiladi. Interaktiv tranzaksiya
 * ichida bu so'rov tranzaksiyadan TASHQARIDAGI ulanishga tushadi — SQLite
 * yozuv qulfi bilan deadlock xavfi bor va yozuv tranzaksiya ichidagi
 * o'zgarishlarni ko'rmaydi.
 *
 * Shuning uchun kelishuv (CLAUDE.md da qayd etilgan istisno):
 *  1. Tranzaksiya BOSHLANISHIDAN OLDIN businessId joriy tenantga tegishliligi
 *     bir marta tekshiriladi (IDOR himoyasi shu yerda saqlanadi);
 *  2. Tranzaksiya ICHIDA xom `tx` delegatlari ishlatiladi, lekin HAR so'rovda
 *     `businessId` sharti QO'LDA yozilishi majburiy.
 *
 * Ikkinchi qoidani buzish — tenant izolyatsiyasini buzish demakdir.
 */
export type BusinessTx = Prisma.TransactionClient;

/** Berilgan biznes joriy tenantga tegishliligini tekshiradi (tranzaksiyadan tashqarida). */
export async function assertBusinessInCurrentTenant(businessId: string): Promise<void> {
  const tenantId = currentTenantId();
  const biz = await rawPrisma.business.findFirst({
    where: { id: businessId, tenantId },
    select: { id: true },
  });
  if (!biz) {
    throw new ForbiddenError("Biznes sizning kompaniyangizga tegishli emas");
  }
}

/**
 * Biznes egaligini tekshirib, `fn`ni bitta atomik tranzaksiyada bajaradi.
 * `fn` ichidagi har bir so'rovga `businessId` sharti qo'lda qo'shilishi shart.
 */
export async function runBusinessTx<T>(
  businessId: string,
  fn: (tx: BusinessTx) => Promise<T>
): Promise<T> {
  await assertBusinessInCurrentTenant(businessId);
  return rawPrisma.$transaction((tx) => fn(tx), {
    // SQLite/Turso: uzoq davom etgan yozuv qulfi butun bazani to'sadi.
    maxWait: 5_000,
    timeout: 15_000,
  });
}
