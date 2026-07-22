import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { ForbiddenError } from "@/lib/auth/guard";

export interface CreateTransactionData {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string; // "YYYY-MM-DD"
  izoh?: string | null;
  filial?: string | null;
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

  return prisma.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
    include: { category: true, user: { select: { id: true, ism: true } } },
  });
}
