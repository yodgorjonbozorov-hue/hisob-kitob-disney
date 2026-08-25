import { requestCache } from "@/lib/requestCache";
import { cookies, headers } from "next/headers";
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
  /** Do'kon kassasi (POS) shu bizneste yuritiladimi — MAGAZIN moduli bayrog'i. */
  magazin: boolean;
}

const BIZNES_SELECT = {
  id: true,
  nomi: true,
  isActive: true,
  omborli: true,
  turi: true,
  shaxsiyKassa: true,
  magazin: true,
} as const;

/**
 * Xodim biriktirilgan biznes id'lari (`UserBusiness`).
 *
 * BO'SH massiv = CHEKLOV YO'Q (direktor/administrator yoki ko'p-biznesli
 * sotuvchi) — bu holat `null` bilan emas, bo'sh ro'yxat bilan ifodalanadi,
 * chunki chaqiruvchilar uni `length` orqali o'qiydi.
 *
 * Ruxsatning YAGONA manbai shu jadval — sessiyadagi `businessId` emas.
 * Sabab: direktor xodimning bizneslarini o'zgartirsa, sessiya (cookie, 7 kun)
 * eskirib qolardi. Bu yerda esa har so'rovda bazadan o'qiladi.
 */
export async function biriktirilganBiznesIdlari(userId: string): Promise<string[]> {
  const rows = await prisma.userBusiness.findMany({
    where: { userId },
    select: { businessId: true },
  });
  return rows.map((r) => r.businessId);
}

/** Bir request ichida bir necha marta chaqiriladi (layout + sahifa) — dedupe. */
const biriktirilganCached = requestCache(biriktirilganBiznesIdlari);

/**
 * Foydalanuvchining RUXSAT RO'YXATI. Bo'sh = cheklov yo'q.
 *
 * FAIL-CLOSED zaxira yo'li: biriktiruv jadvalida qatori bo'lmasa, LEKIN
 * sessiyada eski `businessId` bo'lsa — o'sha bitta biznes qaytariladi.
 * Sabab: hisob boshqa yo'l bilan yaratilgan bo'lishi mumkin (seed, e2e
 * skripti, qo'lda SQL) — u holda "qator yo'q" ni "cheklov yo'q" deb o'qish
 * xodimga barcha bizneslarni OCHIB YUBORARDI. Bu yerda aksincha: cheklov
 * saqlanadi. (Direktor/administratorda `businessId` baribir NULL.)
 */
async function ruxsatEtilganIdlar(session: SessionData): Promise<string[]> {
  const biriktirilgan = await biriktirilganCached(session.userId ?? "");
  if (biriktirilgan.length > 0) return biriktirilgan;
  return session.businessId ? [session.businessId] : [];
}

/**
 * Foydalanuvchi kira oladigan bizneslar:
 * - Biriktirilgan xodim (`UserBusiness` da qatori bor — kassir yoki sotuvchi)
 *   → faqat o'sha bizneslar. Bir nechta bo'lishi mumkin: bir jamoa ikki
 *   biznesni yuritganda (masalan gullar va sovg'a qutilari alohida hisob
 *   yuritiladi) xodim ikkalasiga ham biriktiriladi va ular orasida almashadi.
 * - Biriktirilmagan (direktor/admin, ko'p-biznesli sotuvchi) → barcha faol biznes.
 */
export async function getAccessibleBusinesses(session: SessionData): Promise<BusinessDTO[]> {
  const biriktirilgan = await ruxsatEtilganIdlar(session);
  if (biriktirilgan.length > 0) {
    // Nofaol biznes ham ro'yxatda qoladi (avvalgi xatti-harakat: biriktirilgan
    // xodim o'z biznesini nofaol bo'lsa ham ko'rardi).
    return prisma.business.findMany({
      where: { id: { in: biriktirilgan } },
      select: BIZNES_SELECT,
      orderBy: { nomi: "asc" },
    });
  }
  return activeBusinessesCached(session.tenantId ?? "");
}

/**
 * Bir request ichida layout ham, sahifa ham shu so'rovlarni takrorlaydi —
 * `cache()` ularni bitta DB so'roviga birlashtiradi (so'rovlararo kesh EMAS).
 * Tenant filtri baribir prisma extension'da — bu faqat dedupe.
 */
const businessByIdCached = requestCache(async (id: string) =>
  prisma.business.findUnique({ where: { id }, select: BIZNES_SELECT })
);

const activeBusinessesCached = requestCache(async (_tenantId: string) =>
  prisma.business.findMany({ where: { isActive: true }, select: BIZNES_SELECT, orderBy: { nomi: "asc" } })
);

