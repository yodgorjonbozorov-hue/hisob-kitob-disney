import { getMonthSummary, getCategoryBreakdown } from "@/lib/queries/dashboard";

export interface MonthlyReport {
  month: string;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
  kirimByCategory: { nomi: string; summa: number; foiz: number }[];
  chiqimByCategory: { nomi: string; summa: number; foiz: number }[];
  prevMonth: { jamiKirim: number; jamiChiqim: number; sofFoyda: number };
  changePct: { kirim: number | null; chiqim: number | null; sofFoyda: number | null };
}

export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  const [summary, kirimByCategory, chiqimByCategory] = await Promise.all([
    getMonthSummary(month),
    getCategoryBreakdown(month, "kirim"),
    getCategoryBreakdown(month, "chiqim"),
  ]);

  return {
    month: summary.month,
    jamiKirim: summary.jamiKirim,
    jamiChiqim: summary.jamiChiqim,
    sofFoyda: summary.sofFoyda,
    kirimByCategory: kirimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    chiqimByCategory: chiqimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    prevMonth: summary.prevMonth,
    changePct: summary.changePct,
  };
}
