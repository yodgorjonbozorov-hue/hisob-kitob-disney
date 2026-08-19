import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { biriktirilganBiznesIdlari } from "@/lib/business";

/**
 * BOTDA BIZNES RO'YXATI — ko'p-bizneslikni hisobga olib.
 *
 * Xodim bir nechta biznesga biriktirilishi mumkin (`UserBusiness`). Botdagi
 * har bir oqim ("qaysi biznes uchun?") shu ro'yxatdan foydalanadi:
 *   · biriktirilgan bo'lsa — faqat o'sha bizneslar;
 *   · biriktirilmagan (direktor/administrator) — barcha faol bizneslar.
 *
 * FAIL-CLOSED: biriktiruv qatori bo'lmasa, lekin eski `User.businessId`
 * to'lgan bo'lsa — o'sha bitta biznes qaytariladi (ruxsat kengaymaydi).
 *
 * Chaqiruvchi qo'shimcha shart bera oladi (masalan `turi: "avto"`).
 */
export async function botBizneslar(
  user: User,
  qoshimcha: Prisma.BusinessWhereInput = {}
) {
  const biriktirilgan = await biriktirilganBiznesIdlari(user.id);
  const idlar = biriktirilgan.length > 0 ? biriktirilgan : user.businessId ? [user.businessId] : [];

  return prisma.business.findMany({
    where: {
      isActive: true,
      ...qoshimcha,
      ...(idlar.length > 0 ? { id: { in: idlar } } : {}),
    },
    orderBy: { nomi: "asc" },
  });
}

/**
 * Tanlangan biznes shu xodimga ochiqmi (callback tugmalarini tekshirish uchun).
 * Eskirgan tugma yoki begona id shu yerda to'xtaydi.
 */
export async function botBiznesRuxsati(user: User, businessId: string): Promise<boolean> {
  const bizneslar = await botBizneslar(user);
  return bizneslar.some((b) => b.id === businessId);
}