/**
 * Joriy so'rov uchun aktiv biznes id'sini hal qiladi.
 * - AYNAN BITTA biznesga biriktirilgan xodim: DOIM o'sha biznes (o'zgartira
 *   olmaydi) — yozuvlari doim shu biznesga tushadi, adashmaydi.
 * - BIR NECHTA biznesga biriktirilgan xodim: `active_business` cookie, agar u
 *   biriktirilganlar ichida bo'lsa; aks holda birinchi biriktirilgan biznes.
 * - Biriktirilmagan (direktor/ko'p-biznesli sotuvchi): cookie (mavjud va faol
 *   bo'lsa), aks holda birinchi faol biznes.
 * Hech qanday biznes bo'lmasa null qaytaradi.
 */
export async function resolveActiveBusinessId(session: SessionData): Promise<string | null> {
  const biriktirilgan = await ruxsatEtilganIdlar(session);
  if (biriktirilgan.length === 1) {
    return biriktirilgan[0];
  }
  if (biriktirilgan.length > 1) {
    return cheklanganAktivCached(biriktirilgan.join(","));
  }
  return cookieBusinessIdCached(session.tenantId ?? "");
}

/**
 * Cookie'dan o'qiladigan aktiv biznes (bo'lmasa/nomos bo'lsa — null).
 *
 * MOBIL KLIENT cookie yuritmaydi — u tanlovni `X-Active-Business` header'ida
 * yuboradi. Header USTUVOR, lekin bu xavfsizlikni bo'shatmaydi: qiymat quyida
 * baribir ruxsat ro'yxati (`ruxsatEtilganIdlar`) yoki faol biznes mavjudligi
 * bilan tekshiriladi; bitta biznesga biriktirilgan xodim uchun esa umuman
 * o'qilmaydi (resolveActiveBusinessId birinchi shartda qaytadi).
 */
async function cookieBiznesId(): Promise<string | null> {
  try {
    const headerId = (await headers()).get("x-active-business");
    if (headerId) return headerId;
  } catch {
    // headers() request kontekstidan tashqarida ishlamaydi — cookie yo'liga o'tamiz
  }
  return (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
}

/**
 * Bir nechta biznesga biriktirilgan xodim uchun aktiv biznes.
 *
 * Kalit sifatida id'lar ro'yxati beriladi (kesh faqat shu ro'yxat uchun
 * o'rinli): cookie ruxsat etilganlar ichida bo'lsa — o'sha, aks holda
 * birinchi FAOL biznes (hammasi nofaol bo'lsa — birinchisi).
 */
const cheklanganAktivCached = requestCache(async (idlarCsv: string): Promise<string | null> => {
  const idlar = idlarCsv.split(",").filter(Boolean);
  const cookieId = await cookieBiznesId();
  if (cookieId && idlar.includes(cookieId)) return cookieId;

  const bizneslar = await prisma.business.findMany({
    where: { id: { in: idlar } },
    select: { id: true, isActive: true },
    orderBy: { nomi: "asc" },
  });
  return bizneslar.find((b) => b.isActive)?.id ?? bizneslar[0]?.id ?? null;
});

/** Cookie'dagi aktiv biznesni hal qilish — bir request ichida bir marta bajariladi. */
const cookieBusinessIdCached = requestCache(async (_tenantId: string): Promise<string | null> => {
  const cookieId = await cookieBiznesId();
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

/**
 * Foydalanuvchi shu biznesga kira oladimi (ko'p-bizneslik ruxsat ro'yxati).
 * Cheklovsiz xodim (direktor/administrator) uchun har doim true.
 */
export async function biznesRuxsatiBormi(session: SessionData, businessId: string): Promise<boolean> {
  const idlar = await ruxsatEtilganIdlar(session);
  return idlar.length === 0 || idlar.includes(businessId);
}

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

/**
 * Bizneste do'kon kassasi (POS) yuritilishini tekshiradi; bo'lmasa
 * BadRequestError. MAGAZIN route'lari boshida ishlatiladi.
 *
 * DIQQAT: bu MODUL guard'ining o'rnini BOSMAYDI. Modul tenant darajasida
 * (`withTenant(..., { module: "MAGAZIN" })`), bu bayroq esa biznes
 * darajasida — ikkalasi ham majburiy, chunki bir tenantda do'kon ham,
 * do'kon bo'lmagan biznes ham bo'lishi mumkin.
 *
 * Ombor ham talab qilinadi: mahsulot va qoldiq OMBOR modulida yuritiladi.
 */
export async function requireMagazin(businessId: string): Promise<void> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { omborli: true, magazin: true },
  });
  if (!b?.magazin) {
    throw new BadRequestError("Bu bizneste magazin (kassa) yoqilmagan");
  }
  if (!b.omborli) {
    throw new BadRequestError("Magazin ishlashi uchun avval ombor tizimi yoqilishi kerak");
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
