import { prisma } from "@/lib/prisma";
import { runBusinessTx } from "@/lib/db/businessTx";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { hisoblaXodim } from "./oylik";

/**
 * OYLIK HOLATI VA OYNI YOPISH.
 *
 * Holatlar zanjiri:
 *   QORALAMA    — snapshot yozuvi YO'Q. Hisob real vaqtda manbadan chiqadi.
 *   HISOBLANDI  — oy yopildi, raqamlar muzlatildi (`KpiPayroll` yozuvi).
 *   TASDIQLANDI — direktor hisobni tasdiqladi.
 *   TOLANDI     — pul berildi (kim, qachon, qancha — yozib qo'yiladi).
 *
 * NEGA SNAPSHOT: yopilgandan keyin CRM'da zakaz o'zgarsa yoki qarz yopilsa
 * o'tgan oyning oyligi JIMGINA siljib ketmasligi kerak. Snapshot bor bo'lsa
 * hisob endi manbadan EMAS, o'sha yozuvdan o'qiladi (lib/kpi/oylik.ts).
 *
 * TUZATISH: yopilgan raqam tahrirlanmaydi. `KpiPayrollAdjustment` alohida
 * qator bo'lib qo'shiladi va `tuzatish`/`jami` shundan qayta yig'iladi —
 * kim, qachon, nega tuzatgani ko'rinib turadi.
 */

export type OylikHolati = "QORALAMA" | "HISOBLANDI" | "TASDIQLANDI" | "TOLANDI";

/**
 * OYNI YOPISH — joriy hisobni snapshot qilib yozadi.
 *
 * Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
 * yozilgan. UNIQUE(employeeId, oy) tufayli parallel ikki so'rov ikkita
 * snapshot yarata olmaydi.
 */
export async function oyniYop(params: {
  businessId: string;
  employeeId: string;
  oy: string;
  userId: string;
  izoh?: string | null;
}) {
  const natija = await hisoblaXodim(params.businessId, params.employeeId, params.oy);
  if (!natija) throw new ForbiddenError("Xodim topilmadi");
  const h = natija.hisob;
  if (h.yakuniy) throw new BadRequestError("Bu oy allaqachon yopilgan");

  return runBusinessTx(params.businessId, async (tx) => {
    const bor = await tx.kpiPayroll.findFirst({
      where: { businessId: params.businessId, employeeId: params.employeeId, oy: params.oy },
      select: { id: true },
    });
    if (bor) throw new BadRequestError("Bu oy allaqachon yopilgan");

    const payroll = await tx.kpiPayroll.create({
      data: {
        businessId: params.businessId,
        employeeId: params.employeeId,
        oy: params.oy,
        sotuv: h.sotuv,
        plan: h.plan,
        vazifaHaqi: h.vazifaHaqi,
        sotuvBonusi: h.sotuvBonusi,
        planBonusi: h.planBonusi,
        tuzatish: 0,
        jami: h.jami,
        holat: "HISOBLANDI",
        izoh: params.izoh?.trim() || null,
        userId: params.userId,
      },
    });

    for (const v of h.vazifalar) {
      await tx.kpiPayrollItem.create({
        data: {
          businessId: params.businessId,
          payrollId: payroll.id,
          taskId: v.taskId || null,
          taskNomi: v.nomi,
          oylikHaq: v.oylikHaq,
          ball: v.ball,
          foiz: v.foiz,
          hisoblangan: v.hisoblangan,
        },
      });
    }

    return payroll;
  });
}

/** Yopilgan oylikni QAYTA OCHISH — snapshot o'chiriladi, hisob yana jonli bo'ladi. */
export async function oyniQaytaOch(params: {
  businessId: string;
  payrollId: string;
}) {
  return runBusinessTx(params.businessId, async (tx) => {
    const p = await tx.kpiPayroll.findFirst({
      where: { id: params.payrollId, businessId: params.businessId },
    });
    if (!p) throw new ForbiddenError("Oylik yozuvi topilmadi");
    if (p.holat === "TOLANDI") {
      throw new BadRequestError("To'langan oylikni qayta ochib bo'lmaydi");
    }
    // Qatorlar va tuzatishlar Cascade bilan ketadi (FK siyosati).
    await tx.kpiPayroll.deleteMany({ where: { id: p.id, businessId: params.businessId } });
    return { id: p.id, employeeId: p.employeeId, oy: p.oy };
  });
}

