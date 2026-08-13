import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";

export interface XodimDTO {
  id: string;
  ism: string;
  lavozim: string | null;
  tel: string | null;
  stavka: number;
  stavkaTuri: string;
  ishBoshlagan: string | null;
  isActive: boolean;
  izoh: string | null;
}

export async function listXodimlar(businessId: string, faqatFaol = false): Promise<XodimDTO[]> {
  const rows = await prisma.employee.findMany({
    where: { businessId, deletedAt: null, ...(faqatFaol ? { isActive: true } : {}) },
    orderBy: [{ isActive: "desc" }, { ism: "asc" }],
  });
  return rows.map((e) => ({
    id: e.id,
    ism: e.ism,
    lavozim: e.lavozim,
    tel: e.tel,
    stavka: e.stavka,
    stavkaTuri: e.stavkaTuri,
    ishBoshlagan: e.ishBoshlagan ? e.ishBoshlagan.toISOString() : null,
    isActive: e.isActive,
    izoh: e.izoh,
  }));
}

export interface OylikDTO {
  id: string | null;
  employeeId: string;
  xodimIsm: string;
  stavka: number;
  stavkaTuri: string;
  oy: string;
  /** Ikkilangan kunlar (1 kun = 2) — UI 2 ga bo'lib ko'rsatadi. */
  yarimKunlar: number;
  hisoblangan: number;
  qoshimcha: number;
  ushlab: number;
  avans: number;
  tolanadigan: number;
  /** Avans hisoblangandan ko'p bo'lsa keyingi oyga o'tadigan qarz (M-13). */
  keyingiOygaQarz: number;
  holat: string;
  tolanganSana: string | null;
  transactionId: string | null;
  izoh: string | null;
}

/**
 * Oy bo'yicha vedomost. Vedomosti hali yaratilmagan FAOL xodimlar ham
 * ro'yxatga tushadi (`id: null`) — "kimga hali hisoblanmagan?" degan savol
 * ro'yxatning o'zidan ko'rinib turishi kerak.
 */
export async function listOyliklar(businessId: string, oy: string): Promise<OylikDTO[]> {
  const [xodimlar, vedomostlar, avanslar] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId, deletedAt: null, isActive: true },
      orderBy: { ism: "asc" },
    }),
    prisma.payroll.findMany({ where: { businessId, oy } }),
    prisma.payrollAdvance.groupBy({
      by: ["employeeId"],
      where: { businessId, oy },
      _sum: { summa: true },
    }),
  ]);

  const vedomostMap = new Map(vedomostlar.map((p) => [p.employeeId, p]));
  const avansMap = new Map(avanslar.map((a) => [a.employeeId, a._sum.summa ?? 0]));

  return xodimlar.map((x) => {
    const p = vedomostMap.get(x.id);
    return {
      id: p?.id ?? null,
      employeeId: x.id,
      xodimIsm: x.ism,
      stavka: x.stavka,
      stavkaTuri: x.stavkaTuri,
      oy,
      yarimKunlar: p?.yarimKunlar ?? 0,
      hisoblangan: p?.hisoblangan ?? 0,
      qoshimcha: p?.qoshimcha ?? 0,
      ushlab: p?.ushlab ?? 0,
      // Vedomost yo'q bo'lsa ham berilgan avans ko'rinib tursin.
      avans: p?.avans ?? avansMap.get(x.id) ?? 0,
      tolanadigan: p?.tolanadigan ?? 0,
      keyingiOygaQarz: p?.keyingiOygaQarz ?? 0,
      holat: p?.holat ?? "hisoblanmagan",
      tolanganSana: p?.tolanganSana ? p.tolanganSana.toISOString() : null,
      transactionId: p?.transactionId ?? null,
      izoh: p?.izoh ?? null,
    };
  });
}

export interface DavomatKunDTO {
  employeeId: string;
  sana: string;
  holat: string;
}

export interface DavomatDTO {
  xodimlar: { id: string; ism: string; stavkaTuri: string }[];
  kunlar: DavomatKunDTO[];
}

/** Oy bo'yicha davomat jadvali (xodim × kun). */
export async function getDavomat(businessId: string, oy: string): Promise<DavomatDTO> {
  const { from, to } = monthRangeUTC(oy);
  const [xodimlar, kunlar] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId, deletedAt: null, isActive: true },
      select: { id: true, ism: true, stavkaTuri: true },
      orderBy: { ism: "asc" },
    }),
    prisma.attendance.findMany({
      where: { businessId, sana: { gte: from, lt: to } },
      select: { employeeId: true, sana: true, holat: true },
    }),
  ]);

  return {
    xodimlar,
    kunlar: kunlar.map((k) => ({
      employeeId: k.employeeId,
      sana: k.sana.toISOString().slice(0, 10),
      holat: k.holat,
    })),
  };
}

export interface HrStats {
  faolXodim: number;
  /** Shu oyda to'lanadigan (hali to'lanmagan) jami summa. */
  tolanadigan: number;
  /** Shu oyda allaqachon to'langan jami summa (oylik + avans). */
  tolangan: number;
}

export async function getHrStats(businessId: string, oy: string): Promise<HrStats> {
  const [faol, qoralama, tolangan, avans] = await Promise.all([
    prisma.employee.count({ where: { businessId, deletedAt: null, isActive: true } }),
    prisma.payroll.aggregate({
      where: { businessId, oy, holat: "qoralama" },
      _sum: { tolanadigan: true },
    }),
    prisma.payroll.aggregate({
      where: { businessId, oy, holat: "tolangan" },
      _sum: { tolanadigan: true },
    }),
    prisma.payrollAdvance.aggregate({ where: { businessId, oy }, _sum: { summa: true } }),
  ]);

  return {
    faolXodim: faol,
    tolanadigan: qoralama._sum.tolanadigan ?? 0,
    tolangan: (tolangan._sum.tolanadigan ?? 0) + (avans._sum.summa ?? 0),
  };
}
