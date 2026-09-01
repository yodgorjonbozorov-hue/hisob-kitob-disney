import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";
import { biznesProfil, type BusinessType } from "@/lib/pricing/profil";
import { pricingConfig, isAddonKey, type AddonKey } from "@/lib/pricing/config";
import { PLANLAR } from "@/lib/billing/plans";
import { modulByCode } from "@/lib/modules/registry";

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

/**
 * Kompaniya nomini taqqoslash uchun soddalashtiradi: registr, apostrof va
 * ortiqcha bo'shliqlar hisobga olinmaydi ("RedFlora" ≈ "red flora").
 */
export function normalizeKompaniyaNomi(nomi: string): string {
  return nomi
    .toLowerCase()
    .replace(/['ʼ’`]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Takroriy ro'yxatdan o'tishni ushlash oynasi (daqiqa). */
export const TAKROR_OYNA_DAQIQA = 10;

/**
 * Shu nom bilan YAQINDA ochilgan kompaniyani topadi — tugma ikki marta
 * bosilgani yoki so'rov qayta yuborilgani natijasida ikkinchi tenant
 * ochilib ketmasligi uchun. Eski (bir necha kun oldingi) bir xil nomlar
 * bloklanmaydi: ular haqiqiy boshqa mijoz bo'lishi mumkin — ular superadmin
 * panelida "takror?" belgisi bilan ko'rinadi.
 */
export async function findRecentDuplicateTenant(kompaniyaNomi: string, daqiqa = TAKROR_OYNA_DAQIQA) {
  const normal = normalizeKompaniyaNomi(kompaniyaNomi);
  if (!normal) return null;
  const chegara = new Date(Date.now() - daqiqa * 60 * 1000);
  const yaqinda = await rawPrisma.tenant.findMany({
    where: { createdAt: { gte: chegara } },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  return yaqinda.find((t) => normalizeKompaniyaNomi(t.name) === normal) ?? null;
}

export interface SignupParams {
  kompaniyaNomi: string;
  ism: string;
  login: string; // normalizatsiya qilingan telefon raqam
  parol: string;
  /** Biznes turi: "umumiy" (default), "avto" yoki "optom" — kategoriyalar shunga qarab tanlanadi. */
  biznesTuri?: "umumiy" | "avto" | "optom";
  /** Tarif kodi (lib/billing/plans.ts). Default STANDARD. */
  plan?: string;
  /**
   * Biznes yo'nalishi (tariflar sahifasidan) — boshlang'ich konfiguratsiya
   * va onboarding shu profilga moslashadi (lib/pricing/profil.ts).
   * NARXGA TA'SIR QILMAYDI.
   */
  yonalish?: BusinessType;
  /**
   * Foydalanuvchi kalkulyatorda ANIQ tanlagan qo'shimcha modullar. Sinov
   * davrida shu modullar ochiladi — foydalanuvchi so'ramagan modul hech
   * qachon o'z-o'zidan yoqilmaydi.
   */
  addons?: AddonKey[];
}

/**
 * So'ralgan modullarni qamrab oladigan ENG ARZON tarifni topadi — sinov
 * davri foydalanuvchi tanlagan imkoniyatlar bilan ishlashi uchun (modul
 * darvozasi `plan.modullar` bilan tekshiriladi, lib/modules/guard.ts).
 * Hech biri qamrab olmasa modul ro'yxati eng keng tarif tanlanadi.
 * To'lov OLINMAYDI: bu faqat sinov davridagi ochiq modullar chegarasi.
 */
export function sinovPlanTanla(modulKodlari: string[]): string {
  const kerak = modulKodlari.filter((k) => {
    const m = modulByCode(k);
    return m !== null && !m.core;
  });
  const nomzodlar = [...PLANLAR].sort((a, b) => a.oylikNarx - b.oylikNarx);
  const qamragan = nomzodlar.find((p) => kerak.every((k) => p.modullar.includes(k)));
  if (qamragan) return qamragan.code;
  const engKeng = [...nomzodlar].sort((a, b) => b.modullar.length - a.modullar.length)[0];
  return engKeng?.code ?? "STANDARD";
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

  // Yo'nalish profili — boshlang'ich bayroqlar va yoqiladigan modullar.
  // Faqat shaxsiylashtirish: jadval/hisob mantig'i hamma uchun BIR XIL.
  const profil = biznesProfil(params.yonalish);
  const addonModullar = (params.addons ?? [])
    .filter(isAddonKey)
    .map((k) => pricingConfig.addons[k].modulKodi)
    .filter((k): k is string => k !== null);

  const modullar = new Set<string>(addonModullar);
  let magazin = profil?.boshlangich.magazin ?? false;
  if (modullar.has("MAGAZIN")) magazin = true;
  if (magazin) modullar.add("MAGAZIN");
  // Ombor: avto rejimi, profil talabi yoki OMBOR'ga tayangan modul (MAGAZIN,
  // XARID — lib/modules/bogliqlik.ts) tanlanganda birga yoqiladi.
  const omborli =
    avto || (profil?.boshlangich.omborli ?? false) || magazin || modullar.has("XARID");
  if (omborli) modullar.add("OMBOR");

  // Sinov davri tarifi: foydalanuvchi tanlagan modullarni qamrab oladigan
  // eng arzon tarif. ANIQ berilgan plan (superadmin oqimi) ustun turadi.
  const plan = params.plan ?? (modullar.size > 0 ? sinovPlanTanla([...modullar]) : undefined);

  return rawPrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: params.kompaniyaNomi,
        slug,
        status: "TRIAL",
        trialEndsAt,
        ...(plan ? { plan } : {}),
      },
    });

    const business = await tx.business.create({
      // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi.
      data: {
        nomi: params.kompaniyaNomi,
        tenantId: tenant.id,
        turi: avto ? "avto" : "umumiy",
        omborli,
        magazin,
        yonalish: params.yonalish ?? null,
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

    // Har biznesda kamida bitta kassa bo'lishi shart — aks holda yozuv qayerga
    // tushishini ko'rsatib bo'lmaydi (Faza 4.1).
    await tx.account.create({
      data: { businessId: business.id, nomi: DEFAULT_KASSA_NOMI, turi: "naqd", tartib: 0 },
    });

    await tx.category.createMany({
      data: [
        ...kirim.map((nomi, i) => ({ nomi, turi: "kirim", tartib: i, businessId: business.id })),
        ...chiqim.map((nomi, i) => ({ nomi, turi: "chiqim", tartib: i, businessId: business.id })),
      ],
    });

    // Profil/tanlovdan kelib chiqqan modullar darhol yoqiladi (avto uchun
    // avvalgidek OMBOR shu to'plamda). Foydalanuvchi ANIQ tanlamagan pullik
    // modul bu ro'yxatga tushmaydi.
    if (modullar.size > 0) {
      await tx.tenantModule.createMany({
        data: [...modullar].map((code) => ({ tenantId: tenant.id, code, isActive: true })),
      });
    }

    return { tenant, user, business };
  });
}
