import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { QARZ_EMAS } from "@/lib/qarzFiltr";

/**
 * Berilgan kun uchun kutilgan naqd = o'sha kundagi kirim (deletedAt=null) jami.
 * `userId` berilsa — faqat shu xodim kiritgan kirim (o'z smenasi bo'yicha yakun).
 *
 * Qarzga yozilgan savdo bu yerda YO'Q: kassada u pul yotmaydi, aks holda
 * kassir har kuni qarz summasicha kam pul topshirgandek ko'rinardi.
 */
export async function getExpectedCash(
  businessId: string,
  dateStr: string,
  userId?: string | null
): Promise<number> {
  const from = dateOnlyStringToUTCDate(dateStr);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const res = await prisma.transaction.aggregate({
    where: {
      businessId,
      turi: "kirim",
      deletedAt: null,
      sana: { gte: from, lt: to },
      ...QARZ_EMAS,
      ...(userId ? { userId } : {}),
    },
    _sum: { summa: true },
  });
  return res._sum.summa ?? 0;
}

/**
 * Bugungi kirim va chiqim jami (aktiv biznes). Kassa bosh ekrani uchun.
 * `userId` berilsa — faqat shu xodim kiritgan yozuvlar bo'yicha.
 */
export async function getTodayTotals(
  businessId: string,
  dateStr: string,
  userId?: string | null
): Promise<{ kirim: number; chiqim: number }> {
  const from = dateOnlyStringToUTCDate(dateStr);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.transaction.groupBy({
    by: ["turi"],
    where: {
      businessId,
      deletedAt: null,
      sana: { gte: from, lt: to },
      ...QARZ_EMAS,
      ...(userId ? { userId } : {}),
    },
    _sum: { summa: true },
  });
  return {
    kirim: rows.find((r) => r.turi === "kirim")?._sum.summa ?? 0,
    chiqim: rows.find((r) => r.turi === "chiqim")?._sum.summa ?? 0,
  };
}

export interface ShiftCloseDTO {
  id: string;
  sana: string;
  userIsm: string | null;
  kutilganNaqd: number;
  sanalganNaqd: number;
  farq: number;
  izoh: string | null;
}

export async function listShiftCloses(businessId: string, limit = 30): Promise<ShiftCloseDTO[]> {
  const rows = await prisma.shiftClose.findMany({
    where: { businessId },
    orderBy: { sana: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    sana: r.sana.toISOString(),
    userIsm: r.userIsm,
    kutilganNaqd: r.kutilganNaqd,
    sanalganNaqd: r.sanalganNaqd,
    farq: r.farq,
    izoh: r.izoh,
  }));
}
