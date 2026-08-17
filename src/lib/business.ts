import { requestCache } from "@/lib/requestCache";
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
  /** Naqd yozuv xodimning shaxsiy kassasiga tushadimi (lib/services/kassaTanlash.ts). */
  shaxsiyKassa: boolean;
}

/**
 * Foydalanuvchi kira oladigan bizneslar:
 * - Biznesga biriktirilgan foydalanuvchi (businessId bor — kassir yoki biznesga
 *   bog'langan sotuvchi) → faqat o'z biznesi.
 * - Biriktirilmagan (direktor/admin, ko'p-biznesli sotuvchi) → barcha faol biznes.
 */
export async function getAccessibleBusinesses(session: SessionData): Promise<BusinessDTO[]> {
  if (session.businessId) {
    const b = await businessByIdCached(session.businessId);
    return b ? [b] : [];
  }
  return activeBusinessesCached(session.tenantId ?? "");
}

/**
 * Bir request ichida layout ham, sahifa ham shu so'rovlarni takrorlaydi —
 * `cache()` ularni bitta DB so'roviga birlashtiradi (so'rovlararo kesh EMAS).
 * Tenant filtri baribir prisma extension'da — bu faqat dedupe.
 */
const businessByIdCached = requestCache(async (id: string) =>
  prisma.business.findUnique({
    where: { id },
    select: { id: true, nomi: true, isActive: true, omborli: true, turi: true, shaxsiyKassa: true },
  })
);

const activeBusinessesCached = requestCache(async (_tenantId: string) =>
  prisma.business.findMany({
    where: { isActive: true },
    select: { id: true, nomi: true, isActive: true, omborli: true, turi: true, shaxsiyKassa: true },
    orderBy: { nomi: "asc" },
  })
);

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
  return cookieBusinessIdCached(session.tenantId ?? "");
}

/** Cookie'dagi aktiv biznesni hal qilish — bir request ichida bir marta bajariladi. */
const cookieBusinessIdCached = requestCache(async (_tenantId: string): Promise<string | null> => {
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
});

export async function getActiveBusiness(session: SessionData): Promise<BusinessDTO | null> {
  const id = await resolveActiveBusinessId(session);
  if (!id) return null;
  return businessByIdCached(id);
}

/** Biznes omborli ekanini tekshiradi; bo'lmasa BadRequestError. Ombor route'lari boshida ishlatiladi. */
export async function requireOmborli(businessId: string): Promise<void> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { omborli: true } });
  if (!b?.omborli) {
    throw new BadRequestError("Bu biznesda ombor tizimi yoqilmagan");
  }
}

/** Biznes avto rejimida ekanini tekshiradi (avtopark route'lari uchun). */
export async function requireAvto(businessId: string): Promise<void> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { omborli: true, turi: true },
  });
  if (!b?.omborli || b.turi !== "avto") {
    throw new BadRequestError("Bu biznes avto rejimida emas");
  }
}
