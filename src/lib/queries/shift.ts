import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";

/** Berilgan kun uchun kutilgan naqd = o'sha kundagi kirim (deletedAt=null) jami. */
export async function getExpectedCash(businessId: string, dateStr: string): Promise<number> {
  const from = dateOnlyStringToUTCDate(dateStr);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const res = await prisma.transaction.aggregate({
    where: { businessId, turi: "kirim", deletedAt: null, sana: { gte: from, lt: to } },
    _sum: { summa: true },
  });
  return res._sum.summa ?? 0;
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
