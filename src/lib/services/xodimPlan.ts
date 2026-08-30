import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import type { PlanInput } from "@/lib/validation/hr";

/**
 * XODIM OYLIK PLANI — CRUD. Bir xodim + bir oy = bitta yozuv (upsert):
 * o'sha oy plani qayta kiritilsa ustiga yoziladi, BOSHQA oylar tegilmaydi —
 * shu bois o'tgan oy statistikasi keyingi oy plan o'zgarsa buzilmaydi.
 */

export async function upsertXodimPlan(businessId: string, userId: string, data: PlanInput) {
  const xodim = await prisma.employee.findFirst({
    where: { id: data.employeeId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  const qiymatlar = {
    planTuri: data.planTuri,
    maqsad: data.maqsad,
    izoh: data.izoh?.trim() || null,
    userId,
  };

  const mavjud = await prisma.employeePlan.findFirst({
    where: { businessId, employeeId: data.employeeId, oy: data.oy },
    select: { id: true },
  });
  if (mavjud) {
    return prisma.employeePlan.update({ where: { id: mavjud.id }, data: qiymatlar });
  }
  return prisma.employeePlan.create({
    data: { businessId, employeeId: data.employeeId, oy: data.oy, ...qiymatlar },
  });
}

export async function deleteXodimPlan(businessId: string, planId: string) {
  const mavjud = await prisma.employeePlan.findFirst({
    where: { id: planId, businessId },
    select: { id: true },
  });
  if (!mavjud) throw new ForbiddenError("Plan topilmadi");
  await prisma.employeePlan.delete({ where: { id: mavjud.id } });
  return { ok: true };
}
