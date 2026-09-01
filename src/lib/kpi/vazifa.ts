import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";

/**
 * KPI VAZIFALARI VA BIRIKTIRUVLARI.
 *
 * Vazifa QATTIQ KODLANMAGAN: standart to'plam birinchi ochilishda bazaga
 * yoziladi (lib/kpi/sozlama.ts), keyin direktor nomini, izohini va oylik
 * haqini o'zgartiradi, yangisini qo'shadi yoki nofaol qiladi.
 *
 * O'CHIRISH YUMSHOQ (`deletedAt`): ball tarixi va yopilgan oylik
 * snapshotlari havolasiz qolmasligi kerak.
 */

export interface VazifaDTO {
  id: string;
  nomi: string;
  izoh: string | null;
  oylikHaq: number;
  aktiv: boolean;
  tartib: number;
  /** Nechta xodimga biriktirilgan (faol biriktiruvlar). */
  xodimSoni: number;
}

export async function listVazifalar(businessId: string): Promise<VazifaDTO[]> {
  const rows = await prisma.kpiTask.findMany({
    where: { businessId, deletedAt: null },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { biriktiruvlar: { where: { aktiv: true } } } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    nomi: t.nomi,
    izoh: t.izoh,
    oylikHaq: t.oylikHaq,
    aktiv: t.aktiv,
    tartib: t.tartib,
    xodimSoni: t._count.biriktiruvlar,
  }));
}

export async function vazifaYarat(
  businessId: string,
  data: { nomi: string; izoh?: string | null; oylikHaq: number; tartib?: number }
) {
  return prisma.kpiTask.create({
    data: {
      businessId,
      nomi: data.nomi.trim(),
      izoh: data.izoh?.trim() || null,
      oylikHaq: data.oylikHaq,
      tartib: data.tartib ?? 0,
    },
  });
}

