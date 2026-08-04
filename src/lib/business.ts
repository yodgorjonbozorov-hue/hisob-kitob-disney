import { perRequestCache } from "@/lib/perRequestCache";
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
  /** "umumiy" | "avto" — ombor moduli qaysi rejimda ko'rinadi (lib/biznesTuri.ts). */
  turi: string;
}

/**
 * Foydalanuvchi kira oladigan bizneslar:
 * - Biznesga biriktirilgan foydalanuvchi (businessId bor — kassir yoki biznesga
 *   bog'langan sotuvchi) → faqat o'z biznesi.
 * - Biriktirilmagan (direktor/admin, ko'p-biznesli sotuvchi) → barcha faol biznes.
 */
const BUSINESS_FIELDS = { id: true, nomi: true, isActive: true, omborli: true, turi: true } as const;

/**
 * Quyidagi uchta funksiya (bizneslar ro'yxati, aktiv biznes id, aktiv biznes)
 * har bir so'rovda layout, sahifa va guard'lar tomonidan bir necha bor chaqiriladi.
 * React cache bilan memoizatsiya qilingan — kalit sifatida faqat primitiv qiymat
 * (biriktirilgan businessId) ishlatiladi, tenant esa ALS kontekstidan keladi va
 * bitta so'rov davomida o'zgarmaydi.
 */
const accessibleBusinesses = perRequestCache(async function accessibleBusinesses(
  attachedBusinessId: string | null
): Promise<BusinessDTO[]> {
  if (attachedBusinessId) {
    const b = await prisma.business.findUnique({
      where: { id: attachedBusinessId },
      select: BUSINESS_FIELDS,
    });
    return b ? [b] : [];
  }
  return prisma.business.findMany({
    where: { isActive: true },
    select: BUSINESS_FIELDS,
    orderBy: { nomi: "asc" },
  });
});

export async function getAccessibleBusinesses(session: SessionData): Promise<BusinessDTO[]> {
  return accessibleBusinesses(session.businessId ?? null);
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
const activeBusinessId = perRequestCache(async function activeBusinessId(
  attachedBusinessId: string | null
): Promise<string | null> {
  if (attachedBusinessId) {
    return attachedBusinessId;
  }

  // Ro'yxat allaqachon memoizatsiya qilingan — cookie tekshiruvi va "birinchi faol
  // biznes" uchun alohida so'rovlar kerak emas, xotiradagi ro'yxatdan tanlanadi.
  const businesses = await accessibleBusinesses(null);
  if (businesses.length === 0) return null;

  const cookieId = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  if (cookieId) {
    const match = businesses.find((b) => b.id === cookieId && b.isActive);
    if (match) return match.id;
  }

  // `accessibleBusinesses` allaqachon nomi bo'yicha tartiblangan.
  return businesses[0].id;
});

export async function resolveActiveBusinessId(session: SessionData): Promise<string | null> {
  return activeBusinessId(session.businessId ?? null);
}

const businessById = perRequestCache(async function businessById(id: string): Promise<BusinessDTO | null> {
  return prisma.business.findUnique({ where: { id }, select: BUSINESS_FIELDS });
});

export async function getActiveBusiness(session: SessionData): Promise<BusinessDTO | null> {
  const id = await resolveActiveBusinessId(session);
  if (!id) return null;
  // Biriktirilmagan foydalanuvchida ro'yxat allaqachon yuklangan — undan olamiz.
  if (!session.businessId) {
    const list = await accessibleBusinesses(null);
    const found = list.find((b) => b.id === id);
    if (found) return found;
  }
  return businessById(id);
}

/** Biznes omborli ekanini tekshiradi; bo'lmasa BadRequestError. Ombor route'lari boshida ishlatiladi. */
export async function requireOmborli(businessId: string): Promise<void> {
  const b = await businessById(businessId);
  if (!b?.omborli) {
    throw new BadRequestError("Bu biznesda ombor tizimi yoqilmagan");
  }
}

/** Biznes avto rejimida ekanini tekshiradi (avtopark route'lari uchun). */
export async function requireAvto(businessId: string): Promise<void> {
  const b = await businessById(businessId);
  if (!b?.omborli || b.turi !== "avto") {
    throw new BadRequestError("Bu biznes avto rejimida emas");
  }
}
