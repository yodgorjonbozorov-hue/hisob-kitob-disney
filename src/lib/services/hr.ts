import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { dateOnlyStringToUTCDate, monthRangeUTC, todayDateOnlyString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { DAVOMAT_ULUSH, type DavomatHolat } from "@/lib/validation/hr";
import type {
  AvansInput,
  CreateEmployeeInput,
  DavomatInput,
  OylikHisoblaInput,
  UpdateEmployeeInput,
} from "@/lib/validation/hr";

/** Avtomatik chiqim kategoriyalari (yo'q bo'lsa yaratiladi). */
const OYLIK_KATEGORIYA = "Oylik";
const AVANS_KATEGORIYA = "Avans";

// ---------------------------------------------------------------------------
// Xodimlar
// ---------------------------------------------------------------------------

export async function createEmployee(businessId: string, data: CreateEmployeeInput) {
  const mavjud = await prisma.employee.findFirst({
    where: { businessId, ism: data.ism, deletedAt: null },
    select: { id: true },
  });
  if (mavjud) throw new BadRequestError("Bu ismdagi xodim allaqachon bor");

  return prisma.employee.create({
    data: {
      businessId,
      ism: data.ism,
      lavozim: data.lavozim?.trim() || undefined,
      tel: data.tel?.trim() || undefined,
      stavka: data.stavka,
      stavkaTuri: data.stavkaTuri,
      ishBoshlagan: data.ishBoshlagan ? dateOnlyStringToUTCDate(data.ishBoshlagan) : undefined,
      izoh: data.izoh?.trim() || undefined,
      userId: data.userId ?? undefined,
    },
  });
}

export async function updateEmployee(businessId: string, id: string, data: UpdateEmployeeInput) {
  const mavjud = await prisma.employee.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Xodim topilmadi");

  return prisma.employee.update({
    where: { id },
    data: {
      ...(data.ism ? { ism: data.ism } : {}),
      ...(data.lavozim !== undefined ? { lavozim: data.lavozim?.trim() || null } : {}),
      ...(data.tel !== undefined ? { tel: data.tel?.trim() || null } : {}),
      ...(data.stavka !== undefined ? { stavka: data.stavka } : {}),
      ...(data.stavkaTuri ? { stavkaTuri: data.stavkaTuri } : {}),
      ...(data.ishBoshlagan !== undefined
        ? { ishBoshlagan: data.ishBoshlagan ? dateOnlyStringToUTCDate(data.ishBoshlagan) : null }
        : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.userId !== undefined ? { userId: data.userId } : {}),
    },
  });
}

/**
 * Xodimni o'chirish — yumshoq. Oylik vedomostlari va davomat tarixi
 * saqlanadi: "o'tgan yili kimga qancha to'langan?" degan savolga javob
 * yo'qolmasligi kerak.
 */
export async function deleteEmployee(businessId: string, id: string) {
  const mavjud = await prisma.employee.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Xodim topilmadi");

  const tolanmagan = await prisma.payroll.count({
    where: { businessId, employeeId: id, holat: "qoralama", tolanadigan: { gt: 0 } },
  });
  if (tolanmagan > 0) {
    throw new BadRequestError(
      `Bu xodimda ${tolanmagan} ta to'lanmagan oylik vedomosti bor — avval hisob-kitobni yakunlang`
    );
  }

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Davomat
// ---------------------------------------------------------------------------

/** Bir xodim, bir kun — bitta yozuv (qayta belgilansa ustiga yoziladi). */
export async function davomatBelgila(businessId: string, data: DavomatInput) {
  const xodim = await prisma.employee.findFirst({
    where: { id: data.employeeId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  const sana = dateOnlyStringToUTCDate(data.sana);
  const mavjud = await prisma.attendance.findFirst({
    where: { businessId, employeeId: data.employeeId, sana },
    select: { id: true },
  });

  if (mavjud) {
    return prisma.attendance.update({
      where: { id: mavjud.id },
      data: { holat: data.holat, izoh: data.izoh?.trim() || null },
    });
  }
  return prisma.attendance.create({
    data: {
      businessId,
      employeeId: data.employeeId,
      sana,
      holat: data.holat,
      izoh: data.izoh?.trim() || undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Oylik hisobi
// ---------------------------------------------------------------------------

/** Oy ichidagi davomatdan ikkilangan kunlar (1 kun = 2, yarim kun = 1). */
async function yarimKunlarniSana(
  tx: BusinessTx,
  businessId: string,
  employeeId: string,
  oy: string
): Promise<number> {
  const { from, to } = monthRangeUTC(oy);
  const yozuvlar = await tx.attendance.findMany({
    where: { businessId, employeeId, sana: { gte: from, lt: to } },
    select: { holat: true },
  });
  return yozuvlar.reduce((a, y) => a + (DAVOMAT_ULUSH[y.holat as DavomatHolat] ?? 0), 0);
}

/**
 * OYLIKNI HISOBLASH — qoralama vedomost yaratadi yoki qayta hisoblaydi.
 *
 * Hech qanday pul yozuvi yozilmaydi: bu hali hisob-kitob. Pul faqat
 * `oylikTola` da chiqadi.
 *
 * - "oylik" stavkada asos — to'liq stavka (kam ishlagani `ushlab` bilan
 *   qo'lda hisobga olinadi; avtomatik proporsiya ataylab yo'q, chunki
 *   o'zbek amaliyotida oylik ishchi kunlar soniga qarab o'zgarmaydi);
 * - "kunlik" stavkada asos — davomatdan hisoblangan kunlar × stavka.
 */
export async function oylikHisobla(
  businessId: string,
  userId: string,
  data: OylikHisoblaInput
) {
  return runBusinessTx(businessId, async (tx) => {
    const xodim = await tx.employee.findFirst({
      where: { id: data.employeeId, businessId, deletedAt: null },
    });
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const mavjud = await tx.payroll.findFirst({
      where: { businessId, employeeId: data.employeeId, oy: data.oy },
    });
    if (mavjud && mavjud.holat === "tolangan") {
      throw new BadRequestError("Bu oy uchun oylik allaqachon to'langan — qayta hisoblab bo'lmaydi");
    }

    const yarimKunlar = await yarimKunlarniSana(tx, businessId, data.employeeId, data.oy);
    const hisoblangan =
      xodim.stavkaTuri === "kunlik"
        ? Math.round((xodim.stavka * yarimKunlar) / 2)
        : xodim.stavka;

    const avansAgg = await tx.payrollAdvance.aggregate({
      where: { businessId, employeeId: data.employeeId, oy: data.oy },
      _sum: { summa: true },
    });
    const avans = avansAgg._sum.summa ?? 0;

    // Davomat 2.0: oy bo'yicha bonuslar va TASDIQLANGAN jarimalar (snapshot).
    const { from, to } = monthRangeUTC(data.oy);
    const [bonusAgg, jarimaAgg] = await Promise.all([
      tx.employeeBonus.aggregate({
        where: { businessId, employeeId: data.employeeId, sana: { gte: from, lt: to } },
        _sum: { summa: true },
      }),
      tx.employeePenalty.aggregate({
        where: {
          businessId,
          employeeId: data.employeeId,
          holat: "tasdiqlandi",
          sana: { gte: from, lt: to },
        },
        _sum: { summa: true },
      }),
    ]);
    const bonuslar = bonusAgg._sum.summa ?? 0;
    const jarimalar = jarimaAgg._sum.summa ?? 0;

    const qoshimcha = data.qoshimcha ?? mavjud?.qoshimcha ?? 0;
    const ushlab = data.ushlab ?? mavjud?.ushlab ?? 0;
    // Manfiy oylik yozilmaydi: avans hisoblangandan ko'p bo'lsa qarz keyingi
    // oyga o'tadi (bu yerda 0 bilan cheklanadi, farq izohda ko'rinadi).
    const tolanadigan = Math.max(
      0,
      hisoblangan + qoshimcha + bonuslar - ushlab - jarimalar - avans
    );

    const qiymatlar = {
      yarimKunlar,
      hisoblangan,
      qoshimcha,
      ushlab,
      bonuslar,
      jarimalar,
      avans,
      tolanadigan,
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
    };

    if (mavjud) {
      return tx.payroll.update({ where: { id: mavjud.id }, data: qiymatlar });
    }
    return tx.payroll.create({
      data: { businessId, employeeId: data.employeeId, oy: data.oy, userId, ...qiymatlar },
    });
  });
}

/**
 * OYLIKNI TO'LASH — shu yerda birinchi marta pul chiqadi.
 *
 * `tolanadigan` summa bitta chiqim tranzaksiyasiga aylanadi. Avans allaqachon
 * chiqim bo'lgani uchun undan chegirilgan — bir xil pul ikki marta chiqim
 * bo'lib ko'rinmaydi.
 */
export async function oylikTola(params: {
  businessId: string;
  payrollId: string;
  userId: string;
  sana?: string | null;
}) {
  const sana = params.sana ?? todayDateOnlyString();

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const payroll = await tx.payroll.findFirst({
      where: { id: params.payrollId, businessId: params.businessId },
    });
    if (!payroll) throw new ForbiddenError("Oylik vedomosti topilmadi");
    if (payroll.holat === "tolangan") throw new BadRequestError("Bu oylik allaqachon to'langan");
    if (payroll.tolanadigan <= 0) {
      throw new BadRequestError(
        "To'lanadigan summa nol — avans hisoblangandan kam emas yoki stavka kiritilmagan"
      );
    }

    const xodim = await tx.employee.findFirst({
      where: { id: payroll.employeeId, businessId: params.businessId },
      select: { ism: true },
    });

    const categoryId = await ensureCategoryTx(tx, params.businessId, OYLIK_KATEGORIYA, "chiqim");
    const txn = await createTransactionTx(tx, params.userId, params.businessId, {
      turi: "chiqim",
      categoryId,
      summa: payroll.tolanadigan,
      sana,
      izoh: `Oylik ${payroll.oy}: ${xodim?.ism ?? "xodim"}`,
    });

    return tx.payroll.update({
      where: { id: payroll.id },
      data: {
        holat: "tolangan",
        tolanganSana: dateOnlyStringToUTCDate(sana),
        transactionId: txn.id,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "payroll",
    entityId: params.payrollId,
    after: { holat: "tolangan", summa: natija.tolanadigan, oy: natija.oy },
  });
  return natija;
}

/**
 * AVANS BERISH — pul DARHOL chiqadi.
 *
 * Chiqim tranzaksiyasi va avans yozuvi bitta atomik amalda yoziladi. Shu
 * oyning qoralama vedomosti bo'lsa, u ham darhol qayta hisoblanadi —
 * "to'lanadigan" raqami eskirib qolmasligi kerak.
 */
export async function avansBer(businessId: string, userId: string, data: AvansInput) {
  const sana = data.sana ?? todayDateOnlyString();

  const natija = await runBusinessTx(businessId, async (tx) => {
    const xodim = await tx.employee.findFirst({
      where: { id: data.employeeId, businessId, deletedAt: null },
      select: { ism: true },
    });
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const payroll = await tx.payroll.findFirst({
      where: { businessId, employeeId: data.employeeId, oy: data.oy },
    });
    if (payroll?.holat === "tolangan") {
      throw new BadRequestError("Bu oy oyligi to'langan — avansni keyingi oyga yozing");
    }

    const categoryId = await ensureCategoryTx(tx, businessId, AVANS_KATEGORIYA, "chiqim");
    const txn = await createTransactionTx(tx, userId, businessId, {
      turi: "chiqim",
      categoryId,
      summa: data.summa,
      sana,
      izoh: `Avans ${data.oy}: ${xodim.ism}`,
    });

    const avans = await tx.payrollAdvance.create({
      data: {
        businessId,
        employeeId: data.employeeId,
        oy: data.oy,
        summa: data.summa,
        sana: dateOnlyStringToUTCDate(sana),
        izoh: data.izoh?.trim() || undefined,
        transactionId: txn.id,
        userId,
      },
    });

    // Qoralama vedomost bo'lsa — avans va to'lanadigan darhol yangilanadi.
    if (payroll) {
      const yangiAvans = payroll.avans + data.summa;
      await tx.payroll.update({
        where: { id: payroll.id },
        data: {
          avans: yangiAvans,
          tolanadigan: Math.max(
            0,
            payroll.hisoblangan +
              payroll.qoshimcha +
              payroll.bonuslar -
              payroll.ushlab -
              payroll.jarimalar -
              yangiAvans
          ),
        },
      });
    }

    return avans;
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "payrollAdvance",
    entityId: natija.id,
    after: { summa: natija.summa, oy: natija.oy },
  });
  return natija;
}
