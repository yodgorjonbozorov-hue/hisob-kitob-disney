import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import type { Prisma } from "@prisma/client";

export interface TransactionListParams {
  businessId: string;
  from?: string | null;
  to?: string | null;
  turi?: string | null;
  categoryId?: string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listTransactions(params: TransactionListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where: Prisma.TransactionWhereInput = { businessId: params.businessId };
  if (params.from || params.to) {
    where.sana = {};
    if (params.from) where.sana.gte = dateOnlyStringToUTCDate(params.from);
    if (params.to) where.sana.lt = new Date(dateOnlyStringToUTCDate(params.to).getTime() + 24 * 60 * 60 * 1000);
  }
  if (params.turi === "kirim" || params.turi === "chiqim") where.turi = params.turi;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.q) where.izoh = { contains: params.q };

  const [items, total, sums] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, user: { select: { id: true, ism: true } } },
      orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
    // Filtrlangan to'plam bo'yicha jami (butun natija, faqat sahifa emas).
    prisma.transaction.groupBy({
      by: ["turi"],
      where,
      _sum: { summa: true },
    }),
  ]);

  const jamiKirim = sums.find((s) => s.turi === "kirim")?._sum.summa ?? 0;
  const jamiChiqim = sums.find((s) => s.turi === "chiqim")?._sum.summa ?? 0;
  const totals = { jamiKirim, jamiChiqim, sof: jamiKirim - jamiChiqim };

  return { items, total, page, pageSize, totals };
}

export type TransactionListResult = Awaited<ReturnType<typeof listTransactions>>;
export type TransactionDTO = TransactionListResult["items"][number];
