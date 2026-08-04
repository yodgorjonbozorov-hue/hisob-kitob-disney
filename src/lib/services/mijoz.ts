import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import type { BusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { formatSom } from "@/lib/format";
import type { CreateMijozInput, UpdateMijozInput } from "@/lib/validation/mijoz";

export async function createMijoz(businessId: string, userId: string, data: CreateMijozInput) {
  return prisma.contact.create({
    data: {
      businessId,
      ism: data.ism,
      tel: data.tel?.trim() || undefined,
      telegram: data.telegram?.trim() || undefined,
      izoh: data.izoh?.trim() || undefined,
      qarzLimit: data.qarzLimit ?? null,
      createdBy: userId,
    },
  });
}

export async function updateMijoz(businessId: string, id: string, data: UpdateMijozInput) {
  const mavjud = await prisma.contact.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Mijoz topilmadi");

  return prisma.contact.update({
    where: { id },
    data: {
      ...(data.ism ? { ism: data.ism } : {}),
      ...(data.tel !== undefined ? { tel: data.tel?.trim() || null } : {}),
      ...(data.telegram !== undefined ? { telegram: data.telegram?.trim() || null } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      ...(data.qarzLimit !== undefined ? { qarzLimit: data.qarzLimit } : {}),
    },
  });
}

/**
 * Mijozni o'chirish — yumshoq. Sotuv va qarz tarixi `contactId` orqali
 * bog'langan; qattiq o'chirish "bu qarz kimniki edi?" degan savolni
 * javobsiz qoldirardi.
 */
export async function deleteMijoz(businessId: string, id: string) {
  const mavjud = await prisma.contact.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Mijoz topilmadi");

  const ochiqQarz = await prisma.debt.aggregate({
    where: { businessId, contactId: id, isYopilgan: false, turi: "olinadigan" },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const qoldiq = (ochiqQarz._sum.jamiSumma ?? 0) - (ochiqQarz._sum.tolangan ?? 0);
  if (qoldiq > 0) {
    throw new BadRequestError(
      `Bu mijozda ${formatSom(qoldiq)} so'm yopilmagan qarz bor — avval hisob-kitobni yakunlang`
    );
  }

  await prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ businessId, action: "delete", entity: "contact", entityId: id });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Qarz limiti
// ---------------------------------------------------------------------------

export interface QarzHolati {
  limit: number | null;
  /** Yopilmagan "olinadigan" qarzlar qoldig'i. */
  ochiqQarz: number;
  /** Limitgacha qolgan bo'sh joy; limit yo'q bo'lsa null. */
  qolgan: number | null;
}

export async function mijozQarzHolati(
  businessId: string,
  contactId: string
): Promise<QarzHolati> {
  const [contact, agg] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, businessId, deletedAt: null },
      select: { qarzLimit: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, contactId, isYopilgan: false, turi: "olinadigan" },
      _sum: { jamiSumma: true, tolangan: true },
    }),
  ]);
  if (!contact) throw new ForbiddenError("Mijoz topilmadi");

  const ochiqQarz = (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
  return {
    limit: contact.qarzLimit,
    ochiqQarz,
    qolgan: contact.qarzLimit === null ? null : contact.qarzLimit - ochiqQarz,
  };
}

/**
 * QARZ LIMITI TEKSHIRUVI — sotuv tranzaksiyasi ICHIDA chaqiriladi.
 *
 * Nega tranzaksiya ichida: limit tekshiruvi bilan qarz yozuvi orasida boshqa
 * sotuv o'tib ketsa, ikkalasi ham "limit yetadi" deb qaror qilardi va mijoz
 * chegaradan oshib ketardi. Bir tranzaksiyada ikkalasi bitta qarorga aylanadi.
 *
 * Xom `tx` delegatlari ishlatiladi, shuning uchun `businessId` QO'LDA yoziladi
 * (lib/db/businessTx.ts).
 */
export async function qarzLimitTekshirTx(
  tx: BusinessTx,
  businessId: string,
  contactId: string,
  yangiSumma: number
): Promise<void> {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: { ism: true, qarzLimit: true },
  });
  if (!contact) throw new ForbiddenError("Mijoz topilmadi");
  if (contact.qarzLimit === null) return;

  const agg = await tx.debt.aggregate({
    where: { businessId, contactId, isYopilgan: false, turi: "olinadigan" },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const ochiqQarz = (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);

  if (ochiqQarz + yangiSumma > contact.qarzLimit) {
    const qolgan = Math.max(0, contact.qarzLimit - ochiqQarz);
    throw new BadRequestError(
      `${contact.ism} uchun qarz limiti ${formatSom(contact.qarzLimit)} so'm. ` +
        `Hozirgi qarz ${formatSom(ochiqQarz)} so'm — bu sotuvga ${formatSom(qolgan)} so'm joy qolgan.`
    );
  }
}
