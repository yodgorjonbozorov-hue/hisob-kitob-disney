import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/auth/session";
import { BadRequestError } from "@/lib/auth/guard";

export const ACTIVE_BUSINESS_COOKIE = "active_business";

export interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
  omborli: boolean;
}

/**
 * Foydalanuvchi kira oladigan bizneslar:
 * - Biznesga biriktirilgan foydalanuvchi (businessId bor — kassir yoki biznesga
 *   bog'langan sotuvchi) → faqat o'z biznesi.
 * - Biriktirilmagan (direktor/admin, ko'p-biznesli sotuvchi) → barcha faol biznes.
 */
export async function getAccessibleBusinesses(session: SessionData): Promise<BusinessDTO[]> {
  if (session.businessId) {
    const b = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: { id: true, nomi: true, isActive: true, omborli: true },
    });
    return b ? [b] : [];
  }
  return prisma.business.findMany({
    where: { isActive: true },
    select: { id: true, nomi: true, isActive: true, omborli: true },
    orderBy: { nomi: "asc" },
  });
}

/**
 * Joriy so'rov uchun aktiv biznes id'sini hal qiladi.
 * - Biznesga biriktirilgan foydalanuvchi (businessId bor): DOIM o'z biznesi
 *   (o'zgartira olmaydi) — kassir yoki biznesga bog'langan sotuvchi. Yozuvlari
 *   doim shu biznesga tushadi (adashmaydi).
 * - Biriktirilmagan (direktor/ko'p-biznesli sotuvchi): `active_business` cookie
 *   (mavjud va faol bo'lsa), aks holda birinchi faol biznes.
 * Hech qanday biznes bo'lmasa null qaytaradi.
 */
export async function resolveActiveBusinessId(session: SessionData): Promise<string | null> {
  if (session.businessId) {
    return session.businessId;
  }

  const cookieId = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  if (cookieId) {
    const exists = await prisma.business.findFirst({
      where: { id: cookieId, isActive: true },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  const first = await prisma.business.findFirst({
    where: { isActive: true },
    orderBy: { nomi: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export async function getActiveBusiness(session: SessionData): Promise<BusinessDTO | null> {
  const id = await resolveActiveBusinessId(session);
  if (!id) return null;
  return prisma.business.findUnique({
    where: { id },
    select: { id: true, nomi: true, isActive: true, omborli: true },
  });
}

/** Biznes omborli ekanini tekshiradi; bo'lmasa BadRequestError. Ombor route'lari boshida ishlatiladi. */
export async function requireOmborli(businessId: string): Promise<void> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { omborli: true } });
  if (!b?.omborli) {
    throw new BadRequestError("Bu biznesda ombor tizimi yoqilmagan");
  }
}
