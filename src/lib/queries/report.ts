import { prisma } from "@/lib/prisma";
import { getMonthSummary, getCategoryBreakdown } from "@/lib/queries/dashboard";

export interface MonthlyReport {
  month: string;
  businessNomi: string;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
  kirimByCategory: { nomi: string; summa: number; foiz: number }[];
  chiqimByCategory: { nomi: string; summa: number; foiz: number }[];
  prevMonth: { jamiKirim: number; jamiChiqim: number; sofFoyda: number };
  changePct: { kirim: number | null; chiqim: number | null; sofFoyda: number | null };
}

export async function getMonthlyReport(businessId: string, month: string): Promise<MonthlyReport> {
  const [business, summary, kirimByCategory, chiqimByCategory] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { nomi: true } }),
    getMonthSummary(businessId, month),
    getCategoryBreakdown(businessId, month, "kirim"),
    getCategoryBreakdown(businessId, month, "chiqim"),
  ]);

  return {
    month: summary.month,
    businessNomi: business?.nomi ?? "—",
    jamiKirim: summary.jamiKirim,
    jamiChiqim: summary.jamiChiqim,
    sofFoyda: summary.sofFoyda,
    kirimByCategory: kirimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    chiqimByCategory: chiqimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    prevMonth: summary.prevMonth,
    changePct: summary.changePct,
  };
}
