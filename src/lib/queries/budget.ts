import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";

export interface BudgetRow {
  categoryId: string;
  nomi: string;
  limitSumma: number; // 0 = belgilanmagan
  sarflangan: number;
  foiz: number; // sarflangan / limit (%), limit 0 bo'lsa 0
}

/**
 * Chiqim kategoriyalari bo'yicha oylik budjet holati: limit + sarflangan.
 * Faqat chiqim kategoriyalari (budjet xarajatga qo'yiladi).
 */
export async function getBudgetsWithSpend(businessId: string, month: string): Promise<BudgetRow[]> {
  const { from, to } = monthRangeUTC(month);

  const [categories, budgets, spends] = await Promise.all([
    prisma.category.findMany({
      where: { businessId, turi: "chiqim", isActive: true },
      orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      select: { id: true, nomi: true },
    }),
    prisma.budget.findMany({ where: { businessId, oy: month } }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId, turi: "chiqim", deletedAt: null, sana: { gte: from, lt: to } },
      _sum: { summa: true },
    }),
  ]);

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.limitSumma]));
  const spendMap = new Map(spends.map((s) => [s.categoryId, s._sum.summa ?? 0]));

  return categories.map((c) => {
    const limitSumma = budgetMap.get(c.id) ?? 0;
    const sarflangan = spendMap.get(c.id) ?? 0;
    return {
      categoryId: c.id,
      nomi: c.nomi,
      limitSumma,
      sarflangan,
      foiz: limitSumma > 0 ? Math.round((sarflangan / limitSumma) * 100) : 0,
    };
  });
}
