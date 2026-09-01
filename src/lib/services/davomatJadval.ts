import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import type {
  CreateWorkLocationInput,
  UpdateWorkLocationInput,
  CreateWorkScheduleInput,
  UpdateWorkScheduleInput,
  HrSettingInput,
  XodimSiyosatInput,
} from "@/lib/validation/davomat";

// ---------------------------------------------------------------------------
// Ish joylari (GPS nuqtalari)
// ---------------------------------------------------------------------------

export async function listIshJoylari(businessId: string) {
  return prisma.workLocation.findMany({
    where: { businessId, deletedAt: null },
    orderBy: [{ standart: "desc" }, { createdAt: "asc" }],
  });
}

/** `standart=true` qilinsa boshqa nuqtalardan bayroq olinadi (bitta standart). */
export async function createIshJoyi(businessId: string, data: CreateWorkLocationInput) {
  return runBusinessTx(businessId, async (tx) => {
    if (data.standart) {
      await tx.workLocation.updateMany({
        where: { businessId, deletedAt: null, standart: true },
        data: { standart: false },
      });
    }
    return tx.workLocation.create({
      data: {
        businessId,
        nomi: data.nomi,
        lat: data.lat,
        lng: data.lng,
        radiusM: data.radiusM,
        standart: data.standart ?? false,
      },
    });
  });
}

