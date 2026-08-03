import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "@/lib/auth/password";

/** Bepul sinov muddati (kun). */
export const TRIAL_KUNLARI = 14;

/**
 * Yangi kompaniya uchun boshlang'ich kategoriyalar — seed'dagi kabi
 * "har turdagi kategoriya to'plami" mantiqi, lekin umumiy nomlar bilan
 * (seed'dagi ro'yxat bitta aniq biznesga xos edi).
 */
export const STARTER_KIRIM = ["Sotuv", "Xizmat", "Boshqa kirim"];
export const STARTER_CHIQIM = ["Ijara", "Oyliklar", "Kommunal", "Transport", "Mayda xarajatlar", "Boshqa chiqim"];

/**
 * AVTO (olib-sotar) biznes uchun boshlang'ich kategoriyalar.
 * "Sotuv", "Qarz to'lovi", "Mashina xaridi", "Qarz to'lash" — ombor servisi
 * avtomatik ishlatadigan nomlar (lib/services/inventory.ts), shu bois shu ro'yxatda
 * ham bor: ular avvaldan ko'rinib turadi va takrorlanmaydi.
 */
export const AVTO_KIRIM = [
  "Sotuv", // mashina sotuvi — avtomatik yoziladi
  "Qarz to'lovi", // xaridor qarzini to'ladi — avtomatik
  "Vositachilik (komissiya)",
  "Ekspertiza xizmati",
  "Boshqa kirim",
];

export const AVTO_CHIQIM = [
  "Mashina xaridi", // avtoparkka naqd olindi — avtomatik yoziladi
  "Qarz to'lash", // mashina egasiga to'lov — avtomatik
  "Ta'mirlash va ehtiyot qismlar",
  "Yuvish va tozalash",
  "Rasmiylashtirish (MRB, notarius)",
  "Sug'urta",
  "Yoqilg'i",
  "Evakuator va yetkazish",
  "Jarimalar",
  "Maydon ijarasi",
  "Oyliklar",
  "Reklama va e'lonlar",
  "Boshqa chiqim",
];

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
  /** Biznes turi: "umumiy" (default) yoki "avto" — kategoriyalar shunga qarab tanlanadi. */
  biznesTuri?: "umumiy" | "avto";
  /** Tarif kodi (lib/billing/plans.ts). Default STANDARD. */
  plan?: string;
}

/**
 * Yangi mijoz kompaniyani ro'yxatdan o'tkazadi — BITTA tranzaksiya ichida:
 * Tenant (TRIAL, 14 kun) + OWNER foydalanuvchi + default Business + boshlang'ich kategoriyalar.
 * rawPrisma ishlatiladi: bu tizim-darajali amal, tenant hali endi yaratilmoqda.
 */
export async function createTenantWithOwner(params: SignupParams) {
  const parolHash = await hashPassword(params.parol);
  const slug = await uniqueSlug(slugify(params.kompaniyaNomi));
  const trialEndsAt = new Date(Date.now() + TRIAL_KUNLARI * 24 * 60 * 60 * 1000);
  const avto = params.biznesTuri === "avto";
  const kirim = avto ? AVTO_KIRIM : STARTER_KIRIM;
  const chiqim = avto ? AVTO_CHIQIM : STARTER_CHIQIM;

  return rawPrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: params.kompaniyaNomi,
        slug,
        status: "TRIAL",
        trialEndsAt,
        ...(params.plan ? { plan: params.plan } : {}),
      },
    });

    const business = await tx.business.create({
      // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi.
      data: {
        nomi: params.kompaniyaNomi,
        tenantId: tenant.id,
        turi: avto ? "avto" : "umumiy",
        omborli: avto,
      },
    });

    const user = await tx.user.create({
      data: {
        ism: params.ism,
        login: params.login,
        parolHash,
        rol: "OWNER",
        tenantId: tenant.id,
      },
    });

    await tx.category.createMany({
      data: [
        ...kirim.map((nomi, i) => ({ nomi, turi: "kirim", tartib: i, businessId: business.id })),
        ...chiqim.map((nomi, i) => ({ nomi, turi: "chiqim", tartib: i, businessId: business.id })),
      ],
    });

    // Avto biznes uchun OMBOR (avtopark) moduli darhol yoqiladi.
    if (avto) {
      await tx.tenantModule.create({
        data: { tenantId: tenant.id, code: "OMBOR", isActive: true },
      });
    }

    return { tenant, user, business };
  });
}
