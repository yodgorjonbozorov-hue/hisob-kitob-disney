import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { dateOnlyStringToUTCDate, monthRangeUTC, utcDateToDateOnlyString } from "@/lib/date";
import type {
  CreateBonusInput,
  CreatePenaltyInput,
  CreatePenaltyRuleInput,
  PenaltyQarorInput,
  UpdatePenaltyRuleInput,
} from "@/lib/validation/davomat";

// ---------------------------------------------------------------------------
// Jarima qoidalari (biznes sozlaydi, hardcode yo'q)
// ---------------------------------------------------------------------------

export async function listJarimaQoidalari(businessId: string) {
  return prisma.penaltyRule.findMany({
    where: { businessId, deletedAt: null },
    orderBy: [{ turi: "asc" }, { minDaqiqa: "asc" }],
  });
}

/** Faol "kechikish" qoidalari bir-birining oralig'iga kirib ketmasligi tekshiriladi. */
async function oraliqToqnashuvi(
  businessId: string,
  turi: string,
  minDaqiqa: number,
  maxDaqiqa: number | null,
  istisnoId?: string
): Promise<boolean> {
  if (turi !== "kechikish") return false;
  const qoidalar = await prisma.penaltyRule.findMany({
    where: { businessId, turi: "kechikish", isActive: true, deletedAt: null },
    select: { id: true, minDaqiqa: true, maxDaqiqa: true },
  });
  return qoidalar.some((q) => {
    if (q.id === istisnoId) return false;
    const aMax = maxDaqiqa ?? Infinity;
    const bMax = q.maxDaqiqa ?? Infinity;
    return minDaqiqa <= bMax && q.minDaqiqa <= aMax;
  });
}