/** TASDIQLASH — direktor hisobni qabul qiladi. */
export async function oylikTasdiqla(params: {
  businessId: string;
  payrollId: string;
  userId: string;
}) {
  return runBusinessTx(params.businessId, async (tx) => {
    const p = await tx.kpiPayroll.findFirst({
      where: { id: params.payrollId, businessId: params.businessId },
    });
    if (!p) throw new ForbiddenError("Oylik yozuvi topilmadi");
    if (p.holat !== "HISOBLANDI") {
      throw new BadRequestError("Faqat hisoblangan oylikni tasdiqlash mumkin");
    }
    return tx.kpiPayroll.update({
      where: { id: p.id },
      data: {
        holat: "TASDIQLANDI",
        tasdiqlaganId: params.userId,
        tasdiqlanganAt: new Date(),
      },
    });
  });
}

/**
 * TO'LANDI deb belgilash.
 *
 * Pul yozuvi (chiqim tranzaksiyasi) bu yerda ATAYLAB yozilmaydi: mavjud
 * `Payroll` (stavka vedomosti) allaqachon oylik chiqimini yozadi va bu
 * modul o'sha pulni IKKINCHI marta chiqim qilib ko'rsatmasligi kerak.
 * Bu yozuv — KPI hisobining yakuni va kelajakdagi buxgalteriya
 * integratsiyasi uchun tayyor nuqta (kim, qachon, qancha to'ladi).
 */
export async function oylikTolandi(params: {
  businessId: string;
  payrollId: string;
  userId: string;
  summa?: number | null;
}) {
  return runBusinessTx(params.businessId, async (tx) => {
    const p = await tx.kpiPayroll.findFirst({
      where: { id: params.payrollId, businessId: params.businessId },
    });
    if (!p) throw new ForbiddenError("Oylik yozuvi topilmadi");
    if (p.holat !== "TASDIQLANDI") {
      throw new BadRequestError("Avval oylikni tasdiqlang");
    }
    const summa = params.summa ?? p.jami;
    if (!Number.isInteger(summa) || summa < 0) {
      throw new BadRequestError("To'lov summasi noto'g'ri");
    }
    return tx.kpiPayroll.update({
      where: { id: p.id },
      data: {
        holat: "TOLANDI",
        tolaganId: params.userId,
        tolanganAt: new Date(),
        tolanganSumma: summa,
      },
    });
  });
}

/**
 * TUZATISH QATORI — yopilgan oylikka qo'shimcha yoki ushlab qolish.
 * Snapshot raqamlari tegilmaydi; `tuzatish` va `jami` qatorlardan qayta
 * yig'iladi, ya'ni ikkinchi haqiqat manbai paydo bo'lmaydi.
 */
export async function tuzatishQosh(params: {
  businessId: string;
  payrollId: string;
  summa: number;
  sabab: string;
  userId: string;
  userIsm: string | null;
}) {
  if (!Number.isInteger(params.summa) || params.summa === 0) {
    throw new BadRequestError("Tuzatish summasi nolga teng bo'lmagan butun son bo'lishi kerak");
  }
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Tuzatish sababi yozilishi shart");

  return runBusinessTx(params.businessId, async (tx) => {
    const p = await tx.kpiPayroll.findFirst({
      where: { id: params.payrollId, businessId: params.businessId },
    });
    if (!p) throw new ForbiddenError("Oylik yozuvi topilmadi");
    if (p.holat === "TOLANDI") {
      throw new BadRequestError("To'langan oylikni tuzatib bo'lmaydi");
    }

    await tx.kpiPayrollAdjustment.create({
      data: {
        businessId: params.businessId,
        payrollId: p.id,
        summa: params.summa,
        sabab,
        userId: params.userId,
        userIsm: params.userIsm,
      },
    });

    const agg = await tx.kpiPayrollAdjustment.aggregate({
      where: { businessId: params.businessId, payrollId: p.id },
      _sum: { summa: true },
    });
    const tuzatish = agg._sum.summa ?? 0;

    return tx.kpiPayroll.update({
      where: { id: p.id },
      data: {
        tuzatish,
        jami: p.vazifaHaqi + p.sotuvBonusi + p.planBonusi + tuzatish,
      },
    });
  });
}

export interface TuzatishDTO {
  id: string;
  summa: number;
  sabab: string;
  userIsm: string | null;
  sana: string;
}

/** Oylik yozuvining tuzatish qatorlari (detal sahifasida ko'rinadi). */
export async function tuzatishlar(
  businessId: string,
  payrollId: string
): Promise<TuzatishDTO[]> {
  const rows = await prisma.kpiPayrollAdjustment.findMany({
    where: { businessId, payrollId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    summa: r.summa,
    sabab: r.sabab,
    userIsm: r.userIsm,
    sana: r.createdAt.toISOString().slice(0, 10),
  }));
}
