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

/** Tenant uchun yoqilgan modul kodlari. Tenant kontekstida chaqirilishi shart. */
export async function getEnabledModules(ctx: TenantContext): Promise<Set<string>> {
  const plan = planByCode(ctx.tenant.plan);
  const planModullari = new Set(plan?.modullar ?? []);

  const yoqilgan = new Set<string>();
  for (const m of MODULLAR) {
    if (m.core) yoqilgan.add(m.code); // core — tarifdan qat'i nazar
  }

  // Tenant-scoped so'rov (extension avtomatik filtrlaydi).
  const rows = await prisma.tenantModule.findMany({ where: { isActive: true }, select: { code: true } });
  for (const r of rows) {
    if (modulByCode(r.code) && planModullari.has(r.code)) {
      yoqilgan.add(r.code);
    }
  }
  return yoqilgan;
}

/** API uchun: modul yoqilmagan yoki rol ruxsatsiz bo'lsa ForbiddenError. */
export async function requireModule(ctx: TenantContext, code: string): Promise<void> {
  const m = modulByCode(code);
  if (!m) throw new ForbiddenError("Noma'lum modul");
  if (!m.rollar.includes(ctx.session.rol)) {
    throw new ForbiddenError("Bu modul sizning rolingizga ochiq emas");
  }
  const yoqilgan = await getEnabledModules(ctx);
  if (!yoqilgan.has(code)) {
    throw new ForbiddenError(`"${m.nomi}" moduli yoqilmagan — Sozlamalar → Modullar bo'limidan yoqing`);
  }
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
