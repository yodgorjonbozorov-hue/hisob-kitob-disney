import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessQueryRaw, businessScope, sanaKalit, songa } from "@/lib/db/businessRaw";
import { monthRangeUTC, shiftMonthString, currentMonthString } from "@/lib/date";

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

const BOSH_TOTALS: MonthTotals = { jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 };

interface GuruhQator {
  kalit: string;
  turi: string;
  summa: unknown;
}

/**
 * Berilgan oraliqdagi kirim/chiqimni OY bo'yicha guruhlab qaytaradi — BITTA so'rov.
 *
 * Ilgari har oy uchun ikkita `aggregate` ketardi: 6 oylik trend = 12 so'rov,
 * oylik xulosa = 4 so'rov. Turso'da har so'rov ~160 ms — bu sezilarli kechikish.
 */
async function monthlyTotals(
  businessId: string,
  from: Date,
  to: Date
): Promise<Map<string, MonthTotals>> {
  const rows = await businessQueryRaw<GuruhQator>(Prisma.sql`
    SELECT ${sanaKalit('t."sana"', 7)} AS kalit, t."turi" AS turi, SUM(t."summa") AS summa
    FROM "Transaction" t
    JOIN "Business" b ON b."id" = t."businessId"
    WHERE ${businessScope("t", businessId)}
      AND t."deletedAt" IS NULL
      AND t."sana" >= ${from}
      AND t."sana" < ${to}
    GROUP BY kalit, t."turi"
  `);

  const map = new Map<string, MonthTotals>();
  for (const r of rows) {
    const oy = map.get(r.kalit) ?? { ...BOSH_TOTALS };
    if (r.turi === "kirim") oy.jamiKirim += songa(r.summa);
    else oy.jamiChiqim += songa(r.summa);
    oy.sofFoyda = oy.jamiKirim - oy.jamiChiqim;
    map.set(r.kalit, oy);
  }
  return map;
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
  // Joriy va oldingi oy bitta oraliqda — 4 ta aggregate o'rniga 1 ta so'rov.
  const { from } = monthRangeUTC(prevMonthStr);
  const { to } = monthRangeUTC(monthStr);
  const byMonth = await monthlyTotals(businessId, from, to);

  const curr = byMonth.get(monthStr) ?? BOSH_TOTALS;
  const prev = byMonth.get(prevMonthStr) ?? BOSH_TOTALS;

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

  // Butun oraliq bitta so'rovda (ilgari 6 oy = 12 ta aggregate).
  const { from } = monthRangeUTC(monthStrs[0]);
  const { to } = monthRangeUTC(endMonth);
  const byMonth = await monthlyTotals(businessId, from, to);

  // Yozuvsiz oylar ham nuqta sifatida qoladi — grafikda uzilish bo'lmasin.
  return monthStrs.map((month) => ({ month, ...(byMonth.get(month) ?? BOSH_TOTALS) }));
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
  // Ilgari butun oy RAM'ga yuklanib JS'da guruhlanardi — endi SQL GROUP BY.
  const rows = await businessQueryRaw<GuruhQator>(Prisma.sql`
    SELECT ${sanaKalit('t."sana"', 10)} AS kalit, t."turi" AS turi, SUM(t."summa") AS summa
    FROM "Transaction" t
    JOIN "Business" b ON b."id" = t."businessId"
    WHERE ${businessScope("t", businessId)}
      AND t."deletedAt" IS NULL
      AND t."sana" >= ${from}
      AND t."sana" < ${to}
    GROUP BY kalit, t."turi"
    ORDER BY kalit ASC
  `);

  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const point = byDate.get(r.kalit) ?? { date: r.kalit, kirim: 0, chiqim: 0 };
    if (r.turi === "kirim") point.kirim += songa(r.summa);
    else point.chiqim += songa(r.summa);
    byDate.set(r.kalit, point);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
