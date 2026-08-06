import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { ForbiddenError } from "@/lib/auth/guard";
import type { BusinessTx } from "@/lib/db/businessTx";
import { resolveAccountId } from "@/lib/services/accounts";

export interface CreateTransactionData {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string; // "YYYY-MM-DD"
  izoh?: string | null;
  filial?: string | null;
  /** Qaysi kassa/hisob-raqamga tushdi. Berilmasa birinchi faol kassa olinadi. */
  accountId?: string | null;
}

/**
 * Yagona joy — API route va Telegram bot ikkalasi ham shu funksiyani chaqiradi.
 * Kategoriya aynan shu biznesga tegishli ekani tekshiriladi (cross-business himoya).
 */
export async function createTransaction(userId: string, businessId: string, data: CreateTransactionData) {
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { businessId: true, turi: true },
  });
  if (!category || category.businessId !== businessId) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // Kassa: tanlangani tekshiriladi, tanlanmagani — birinchi faol kassa.
  const accountId = await resolveAccountId(businessId, data.accountId);

  return prisma.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
    include: { category: true, user: { select: { id: true, ism: true } } },
  });
}

/**
 * `createTransaction`ning tranzaksiya ichida ishlaydigan varianti.
 * Xom `tx` delegatlari ishlatilgani uchun `businessId` sharti QO'LDA yoziladi
 * (batafsil: lib/db/businessTx.ts).
 */
export async function createTransactionTx(
  tx: BusinessTx,
  userId: string,
  businessId: string,
  data: CreateTransactionData
) {
  const category = await tx.category.findFirst({
    where: { id: data.categoryId, businessId },
    select: { id: true },
  });
  if (!category) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // Tranzaksiya ichida: kassa xom `tx` bilan qidiriladi (businessId qo'lda).
  let accountId = data.accountId ?? null;
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
  } else {
    const birinchi = await tx.account.findFirst({
      where: { businessId, isActive: true },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    accountId = birinchi?.id ?? null;
  }

  return tx.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
  });
}
