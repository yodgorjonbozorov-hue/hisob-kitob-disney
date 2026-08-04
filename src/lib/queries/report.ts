import { prisma } from "@/lib/prisma";
import { getMonthSummary, getCategoryBreakdown } from "@/lib/queries/dashboard";
import { monthRangeUTC } from "@/lib/date";
import { isAvto } from "@/lib/biznesTuri";

/** Oy davomida sotilgan bitta mashina bo'yicha yakun (avto rejimi). */
export interface AvtoSotuvQator {
  nomi: string;
  avtoRaqam: string | null;
  olinganNarx: number;
  sotilganNarx: number;
  xarajat: number;
  sofFoyda: number;
  sana: string;
}

export interface AvtoOylikYakun {
  qatorlar: AvtoSotuvQator[];
  jamiSotilgan: number;
  jamiTannarx: number;
  jamiXarajat: number;
  jamiSofFoyda: number;
}

export interface MonthlyReport {
  month: string;
  businessNomi: string;
  /** Avto rejimidagi biznes uchun — sotilgan mashinalar bo'yicha sof foyda. */
  avto: AvtoOylikYakun | null;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
  kirimByCategory: { nomi: string; summa: number; foiz: number }[];
  chiqimByCategory: { nomi: string; summa: number; foiz: number }[];
  prevMonth: { jamiKirim: number; jamiChiqim: number; sofFoyda: number };
  changePct: { kirim: number | null; chiqim: number | null; sofFoyda: number | null };
}

/**
 * Avto rejimi: oy davomida sotilgan mashinalar bo'yicha sof foyda.
 * Xarajatlar mashinaga bog'langan barcha xarajatlar (ular sotuvdan oldin
 * qilinadi), tannarx esa sotuv paytidagi snapshot.
 */
export async function getAvtoOylikYakun(businessId: string, month: string): Promise<AvtoOylikYakun> {
  const { from, to } = monthRangeUTC(month);
  const sales = await prisma.sale.findMany({
    where: { businessId, createdAt: { gte: from, lt: to } },
    include: { product: { select: { nomi: true, avtoRaqam: true } } },
    orderBy: { createdAt: "asc" },
  });

  const xarajatlar = await prisma.productExpense.groupBy({
    by: ["productId"],
    where: { businessId, productId: { in: sales.map((s) => s.productId) } },
    _sum: { summa: true },
  });
  const xarajatMap = new Map(xarajatlar.map((x) => [x.productId, x._sum.summa ?? 0]));

  const qatorlar: AvtoSotuvQator[] = sales.map((s) => {
    const xarajat = xarajatMap.get(s.productId) ?? 0;
    const olinganNarx = s.tannarx * s.miqdor;
    return {
      nomi: s.product.nomi,
      avtoRaqam: s.product.avtoRaqam,
      olinganNarx,
      sotilganNarx: s.jamiSumma,
      xarajat,
      sofFoyda: s.jamiSumma - olinganNarx - xarajat,
      sana: s.createdAt.toISOString(),
    };
  });

  return {
    qatorlar,
    jamiSotilgan: qatorlar.length,
    jamiTannarx: qatorlar.reduce((a, q) => a + q.olinganNarx, 0),
    jamiXarajat: qatorlar.reduce((a, q) => a + q.xarajat, 0),
    jamiSofFoyda: qatorlar.reduce((a, q) => a + q.sofFoyda, 0),
  };
}

export async function getMonthlyReport(businessId: string, month: string): Promise<MonthlyReport> {
  const [business, summary, kirimByCategory, chiqimByCategory] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { nomi: true, turi: true } }),
    getMonthSummary(businessId, month),
    getCategoryBreakdown(businessId, month, "kirim"),
    getCategoryBreakdown(businessId, month, "chiqim"),
  ]);

  // Avto biznesda direktor uchun eng muhim jadval — har mashina bo'yicha sof foyda.
  const avto = isAvto(business?.turi) ? await getAvtoOylikYakun(businessId, summary.month) : null;

  return {
    month: summary.month,
    businessNomi: business?.nomi ?? "—",
    avto,
    jamiKirim: summary.jamiKirim,
    jamiChiqim: summary.jamiChiqim,
    sofFoyda: summary.sofFoyda,
    kirimByCategory: kirimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    chiqimByCategory: chiqimByCategory.map(({ nomi, summa, foiz }) => ({ nomi, summa, foiz })),
    prevMonth: summary.prevMonth,
    changePct: summary.changePct,
  };
}
