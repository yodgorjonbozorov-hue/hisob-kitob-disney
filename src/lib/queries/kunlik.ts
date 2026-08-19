import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";

/**
 * KUNLIK HISOBOT o'qish so'rovlari. Faqat o'qish — yozish lib/services/kunlik.ts da.
 * Hammasi tenant-scoped `prisma` orqali (izolyatsiya avtomatik).
 */

export interface KunlikTushumDTO {
  id: string;
  summa: number;
  tolovTuri: string;
  izoh: string | null;
  userId: string;
  userIsm: string | null;
  /** Yozuvlar (Transaction) dan avtomatik ulangan bo'lsa true — kunlikda tahrirlanmaydi. */
  yozuvdan: boolean;
  /** ISO — kiritilgan vaqt (soat UI'da Toshkent bo'yicha ko'rsatiladi). */
  createdAt: string;
}

export type KunlikHolatDTO = "OPEN" | "SUBMITTED" | "CONFIRMED";

export interface KunlikReportDTO {
  id: string | null;
  /** "YYYY-MM-DD" */
  sana: string;
  holat: KunlikHolatDTO;
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  /** Shu kunning Yozuvlardagi chiqimlari jami (jonli hisoblanadi). */
  chiqimSumma: number;
  /** jamiSumma − chiqimSumma — kun yakunida ko'rsatiladigan SOF natija. */
  sofSumma: number;
  /** Kassa topshiruvi (pul nazorati). */
  submittedByIsm: string | null;
  submittedAt: string | null;
  sanalganNaqd: number | null;
  /** sanalganNaqd − naqdSumma; topshirilmagan bo'lsa null. Manfiy = KAM. */
  naqdFarq: number | null;
  confirmedByIsm: string | null;
  confirmedAt: string | null;
  items: KunlikTushumDTO[];
}

function holatDTO(holat: string): KunlikHolatDTO {
  return holat === "CONFIRMED" ? "CONFIRMED" : holat === "SUBMITTED" ? "SUBMITTED" : "OPEN";
}

/**
 * Bitta kunning hisoboti tushumlari bilan. Hisobot hali ochilmagan bo'lsa
 * (kun boshlanmagan) — nol qiymatli "virtual" DTO qaytadi: yangi kun har doim
 * 0 so'mdan boshlanadi, yozuv esa birinchi tushumda yaratiladi.
 */
