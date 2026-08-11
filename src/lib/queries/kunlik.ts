import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";

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
  /** ISO — kiritilgan vaqt (soat UI'da Toshkent bo'yicha ko'rsatiladi). */
  createdAt: string;
}

export interface KunlikReportDTO {
  id: string | null;
  /** "YYYY-MM-DD" */
  sana: string;
  holat: "OPEN" | "CONFIRMED";
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  confirmedByIsm: string | null;
  confirmedAt: string | null;
  items: KunlikTushumDTO[];
}

/**
 * Bitta kunning hisoboti tushumlari bilan. Hisobot hali ochilmagan bo'lsa
 * (kun boshlanmagan) — nol qiymatli "virtual" DTO qaytadi: yangi kun har doim
 * 0 so'mdan boshlanadi, yozuv esa birinchi tushumda yaratiladi.
 */
export async function getKunlikReport(businessId: string, sanaStr: string): Promise<KunlikReportDTO> {
  const sana = dateOnlyStringToUTCDate(sanaStr);
  const report = await prisma.dailyReport.findFirst({
    where: { businessId, sana },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!report) {
    return {
      id: null,
      sana: sanaStr,
      holat: "OPEN",
      naqdSumma: 0,
      clickSumma: 0,
      qarzSumma: 0,
      jamiSumma: 0,
      confirmedByIsm: null,
      confirmedAt: null,
      items: [],
    };
  }
  return {
    id: report.id,
    sana: utcDateToDateOnlyString(report.sana),
    holat: report.holat === "CONFIRMED" ? "CONFIRMED" : "OPEN",
    naqdSumma: report.naqdSumma,
    clickSumma: report.clickSumma,
    qarzSumma: report.qarzSumma,
    jamiSumma: report.jamiSumma,
    confirmedByIsm: report.confirmedByIsm,
    confirmedAt: report.confirmedAt ? report.confirmedAt.toISOString() : null,
    items: report.items.map((t) => ({
      id: t.id,
      summa: t.summa,
      tolovTuri: t.tolovTuri,
      izoh: t.izoh,
      userId: t.userId,
      userIsm: t.userIsm,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export interface KunlikTarixDTO {
  id: string;
  sana: string;
  holat: "OPEN" | "CONFIRMED";
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  confirmedByIsm: string | null;
}

/** Oxirgi kunlar tarixi (yangi kun birinchi). */
export async function listKunlikTarix(businessId: string, limit = 60): Promise<KunlikTarixDTO[]> {
  const rows = await prisma.dailyReport.findMany({
    where: { businessId },
    orderBy: { sana: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    sana: utcDateToDateOnlyString(r.sana),
    holat: r.holat === "CONFIRMED" ? "CONFIRMED" : "OPEN",
    naqdSumma: r.naqdSumma,
    clickSumma: r.clickSumma,
    qarzSumma: r.qarzSumma,
    jamiSumma: r.jamiSumma,
    confirmedByIsm: r.confirmedByIsm,
  }));
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
      OR: [{ businessId: null }, { businessId }],
    },
    select: { id: true, ism: true, rol: true },
    orderBy: { ism: "asc" },
  });
  return rows;
}
