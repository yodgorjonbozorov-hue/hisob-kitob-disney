import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";

export interface CreateTransactionData {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string; // "YYYY-MM-DD"
  izoh?: string | null;
  filial?: string | null;
}

/** Yagona joy — API route va Telegram bot ikkalasi ham shu funksiyani chaqiradi. */
export async function createTransaction(userId: string, data: CreateTransactionData) {
  return prisma.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
    include: { category: true, user: { select: { id: true, ism: true } } },
  });
}