export async function createJarimaQoidasi(businessId: string, data: CreatePenaltyRuleInput) {
  if (data.turi === "kelmadi") {
    const mavjud = await prisma.penaltyRule.findFirst({
      where: { businessId, turi: "kelmadi", isActive: true, deletedAt: null },
    });
    if (mavjud) throw new BadRequestError("Kelmagan kun uchun faol qoida allaqachon bor");
  }
  if (await oraliqToqnashuvi(businessId, data.turi, data.minDaqiqa, data.maxDaqiqa ?? null)) {
    throw new BadRequestError("Bu daqiqa oralig'i mavjud faol qoida bilan kesishadi");
  }
  return prisma.penaltyRule.create({
    data: {
      businessId,
      turi: data.turi,
      minDaqiqa: data.turi === "kelmadi" ? 0 : data.minDaqiqa,
      maxDaqiqa: data.turi === "kelmadi" ? null : data.maxDaqiqa ?? null,
      summa: data.summa,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateJarimaQoidasi(
  businessId: string,
  id: string,
  data: UpdatePenaltyRuleInput
) {
  const mavjud = await prisma.penaltyRule.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Qoida topilmadi");
  const minDaqiqa = data.minDaqiqa ?? mavjud.minDaqiqa;
  const maxDaqiqa = data.maxDaqiqa !== undefined ? data.maxDaqiqa : mavjud.maxDaqiqa;
  const faol = data.isActive ?? mavjud.isActive;
  if (maxDaqiqa != null && maxDaqiqa < minDaqiqa) {
    throw new BadRequestError("Yuqori chegara quyi chegaradan kichik bo'lmasligi kerak");
  }
  if (faol && (await oraliqToqnashuvi(businessId, mavjud.turi, minDaqiqa, maxDaqiqa, id))) {
    throw new BadRequestError("Bu daqiqa oralig'i mavjud faol qoida bilan kesishadi");
  }
  return prisma.penaltyRule.update({
    where: { id },
    data: {
      minDaqiqa,
      maxDaqiqa,
      ...(data.summa !== undefined ? { summa: data.summa } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

export async function deleteJarimaQoidasi(businessId: string, id: string) {
  const mavjud = await prisma.penaltyRule.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Qoida topilmadi");
  await prisma.penaltyRule.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { ok: true };
}

/** Standart qoidalar to'plami — bo'sh biznesga bir bosishda o'rnatiladi (NAMUNA, tahrirlanadi). */
export const STANDART_QOIDALAR: CreatePenaltyRuleInput[] = [
  { turi: "kechikish", minDaqiqa: 6, maxDaqiqa: 15, summa: 20_000 },
  { turi: "kechikish", minDaqiqa: 16, maxDaqiqa: 30, summa: 50_000 },
  { turi: "kechikish", minDaqiqa: 31, maxDaqiqa: null, summa: 100_000 },
  { turi: "kelmadi", minDaqiqa: 0, maxDaqiqa: null, summa: 200_000 },
];

export async function standartQoidalarniOrnat(businessId: string) {
  const mavjud = await prisma.penaltyRule.count({ where: { businessId, deletedAt: null } });
  if (mavjud > 0) throw new BadRequestError("Qoidalar allaqachon mavjud");
  for (const q of STANDART_QOIDALAR) {
    await createJarimaQoidasi(businessId, { ...q, isActive: true });
  }
  return listJarimaQoidalari(businessId);
}

// ---------------------------------------------------------------------------
// Avto-jarima (davomat tranzaksiyasi ichida chaqiriladi)
// ---------------------------------------------------------------------------

/**
 * Kechikish qoidaga tushsa KUTILMOQDA jarima ochadi. Bitta davomatga bitta
 * avto-jarima (bazadagi qisman unique indeks ham shuni majburlaydi). Mavjud
 * KUTILMOQDA jarima qayta hisobga moslab yangilanadi; TASDIQLANGAN/RAD
 * etilganlarga tegilmaydi.
 */
export async function avtoJarimaTx(
  tx: BusinessTx,
  params: {
    businessId: string;
    employeeId: string;
    attendanceId: string;
    sana: Date;
    kechikishDaqiqa: number;
  }
) {
  const qoida = await tx.penaltyRule.findFirst({
    where: {
      businessId: params.businessId,
      turi: "kechikish",
      isActive: true,
      deletedAt: null,
      minDaqiqa: { lte: params.kechikishDaqiqa },
      OR: [{ maxDaqiqa: null }, { maxDaqiqa: { gte: params.kechikishDaqiqa } }],
    },
    orderBy: { minDaqiqa: "desc" },
  });

  const mavjud = await tx.employeePenalty.findFirst({
    where: { businessId: params.businessId, attendanceId: params.attendanceId, manba: "avto" },
  });
  if (mavjud) {
    if (mavjud.holat !== "kutilmoqda") return mavjud;
    if (!qoida || qoida.summa <= 0) {
      await tx.employeePenalty.delete({ where: { id: mavjud.id } });
      return null;
    }
    return tx.employeePenalty.update({
      where: { id: mavjud.id },
      data: {
        ruleId: qoida.id,
        summa: qoida.summa,
        aslSumma: qoida.summa,
        sabab: `Kechikish — ${params.kechikishDaqiqa} daqiqa`,
      },
    });
  }

  if (!qoida || qoida.summa <= 0) return null;
  return tx.employeePenalty.create({
    data: {
      businessId: params.businessId,
      employeeId: params.employeeId,
      attendanceId: params.attendanceId,
      ruleId: qoida.id,
      sana: params.sana,
      summa: qoida.summa,
      aslSumma: qoida.summa,
      sabab: `Kechikish — ${params.kechikishDaqiqa} daqiqa`,
      manba: "avto",
      holat: "kutilmoqda",
    },
  });
}

/** Kelmagan kun uchun avto-jarima (cron ichida chaqiriladi). */
export async function kelmadiJarimaTx(
  tx: BusinessTx,
  params: { businessId: string; employeeId: string; attendanceId: string; sana: Date }
) {
  const qoida = await tx.penaltyRule.findFirst({
    where: { businessId: params.businessId, turi: "kelmadi", isActive: true, deletedAt: null },
  });
  if (!qoida || qoida.summa <= 0) return null;
  const mavjud = await tx.employeePenalty.findFirst({
    where: { businessId: params.businessId, attendanceId: params.attendanceId, manba: "avto" },
    select: { id: true },
  });
  if (mavjud) return null;
  return tx.employeePenalty.create({
    data: {
      businessId: params.businessId,
      employeeId: params.employeeId,
      attendanceId: params.attendanceId,
      ruleId: qoida.id,
      sana: params.sana,
      summa: qoida.summa,
      aslSumma: qoida.summa,
      sabab: "Kelmagan kun",
      manba: "avto",
      holat: "kutilmoqda",
    },
  });
}

// ---------------------------------------------------------------------------
// Qoralama vedomostni sinxronlash (jarima/bonus o'zgarganda)
// ---------------------------------------------------------------------------

/** Shu oyning QORALAMA vedomosti bo'lsa bonus/jarima yig'indilari yangilanadi. */
async function payrollSinxronTx(tx: BusinessTx, businessId: string, employeeId: string, oy: string) {
  const payroll = await tx.payroll.findFirst({
    where: { businessId, employeeId, oy, holat: "qoralama" },
  });
  if (!payroll) return;

  const { from, to } = monthRangeUTC(oy);
  const [jarimaAgg, bonusAgg] = await Promise.all([
    tx.employeePenalty.aggregate({
      where: { businessId, employeeId, holat: "tasdiqlandi", sana: { gte: from, lt: to } },
      _sum: { summa: true },
    }),
    tx.employeeBonus.aggregate({
      where: { businessId, employeeId, sana: { gte: from, lt: to } },
      _sum: { summa: true },
    }),
  ]);
  const jarimalar = jarimaAgg._sum.summa ?? 0;
  const bonuslar = bonusAgg._sum.summa ?? 0;
  await tx.payroll.update({
    where: { id: payroll.id },
    data: {
      jarimalar,
      bonuslar,
      tolanadigan: Math.max(
        0,
        payroll.hisoblangan +
          payroll.qoshimcha +
          bonuslar -
          payroll.ushlab -
          jarimalar -
          payroll.avans
      ),
    },
  });
}

function oyStr(sana: Date): string {
  return utcDateToDateOnlyString(sana).slice(0, 7);
}

// ---------------------------------------------------------------------------
// Jarima: qo'lda yaratish va qaror (tasdiqlash/rad)
// ---------------------------------------------------------------------------

export async function createJarima(businessId: string, userId: string, data: CreatePenaltyInput) {
  const xodim = await prisma.employee.findFirst({
    where: { id: data.employeeId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");
  return prisma.employeePenalty.create({
    data: {
      businessId,
      employeeId: data.employeeId,
      sana: dateOnlyStringToUTCDate(data.sana),
      summa: data.summa,
      aslSumma: data.summa,
      sabab: data.sabab,
      izoh: data.izoh?.trim() || undefined,
      manba: "qolda",
      holat: "kutilmoqda",
      userId,
    },
  });
}

export async function jarimaQaror(params: {
  businessId: string;
  userId: string;
  penaltyId: string;
  data: PenaltyQarorInput;
}) {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const jarima = await tx.employeePenalty.findFirst({
      where: { id: params.penaltyId, businessId: params.businessId },
    });
    if (!jarima) throw new ForbiddenError("Jarima topilmadi");
    if (jarima.holat !== "kutilmoqda") {
      throw new BadRequestError("Bu jarima bo'yicha qaror allaqachon qabul qilingan");
    }

    const oy = oyStr(jarima.sana);
    if (params.data.amal === "tasdiqlash") {
      const payroll = await tx.payroll.findFirst({
        where: { businessId: params.businessId, employeeId: jarima.employeeId, oy },
        select: { holat: true },
      });
      if (payroll?.holat === "tolangan") {
        throw new BadRequestError(
          "Bu oy oyligi allaqachon to'langan — jarimani keyingi oyga qo'lda yozing"
        );
      }
      const yangilangan = await tx.employeePenalty.update({
        where: { id: jarima.id },
        data: {
          holat: "tasdiqlandi",
          summa: params.data.summa ?? jarima.summa,
          tasdiqlaganId: params.userId,
          tasdiqlanganAt: new Date(),
          ...(params.data.izoh !== undefined ? { izoh: params.data.izoh?.trim() || null } : {}),
        },
      });
      await payrollSinxronTx(tx, params.businessId, jarima.employeeId, oy);
      return yangilangan;
    }

    return tx.employeePenalty.update({
      where: { id: jarima.id },
      data: {
        holat: "rad",
        radEtganId: params.userId,
        radEtilganAt: new Date(),
        ...(params.data.izoh !== undefined ? { izoh: params.data.izoh?.trim() || null } : {}),
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "employeePenalty",
    entityId: params.penaltyId,
    after: { holat: natija.holat, summa: natija.summa, aslSumma: natija.aslSumma },
  });
  return natija;
}

// ---------------------------------------------------------------------------
// Bonus
// ---------------------------------------------------------------------------

export async function createBonus(businessId: string, userId: string, data: CreateBonusInput) {
  const sana = dateOnlyStringToUTCDate(data.sana);
  const oy = oyStr(sana);

  const natija = await runBusinessTx(businessId, async (tx) => {
    const xodim = await tx.employee.findFirst({
      where: { id: data.employeeId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const payroll = await tx.payroll.findFirst({
      where: { businessId, employeeId: data.employeeId, oy },
      select: { holat: true },
    });
    if (payroll?.holat === "tolangan") {
      throw new BadRequestError("Bu oy oyligi allaqachon to'langan — bonusni keyingi oyga yozing");
    }

    const bonus = await tx.employeeBonus.create({
      data: {
        businessId,
        employeeId: data.employeeId,
        sana,
        summa: data.summa,
        sabab: data.sabab,
        izoh: data.izoh?.trim() || undefined,
        userId,
      },
    });
    await payrollSinxronTx(tx, businessId, data.employeeId, oy);
    return bonus;
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "employeeBonus",
    entityId: natija.id,
    after: { summa: natija.summa, sabab: natija.sabab },
  });
  return natija;
}

export async function deleteBonus(businessId: string, id: string) {
  return runBusinessTx(businessId, async (tx) => {
    const bonus = await tx.employeeBonus.findFirst({ where: { id, businessId } });
    if (!bonus) throw new ForbiddenError("Bonus topilmadi");
    const oy = oyStr(bonus.sana);
    const payroll = await tx.payroll.findFirst({
      where: { businessId, employeeId: bonus.employeeId, oy },
      select: { holat: true },
    });
    if (payroll?.holat === "tolangan") {
      throw new BadRequestError("Bu oy oyligi to'langan — bonusni o'chirib bo'lmaydi");
    }
    await tx.employeeBonus.delete({ where: { id: bonus.id } });
    await payrollSinxronTx(tx, businessId, bonus.employeeId, oy);
    return { ok: true };
  });
}