export async function getKunlikReport(businessId: string, sanaStr: string): Promise<KunlikReportDTO> {
  const sana = dateOnlyStringToUTCDate(sanaStr);
  // Chiqim kunlikda saqlanmaydi — Yozuvlardan (Transaction) jonli jamlanadi,
  // shuning uchun har doim haqiqiy holatni ko'rsatadi.
  const [report, chiqimAgg] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: { businessId, sana },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.transaction.aggregate({
      _sum: { summa: true },
      where: { businessId, turi: "chiqim", deletedAt: null, sana },
    }),
  ]);
  const chiqimSumma = chiqimAgg._sum.summa ?? 0;
  if (!report) {
    return {
      id: null,
      sana: sanaStr,
      holat: "OPEN",
      naqdSumma: 0,
      clickSumma: 0,
      qarzSumma: 0,
      jamiSumma: 0,
      chiqimSumma,
      sofSumma: -chiqimSumma,
      submittedByIsm: null,
      submittedAt: null,
      sanalganNaqd: null,
      naqdFarq: null,
      confirmedByIsm: null,
      confirmedAt: null,
      items: [],
    };
  }
  return {
    id: report.id,
    sana: utcDateToDateOnlyString(report.sana),
    holat: holatDTO(report.holat),
    naqdSumma: report.naqdSumma,
    clickSumma: report.clickSumma,
    qarzSumma: report.qarzSumma,
    jamiSumma: report.jamiSumma,
    chiqimSumma,
    sofSumma: report.jamiSumma - chiqimSumma,
    submittedByIsm: report.submittedByIsm,
    submittedAt: report.submittedAt ? report.submittedAt.toISOString() : null,
    sanalganNaqd: report.sanalganNaqd,
    naqdFarq: report.sanalganNaqd === null ? null : report.sanalganNaqd - report.naqdSumma,
    confirmedByIsm: report.confirmedByIsm,
    confirmedAt: report.confirmedAt ? report.confirmedAt.toISOString() : null,
    items: report.items.map((t) => ({
      id: t.id,
      summa: t.summa,
      tolovTuri: t.tolovTuri,
      izoh: t.izoh,
      userId: t.userId,
      userIsm: t.userIsm,
      yozuvdan: !!t.transactionId,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export interface KunlikTarixDTO {
  id: string;
  sana: string;
  holat: KunlikHolatDTO;
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  /** Shu kunning Yozuvlardagi chiqimlari jami. */
  chiqimSumma: number;
  /** jamiSumma − chiqimSumma — kun sof natijasi. */
  sofSumma: number;
  /** sanalganNaqd − naqdSumma; topshirilmagan bo'lsa null. */
  naqdFarq: number | null;
  submittedByIsm: string | null;
  confirmedByIsm: string | null;
}

/** Oxirgi kunlar tarixi (yangi kun birinchi). */
export async function listKunlikTarix(businessId: string, limit = 60): Promise<KunlikTarixDTO[]> {
  const rows = await prisma.dailyReport.findMany({
    where: { businessId },
    orderBy: { sana: "desc" },
    take: limit,
  });
  // Har kunning chiqimi Yozuvlardan BITTA groupBy bilan jamlanadi.
  const chiqimlar = rows.length
    ? await prisma.transaction.groupBy({
        by: ["sana"],
        where: {
          businessId,
          turi: "chiqim",
          deletedAt: null,
          sana: { in: rows.map((r) => r.sana) },
        },
        _sum: { summa: true },
      })
    : [];
  const chiqimMap = new Map(
    chiqimlar.map((c) => [utcDateToDateOnlyString(c.sana), c._sum.summa ?? 0])
  );
  return rows.map((r) => {
    const sana = utcDateToDateOnlyString(r.sana);
    const chiqimSumma = chiqimMap.get(sana) ?? 0;
    return {
      id: r.id,
      sana,
      holat: holatDTO(r.holat),
      naqdSumma: r.naqdSumma,
      clickSumma: r.clickSumma,
      qarzSumma: r.qarzSumma,
      jamiSumma: r.jamiSumma,
      chiqimSumma,
      sofSumma: r.jamiSumma - chiqimSumma,
      naqdFarq: r.sanalganNaqd === null ? null : r.sanalganNaqd - r.naqdSumma,
      submittedByIsm: r.submittedByIsm,
      confirmedByIsm: r.confirmedByIsm,
    };
  });
}

export interface KunlikDirektorDTO {
  direktorId: string | null;
  direktorIsm: string | null;
}

/** Biznes uchun tayinlangan direktor (bo'lsa). */
export async function getKunlikDirektor(businessId: string): Promise<KunlikDirektorDTO> {
  const sozlama = await prisma.dailyReportSetting.findFirst({
    where: { businessId },
    select: { direktorId: true },
  });
  if (!sozlama?.direktorId) return { direktorId: null, direktorIsm: null };
  const user = await prisma.user.findFirst({
    where: { id: sozlama.direktorId },
    select: { ism: true },
  });
  return { direktorId: sozlama.direktorId, direktorIsm: user?.ism ?? null };
}

export interface KunlikNomzodDTO {
  id: string;
  ism: string;
  rol: string;
}

/**
 * Direktorlikka nomzodlar: tenantdagi faol foydalanuvchilar — biznesga
 * biriktirilmaganlar (owner/admin/seller) yoki aynan shu biznesga
 * biriktirilganlar (kassir).
 */
export async function listKunlikNomzodlar(businessId: string): Promise<KunlikNomzodDTO[]> {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      rol: { in: ["OWNER", "ADMIN", "CASHIER", "SELLER"] },
      // Ko'p-bizneslik: biriktirilganlar + umuman biriktirilmaganlar.
      ...biznesXodimlariWhere(businessId),
    },
    select: { id: true, ism: true, rol: true },
    orderBy: { ism: "asc" },
  });
  return rows;
}
