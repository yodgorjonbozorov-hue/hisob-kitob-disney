import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import type { Prisma } from "@prisma/client";

export interface TransactionListParams {
  businessId: string;
  from?: string | null;
  to?: string | null;
  turi?: string | null;
  categoryId?: string | null;
  q?: string | null;
  minSumma?: number | null;
  maxSumma?: number | null;
  /**
   * Ko'rinuvchanlik chegarasi: berilsa — faqat shu foydalanuvchi kiritgan yozuvlar.
   * Direktor uchun `null` (hammasi). Qiymatni `transactionScopeUserId` beradi.
   */
  userId?: string | null;
  page?: number;
  pageSize?: number;
}

/** Ro'yxat va eksport bir xil filtrlardan foydalanadi — shart bitta joyda quriladi. */
function buildTransactionWhere(params: TransactionListParams): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { businessId: params.businessId, deletedAt: null };
  if (params.userId) where.userId = params.userId;
  if (params.from || params.to) {
    where.sana = {};
    if (params.from) where.sana.gte = dateOnlyStringToUTCDate(params.from);
    if (params.to) where.sana.lt = new Date(dateOnlyStringToUTCDate(params.to).getTime() + 24 * 60 * 60 * 1000);
  }
  if (params.turi === "kirim" || params.turi === "chiqim") where.turi = params.turi;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.q) where.izoh = { contains: params.q, ...qidiruvRejimi() };
  if (params.minSumma != null || params.maxSumma != null) {
    where.summa = {};
    if (params.minSumma != null) where.summa.gte = params.minSumma;
    if (params.maxSumma != null) where.summa.lte = params.maxSumma;
  }
  return where;
}

export async function listTransactions(params: TransactionListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where = buildTransactionWhere(params);

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

/** Filtrga mos BARCHA tranzaksiyalar (eksport uchun, pagination'siz, 5000 gacha). */
export async function listAllTransactions(params: TransactionListParams) {
  return prisma.transaction.findMany({
    where: buildTransactionWhere(params),
    include: { category: true, user: { select: { ism: true } } },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });
}

/** O'chirilgan (soft-deleted) tranzaksiyalar — admin savati uchun. */
export async function listDeletedTransactions(businessId: string, limit = 100) {
  return prisma.transaction.findMany({
    where: { businessId, deletedAt: { not: null } },
    include: { category: true, user: { select: { id: true, ism: true } } },
    orderBy: { deletedAt: "desc" },
    take: limit,
  });
}