export async function updateIshJoyi(
  businessId: string,
  id: string,
  data: UpdateWorkLocationInput
) {
  return runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.workLocation.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!mavjud) throw new ForbiddenError("Ish joyi topilmadi");
    if (data.standart) {
      await tx.workLocation.updateMany({
        where: { businessId, deletedAt: null, standart: true, id: { not: id } },
        data: { standart: false },
      });
    }
    return tx.workLocation.update({
      where: { id },
      data: {
        ...(data.nomi ? { nomi: data.nomi } : {}),
        ...(data.lat !== undefined ? { lat: data.lat } : {}),
        ...(data.lng !== undefined ? { lng: data.lng } : {}),
        ...(data.radiusM !== undefined ? { radiusM: data.radiusM } : {}),
        ...(data.standart !== undefined ? { standart: data.standart } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  });
}

export async function deleteIshJoyi(businessId: string, id: string) {
  const mavjud = await prisma.workLocation.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Ish joyi topilmadi");
  await prisma.workLocation.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, standart: false },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ish jadvallari
// ---------------------------------------------------------------------------

export async function listJadvallar(businessId: string) {
  return prisma.workSchedule.findMany({
    where: { businessId, deletedAt: null },
    include: { kunlar: { orderBy: { hafta: "asc" } } },
    orderBy: [{ standart: "desc" }, { createdAt: "asc" }],
  });
}

export async function createJadval(businessId: string, data: CreateWorkScheduleInput) {
  const haftalar = new Set(data.kunlar.map((k) => k.hafta));
  if (haftalar.size !== 7) throw new BadRequestError("Har hafta kuni bir martadan berilishi kerak");

  return runBusinessTx(businessId, async (tx) => {
    if (data.standart) {
      await tx.workSchedule.updateMany({
        where: { businessId, deletedAt: null, standart: true },
        data: { standart: false },
      });
    }
    return tx.workSchedule.create({
      data: {
        businessId,
        nomi: data.nomi,
        imtiyozDaqiqa: data.imtiyozDaqiqa,
        standart: data.standart ?? false,
        kuchgaKirgan: data.kuchgaKirgan ? dateOnlyStringToUTCDate(data.kuchgaKirgan) : undefined,
        kunlar: {
          create: data.kunlar.map((k) => ({
            businessId,
            hafta: k.hafta,
            ishKuni: k.ishKuni,
            boshlanish: k.ishKuni ? k.boshlanish : null,
            tugash: k.ishKuni ? k.tugash : null,
          })),
        },
      },
      include: { kunlar: { orderBy: { hafta: "asc" } } },
    });
  });
}

export async function updateJadval(businessId: string, id: string, data: UpdateWorkScheduleInput) {
  return runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.workSchedule.findFirst({ where: { id, businessId, deletedAt: null } });
    if (!mavjud) throw new ForbiddenError("Jadval topilmadi");

    if (data.standart) {
      await tx.workSchedule.updateMany({
        where: { businessId, deletedAt: null, standart: true, id: { not: id } },
        data: { standart: false },
      });
    }
    if (data.kunlar) {
      // Kunlar to'liq almashtiriladi (7 satr) — qisman patch chalkashlik tug'diradi.
      await tx.workScheduleDay.deleteMany({ where: { scheduleId: id, businessId } });
      await tx.workScheduleDay.createMany({
        data: data.kunlar.map((k) => ({
          businessId,
          scheduleId: id,
          hafta: k.hafta,
          ishKuni: k.ishKuni,
          boshlanish: k.ishKuni ? k.boshlanish ?? null : null,
          tugash: k.ishKuni ? k.tugash ?? null : null,
        })),
      });
    }
    return tx.workSchedule.update({
      where: { id },
      data: {
        ...(data.nomi ? { nomi: data.nomi } : {}),
        ...(data.imtiyozDaqiqa !== undefined ? { imtiyozDaqiqa: data.imtiyozDaqiqa } : {}),
        ...(data.standart !== undefined ? { standart: data.standart } : {}),
        ...(data.kuchgaKirgan !== undefined
          ? { kuchgaKirgan: data.kuchgaKirgan ? dateOnlyStringToUTCDate(data.kuchgaKirgan) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { kunlar: { orderBy: { hafta: "asc" } } },
    });
  });
}

export async function deleteJadval(businessId: string, id: string) {
  const mavjud = await prisma.workSchedule.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Jadval topilmadi");
  const biriktirilgan = await prisma.employee.count({
    where: { businessId, workScheduleId: id, deletedAt: null },
  });
  if (biriktirilgan > 0) {
    throw new BadRequestError(
      `Bu jadval ${biriktirilgan} ta xodimga biriktirilgan — avval ularni boshqa jadvalga o'tkazing`
    );
  }
  await prisma.workSchedule.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, standart: false },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Xodim davomat siyosati va HR sozlamalari
// ---------------------------------------------------------------------------

/** Jadval/ish joyi biriktiruvi va selfie/GPS/radius talablarini yangilaydi. */
export async function updateXodimSiyosati(
  businessId: string,
  employeeId: string,
  data: XodimSiyosatInput
) {
  const xodim = await prisma.employee.findFirst({
    where: { id: employeeId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  if (data.workScheduleId) {
    const jadval = await prisma.workSchedule.findFirst({
      where: { id: data.workScheduleId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!jadval) throw new BadRequestError("Jadval topilmadi yoki boshqa biznesga tegishli");
  }
  if (data.workLocationId) {
    const joy = await prisma.workLocation.findFirst({
      where: { id: data.workLocationId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!joy) throw new BadRequestError("Ish joyi topilmadi yoki boshqa biznesga tegishli");
  }

  return prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(data.workScheduleId !== undefined ? { workScheduleId: data.workScheduleId } : {}),
      ...(data.workLocationId !== undefined ? { workLocationId: data.workLocationId } : {}),
      ...(data.selfieTalab !== undefined ? { selfieTalab: data.selfieTalab } : {}),
      ...(data.gpsTalab !== undefined ? { gpsTalab: data.gpsTalab } : {}),
      ...(data.radiusTalab !== undefined ? { radiusTalab: data.radiusTalab } : {}),
    },
  });
}

export async function getHrSozlama(businessId: string) {
  const mavjud = await prisma.hrSetting.findFirst({ where: { businessId } });
  return mavjud ?? { businessId, xodimOylikKoradi: false, crmSotuvchiMajburiy: false };
}

export async function updateHrSozlama(businessId: string, data: HrSettingInput) {
  const mavjud = await prisma.hrSetting.findFirst({ where: { businessId } });
  if (mavjud) {
    return prisma.hrSetting.update({
      where: { id: mavjud.id },
      data: {
        ...(data.xodimOylikKoradi !== undefined ? { xodimOylikKoradi: data.xodimOylikKoradi } : {}),
        ...(data.crmSotuvchiMajburiy !== undefined
          ? { crmSotuvchiMajburiy: data.crmSotuvchiMajburiy }
          : {}),
      },
    });
  }
  return prisma.hrSetting.create({
    data: {
      businessId,
      xodimOylikKoradi: data.xodimOylikKoradi ?? false,
      crmSotuvchiMajburiy: data.crmSotuvchiMajburiy ?? false,
    },
  });
}
