import { requestCache } from "@/lib/requestCache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { planByCode } from "@/lib/billing/plans";
import type { TenantContext } from "@/lib/auth/tenant";
import { MODULLAR, modulByCode } from "./registry";

/**
 * Modul guard'lari (server). Yoqilganlik uch shartdan iborat:
 *  1) modul katalogda bor;
 *  2) tenant tarifida bor (core modullar har doim);
 *  3) TenantModule'da yoqilgan (core modullar yozuvsiz ham yoqilgan).
 * Rol matritsasi (registry.rollar) API darajasida ham tekshiriladi.
 */

/**
 * Bir request ichida layout, sahifa va guard'lar bu ro'yxatni bir necha marta
 * so'raydi — `cache()` ularni bitta DB so'roviga birlashtiradi (kalit: tenantId).
 */
const aktivModulRowsCached = requestCache(async (_tenantId: string) =>
  // Tenant-scoped so'rov (extension avtomatik filtrlaydi).
  prisma.tenantModule.findMany({ where: { isActive: true }, select: { code: true } })
);

/** Tenant uchun yoqilgan modul kodlari. Tenant kontekstida chaqirilishi shart. */
export async function getEnabledModules(ctx: TenantContext): Promise<Set<string>> {
  const plan = planByCode(ctx.tenant.plan);
  const planModullari = new Set(plan?.modullar ?? []);

  const yoqilgan = new Set<string>();
  for (const m of MODULLAR) {
    if (m.core) yoqilgan.add(m.code); // core — tarifdan qat'i nazar
  }

  const rows = await aktivModulRowsCached(ctx.tenantId);
  for (const r of rows) {
    if (modulByCode(r.code) && planModullari.has(r.code)) {
      yoqilgan.add(r.code);
    }
  }
  // BOG'LIQLIK: MAGAZIN — OMBOR ustidagi qatlam. OMBOR o'chirilgan bo'lsa
  // MAGAZIN yozuvi bazada `isActive` bo'lib qolsa ham hisobga OLINMAYDI —
  // aks holda mahsulotsiz kassa ochilib, sahifa bo'sh chiqardi.
  for (const m of MODULLAR) {
    if (m.talabQiladi && yoqilgan.has(m.code) && !yoqilgan.has(m.talabQiladi)) {
      yoqilgan.delete(m.code);
    }
  }
  return yoqilgan;
}

/**
 * MODUL YOQILMAGANLIGI — standart xato kodi.
 *
 * Frontend "modul yopiq" holatini boshqa 403'lardan (rol yetmadi, boshqa
 * tenant yozuvi) ajrata olishi kerak: birinchisida foydalanuvchini
 * Sozlamalar → Modullar sahifasiga yuborish mantiqiy, qolganlarida yo'q.
 */
export const MODULE_NOT_ENABLED = "MODULE_NOT_ENABLED";

/** API uchun: modul yoqilmagan yoki rol ruxsatsiz bo'lsa ForbiddenError. */
export async function requireModule(ctx: TenantContext, code: string): Promise<void> {
  const m = modulByCode(code);
  if (!m) throw new ForbiddenError("Noma'lum modul");
  if (!m.rollar.includes(ctx.session.rol)) {
    throw new ForbiddenError("Bu modul sizning rolingizga ochiq emas");
  }
  const yoqilgan = await getEnabledModules(ctx);
  if (!yoqilgan.has(code)) {
    throw new ForbiddenError(
      `"${m.nomi}" moduli yoqilmagan — Sozlamalar → Modullar bo'limidan yoqing`,
      MODULE_NOT_ENABLED
    );
  }
}

/**
 * Kontekstsiz tekshiruv (bot/cron uchun): modul shu tenantda yoqiqmi.
 * rawPrisma ishlatadi — tenant konteksti talab qilinmaydi.
 */
export async function isModuleOnForTenant(tenantId: string, code: string): Promise<boolean> {
  const m = modulByCode(code);
  if (!m) return false;
  if (m.core) return true;
  const { rawPrisma } = await import("@/lib/db/rawPrisma");
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  if (!tenant) return false;
  const plan = planByCode(tenant.plan);
  if (!plan?.modullar.includes(code)) return false;
  const row = await rawPrisma.tenantModule.findFirst({
    where: { tenantId, code, isActive: true },
    select: { id: true },
  });
  if (!row) return false;
  // Bog'liq modul (masalan MAGAZIN -> OMBOR) ham yoqiq bo'lishi shart.
  if (m.talabQiladi) return isModuleOnForTenant(tenantId, m.talabQiladi);
  return true;
}

/** Sahifalar uchun: modul yopiq bo'lsa asosiy sahifaga redirect. */
export async function requireModulePage(ctx: TenantContext, code: string): Promise<void> {
  const m = modulByCode(code);
  if (!m || !m.rollar.includes(ctx.session.rol)) {
    redirect("/app");
  }
  const yoqilgan = await getEnabledModules(ctx);
  if (!yoqilgan.has(code)) {
    redirect("/app");
  }
}
