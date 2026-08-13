import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode, OBUNA_DAVRI_KUN } from "./plans";
import { BadRequestError } from "@/lib/auth/guard";

const KUN_MS = 24 * 60 * 60 * 1000;

/**
 * TIZIM-DARAJALI obuna amallari (rawPrisma) — SUPERADMIN paneli (FAZA 5) va
 * kelajakdagi onlayn provider webhook'lari shu funksiyalarni chaqiradi.
 * Oddiy tenant kodidan chaqirilmaydi.
 */

/**
 * To'lovni tasdiqlaydi va obunani uzaytiradi:
 *  - Payment -> CONFIRMED (+paidAt)
 *  - Yangi Subscription davri: boshi = max(hozir, joriy davr oxiri), davomiyligi 30 kun
 *  - Tenant -> status ACTIVE, currentPeriodEnd = yangi davr oxiri
 */
export async function confirmPayment(paymentId: string, now: Date = new Date()) {
  const payment = await rawPrisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new BadRequestError("To'lov topilmadi");
  if (payment.status === "CONFIRMED") throw new BadRequestError("Bu to'lov allaqachon tasdiqlangan");

  const tenant = await rawPrisma.tenant.findUnique({ where: { id: payment.tenantId } });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");

  // To'lov qaysi tarif uchun bo'lsa — tasdiqda tenant shu tarifga o'tadi (upgrade oqimi).
  const plan = planByCode(payment.plan ?? tenant.plan) ?? { code: tenant.plan };

  // Davr boshlanishi: joriy davr hali tugamagan bo'lsa uning oxiridan (kunlar yo'qolmaydi).
  const base =
    tenant.currentPeriodEnd && tenant.currentPeriodEnd.getTime() > now.getTime()
      ? tenant.currentPeriodEnd
      : now;
  const periodEnd = new Date(base.getTime() + OBUNA_DAVRI_KUN * KUN_MS);

  return rawPrisma.$transaction(async (tx) => {
    // Poyga himoyasi (H-8): holat sharti TRANZAKSIYA ICHIDA. Ilgari tekshiruv
    // tashqarida edi — ikki marta bosilgan qo'lda tasdiq (yoki takroriy webhook)
    // ikkita Subscription va ikki barobar muddat berishi mumkin edi. Endi
    // birinchisi CONFIRMED qiladi, ikkinchisi shu shartga ilinib xato oladi.
    const band = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "CONFIRMED" } },
      data: { status: "CONFIRMED", paidAt: now },
    });
    if (band.count === 0) {
      throw new BadRequestError("Bu to'lov allaqachon tasdiqlangan");
    }
    const updatedPayment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: plan.code,
        status: "ACTIVE",
        periodStart: base,
        periodEnd,
        amount: payment.amount,
      },
    });
    const updatedTenant = await tx.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE", currentPeriodEnd: periodEnd, plan: plan.code },
    });
    return { payment: updatedPayment, subscription, tenant: updatedTenant };
  });
}

/**
 * Cron: obuna davri tugagan ACTIVE tenantlarni PAST_DUE ga o'tkazadi.
 * (Guard computeAccess orqali cron'siz ham himoya qiladi — bu holatni
 * bazada ham aks ettirish uchun: panel/hisobotlarda to'g'ri ko'rinadi.)
 * TRIAL muddati tugashi statusni o'zgartirmaydi — computeAccess o'zi bloklaydi.
 */
export async function updateExpiredStatuses(now: Date = new Date()): Promise<number> {
  const res = await rawPrisma.tenant.updateMany({
    // Doimiy bepul mijozlar muddat bo'yicha PAST_DUE ga o'tkazilmaydi.
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now }, bepul: false },
    data: { status: "PAST_DUE" },
  });
  return res.count;
}

/**
 * Mijozni doimiy bepulga o'tkazadi yoki bekor qiladi (SUPERADMIN).
 * Muddat sanalariga tegilmaydi: bepul bekor qilinsa mijoz o'zining haqiqiy
 * obuna holatiga qaytadi.
 */
export async function setTenantBepul(tenantId: string, bepul: boolean) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  return rawPrisma.tenant.update({ where: { id: tenantId }, data: { bepul } });
}

/** To'lovni rad etadi (masalan, pul kelib tushmagan bo'lsa). */
export async function rejectPayment(paymentId: string, izoh?: string) {
  const payment = await rawPrisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new BadRequestError("To'lov topilmadi");
  if (payment.status !== "PENDING") throw new BadRequestError("Faqat kutilayotgan to'lov rad etiladi");
  return rawPrisma.payment.update({
    where: { id: paymentId },
    data: { status: "REJECTED", izoh: izoh ?? payment.izoh },
  });
}

/** Muddatni to'lovsiz uzaytirish (SUPERADMIN qo'lda, masalan bonus kunlar). */
export async function extendTenant(tenantId: string, kunlar: number, now: Date = new Date()) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  const base =
    tenant.currentPeriodEnd && tenant.currentPeriodEnd.getTime() > now.getTime()
      ? tenant.currentPeriodEnd
      : now;
  const periodEnd = new Date(base.getTime() + kunlar * KUN_MS);
  return rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { status: "ACTIVE", currentPeriodEnd: periodEnd },
  });
}
