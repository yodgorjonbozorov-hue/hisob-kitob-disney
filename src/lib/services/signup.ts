import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "@/lib/auth/password";
import { KUN_MS, TRIAL_KUNLARI } from "@/lib/billing/constants";

/**
 * Yangi kompaniya uchun boshlang'ich kategoriyalar — seed'dagi kabi
 * "har turdagi kategoriya to'plami" mantiqi, lekin umumiy nomlar bilan
 * (seed'dagi ro'yxat Disney Navoiyga xos edi).
 */
export const STARTER_KIRIM = ["Sotuv", "Xizmat", "Boshqa kirim"];
export const STARTER_CHIQIM = ["Ijara", "Oyliklar", "Kommunal", "Transport", "Mayda xarajatlar", "Boshqa chiqim"];

/** Kompaniya nomidan URL-slug yasaydi (o'zbekcha apostroflar hisobga olinadi). */
export function slugify(nomi: string): string {
  const s = nomi
    .toLowerCase()
    .replace(/['ʼ’`]/g, "") // o' g' kabi apostroflar tushiriladi
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "kompaniya";
}

/** Band bo'lmagan slug topadi: nomi, nomi-2, nomi-3, ... */
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const exists = await rawPrisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    slug = `${base}-${i}`;
  }
  // Juda ko'p to'qnashuv — tasodifiy suffiks.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SignupParams {
  kompaniyaNomi: string;
  ism: string;
  login: string; // normalizatsiya qilingan telefon raqam
  parol: string;
  /** Tarif kodi (STANDARD | PRO). Default — schema'dagi STANDARD. */
  plan?: string;
  /** Sinov muddati (kun). Default — TRIAL_KUNLARI. */
  trialKunlari?: number;
  /** Birinchi kirishda parolni almashtirishga majburlash (superadmin bergan vaqtinchalik parol). */
  mustChangePassword?: boolean;
  /** O'rnatish to'lovi olingan bo'lsa — summa (USD); olinmagan bo'lsa undefined. */
  setupFeeAmountUsd?: number;
}

/**
 * Yangi kompaniyani tizimga tushiradi — BITTA tranzaksiya ichida:
 * Tenant (TRIAL) + OWNER foydalanuvchi + default Business + boshlang'ich kategoriyalar.
 * rawPrisma ishlatiladi: bu tizim-darajali amal, tenant hali endi yaratilmoqda.
 *
 * Yagona yaratish nuqtasi: superadmin panelidagi "Yangi kompaniya" oqimi shu funksiyani chaqiradi.
 */
export async function createTenantWithOwner(params: SignupParams) {
  const parolHash = await hashPassword(params.parol);
  const slug = await uniqueSlug(slugify(params.kompaniyaNomi));
  const kunlar = params.trialKunlari ?? TRIAL_KUNLARI;
  const trialEndsAt = new Date(Date.now() + kunlar * KUN_MS);

  return rawPrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: params.kompaniyaNomi,
        slug,
        status: "TRIAL",
        trialEndsAt,
        ...(params.plan ? { plan: params.plan } : {}),
        ...(params.setupFeeAmountUsd !== undefined
          ? { setupFeeAmountUsd: params.setupFeeAmountUsd, setupFeePaidAt: new Date() }
          : {}),
      },
    });

    const business = await tx.business.create({
      data: { nomi: params.kompaniyaNomi, tenantId: tenant.id },
    });

    const user = await tx.user.create({
      data: {
        ism: params.ism,
        login: params.login,
        parolHash,
        rol: "OWNER",
        tenantId: tenant.id,
        mustChangePassword: params.mustChangePassword ?? false,
      },
    });

    await tx.category.createMany({
      data: [
        ...STARTER_KIRIM.map((nomi, i) => ({ nomi, turi: "kirim", tartib: i, businessId: business.id })),
        ...STARTER_CHIQIM.map((nomi, i) => ({ nomi, turi: "chiqim", tartib: i, businessId: business.id })),
      ],
    });

    return { tenant, user, business };
  });
}