export async function vazifaYangila(
  businessId: string,
  id: string,
  data: { nomi?: string; izoh?: string | null; oylikHaq?: number; aktiv?: boolean; tartib?: number }
) {
  const bor = await prisma.kpiTask.findFirst({
    where: { id, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!bor) throw new ForbiddenError("Vazifa topilmadi");

  return prisma.kpiTask.update({
    where: { id },
    data: {
      ...(data.nomi !== undefined ? { nomi: data.nomi.trim() } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      ...(data.oylikHaq !== undefined ? { oylikHaq: data.oylikHaq } : {}),
      ...(data.aktiv !== undefined ? { aktiv: data.aktiv } : {}),
      ...(data.tartib !== undefined ? { tartib: data.tartib } : {}),
    },
  });
}

/** Yumshoq o'chirish — biriktiruvlar ham nofaol qilinadi (yozuv qoladi). */
export async function vazifaOchir(businessId: string, id: string) {
  return runBusinessTx(businessId, async (tx) => {
    const bor = await tx.kpiTask.findFirst({
      where: { id, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!bor) throw new ForbiddenError("Vazifa topilmadi");

    await tx.kpiTaskAssignment.updateMany({
      where: { businessId, taskId: id },
      data: { aktiv: false },
    });
    return tx.kpiTask.update({ where: { id }, data: { deletedAt: new Date(), aktiv: false } });
  });
}

/**
 * BIRIKTIRISH / OLIB TASHLASH.
 *
 * Olib tashlash yozuvni O'CHIRMAYDI, `aktiv=false` qiladi: o'tgan oylardagi
 * ball tarixi va oylik hisobi havolasiz qolmasligi kerak. Qayta biriktirilsa
 * o'sha yozuv tiklanadi (UNIQUE(taskId, employeeId) tufayli dublikat yo'q).
 */
export async function biriktiruvOzgartir(params: {
  businessId: string;
  taskId: string;
  employeeId: string;
  aktiv: boolean;
  userId: string;
}) {
  return runBusinessTx(params.businessId, async (tx) => {
    const [task, xodim] = await Promise.all([
      tx.kpiTask.findFirst({
        where: { id: params.taskId, businessId: params.businessId, deletedAt: null },
        select: { id: true },
      }),
      tx.employee.findFirst({
        where: { id: params.employeeId, businessId: params.businessId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!task) throw new ForbiddenError("Vazifa topilmadi");
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const mavjud = await tx.kpiTaskAssignment.findFirst({
      where: { businessId: params.businessId, taskId: params.taskId, employeeId: params.employeeId },
      select: { id: true },
    });

    if (mavjud) {
      return tx.kpiTaskAssignment.update({
        where: { id: mavjud.id },
        data: { aktiv: params.aktiv, userId: params.userId },
      });
    }
    if (!params.aktiv) return null;

    return tx.kpiTaskAssignment.create({
      data: {
        businessId: params.businessId,
        taskId: params.taskId,
        employeeId: params.employeeId,
        aktiv: true,
        userId: params.userId,
      },
    });
  });
}

export interface PresetDTO {
  id: string;
  taskId: string | null;
  sabab: string;
  ball: number;
  kritik: boolean;
  aktiv: boolean;
  tartib: number;
}

/** Tayyor jarima sabablari (global + vazifaga tegishli). */
export async function listPresetlar(businessId: string): Promise<PresetDTO[]> {
  const rows = await prisma.kpiPenaltyPreset.findMany({
    where: { businessId, aktiv: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    taskId: p.taskId,
    sabab: p.sabab,
    ball: p.ball,
    kritik: p.kritik,
    aktiv: p.aktiv,
    tartib: p.tartib,
  }));
}

export async function presetYarat(
  businessId: string,
  data: { taskId?: string | null; sabab: string; ball: number; kritik?: boolean; tartib?: number }
) {
  if (data.taskId) {
    const task = await prisma.kpiTask.findFirst({
      where: { id: data.taskId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw new ForbiddenError("Vazifa topilmadi");
  }
  return prisma.kpiPenaltyPreset.create({
    data: {
      businessId,
      taskId: data.taskId || null,
      sabab: data.sabab.trim(),
      ball: data.ball,
      kritik: data.kritik ?? false,
      tartib: data.tartib ?? 0,
    },
  });
}

export async function presetOchir(businessId: string, id: string) {
  const bor = await prisma.kpiPenaltyPreset.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!bor) throw new ForbiddenError("Sabab topilmadi");
  // Nofaol qilinadi — o'tgan ball yozuvlaridagi `presetId` havolasi qolsin.
  return prisma.kpiPenaltyPreset.update({ where: { id }, data: { aktiv: false } });
}

/**
 * XODIMNING SHU OYGI SOTUV PLANI — standartdan farq qilsa yoziladi.
 * `maqsad` null berilsa yozuv o'chiriladi va standart plan qaytadi.
 */
export async function sotuvPlaniBelgila(params: {
  businessId: string;
  employeeId: string;
  oy: string;
  maqsad: number | null;
  planBonus?: number | null;
  izoh?: string | null;
  userId: string;
}) {
  const xodim = await prisma.employee.findFirst({
    where: { id: params.employeeId, businessId: params.businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  const yopiq = await prisma.kpiPayroll.findFirst({
    where: { businessId: params.businessId, employeeId: params.employeeId, oy: params.oy },
    select: { id: true },
  });
  if (yopiq) throw new BadRequestError("Bu oy yopilgan — planni o'zgartirib bo'lmaydi");

  const mavjud = await prisma.kpiSalesTarget.findFirst({
    where: { businessId: params.businessId, employeeId: params.employeeId, oy: params.oy },
    select: { id: true },
  });

  if (params.maqsad === null) {
    if (mavjud) await prisma.kpiSalesTarget.delete({ where: { id: mavjud.id } });
    return null;
  }
  if (mavjud) {
    return prisma.kpiSalesTarget.update({
      where: { id: mavjud.id },
      data: {
        maqsad: params.maqsad,
        planBonus: params.planBonus ?? null,
        izoh: params.izoh?.trim() || null,
        userId: params.userId,
      },
    });
  }
  return prisma.kpiSalesTarget.create({
    data: {
      businessId: params.businessId,
      employeeId: params.employeeId,
      oy: params.oy,
      maqsad: params.maqsad,
      planBonus: params.planBonus ?? null,
      izoh: params.izoh?.trim() || null,
      userId: params.userId,
    },
  });
}
