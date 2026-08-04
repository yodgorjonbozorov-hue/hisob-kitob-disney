import { prisma } from "@/lib/prisma";
import { monthRangeUTC, shiftMonthString, currentMonthString, utcDateToDateOnlyString } from "@/lib/date";

export interface MonthTotals {
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
}

export interface MonthSummary extends MonthTotals {
  month: string;
  prevMonth: MonthTotals;
  changePct: {
    kirim: number | null;
    chiqim: number | null;
    sofFoyda: number | null;
  };
}

async function sumByType(businessId: string, from: Date, to: Date, turi: "kirim" | "chiqim"): Promise<number> {
  const result = await prisma.transaction.aggregate({
    _sum: { summa: true },
    // deletedAt: null — o'chirilgan yozuv hech qanday moliyaviy raqamga kirmasligi shart.
    where: { businessId, turi, deletedAt: null, sana: { gte: from, lt: to } },
  });
  return result._sum.summa ?? 0;
}

async function monthTotals(businessId: string, monthStr: string): Promise<MonthTotals> {
  const { from, to } = monthRangeUTC(monthStr);
  const [jamiKirim, jamiChiqim] = await Promise.all([
    sumByType(businessId, from, to, "kirim"),
    sumByType(businessId, from, to, "chiqim"),
  ]);
  return { jamiKirim, jamiChiqim, sofFoyda: jamiKirim - jamiChiqim };
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export async function getMonthSummary(
  businessId: string,
  monthStr: string = currentMonthString()
): Promise<MonthSummary> {
  const prevMonthStr = shiftMonthString(monthStr, -1);
  const [curr, prev] = await Promise.all([
    monthTotals(businessId, monthStr),
    monthTotals(businessId, prevMonthStr),
  ]);

  return {
    month: monthStr,
    ...curr,
    prevMonth: prev,
    changePct: {
      kirim: pctChange(curr.jamiKirim, prev.jamiKirim),
      chiqim: pctChange(curr.jamiChiqim, prev.jamiChiqim),
      sofFoyda: pctChange(curr.sofFoyda, prev.sofFoyda),
    },
  };
}

export interface CategoryBreakdownItem {
  categoryId: string;
  nomi: string;
  summa: number;
  foiz: number;
}

export async function getCategoryBreakdown(
  businessId: string,
  monthStr: string,
  turi: "kirim" | "chiqim"
): Promise<CategoryBreakdownItem[]> {
  const { from, to } = monthRangeUTC(monthStr);
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { businessId, turi, deletedAt: null, sana: { gte: from, lt: to } },
    _sum: { summa: true },
  });

  const total = grouped.reduce((acc, g) => acc + (g._sum.summa ?? 0), 0);
  if (grouped.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.nomi]));

  return grouped
    .map((g) => {
      const summa = g._sum.summa ?? 0;
      return {
        categoryId: g.categoryId,
        nomi: categoryMap.get(g.categoryId) ?? "Noma'lum",
        summa,
        foiz: total > 0 ? (summa / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.summa - a.summa);
}

export interface TrendPoint {
  month: string;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
}

export async function getTrend(
  businessId: string,
  months: number = 6,
  endMonth: string = currentMonthString()
): Promise<TrendPoint[]> {
  const monthStrs: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthStrs.push(shiftMonthString(endMonth, -i));
  }

  const points = await Promise.all(
    monthStrs.map(async (m) => {
      const totals = await monthTotals(businessId, m);
      return { month: m, ...totals };
    })
  );

  return points;
}

export interface DailyPoint {
  date: string;
  kirim: number;
  chiqim: number;
}

export async function getDailyDynamics(
  businessId: string,
  monthStr: string = currentMonthString()
): Promise<DailyPoint[]> {
  const { from, to } = monthRangeUTC(monthStr);
  const transactions = await prisma.transaction.findMany({
    where: { businessId, deletedAt: null, sana: { gte: from, lt: to } },
    select: { sana: true, turi: true, summa: true },
  });

  const byDate = new Map<string, DailyPoint>();
  for (const t of transactions) {
    const key = utcDateToDateOnlyString(t.sana);
    if (!byDate.has(key)) {
      byDate.set(key, { date: key, kirim: 0, chiqim: 0 });
    }
    const point = byDate.get(key)!;
    if (t.turi === "kirim") point.kirim += t.summa;
    else point.chiqim += t.summa;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
