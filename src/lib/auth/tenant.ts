import { requestCache } from "@/lib/requestCache";
import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, type SessionData } from "./session";
import { normalizeRol } from "./roles";
import { handleApiError, UnauthorizedError, ForbiddenError } from "./guard";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { computeAccess, type Access } from "@/lib/billing/access";

/** So'rovdan mijoz IP manzilini oladi (Vercel `x-forwarded-for` beradi). */
function clientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/** Guard uchun kerakli tenant maydonlari. */
export interface TenantInfo {
  id: string;
  name: string;
  /** URL-slug — mijozga xos bloklarni ochishda kalit (lib/mijozXos.ts). */
  slug: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  plan: string;
  /** Doimiy bepul mijoz — obuna guard'i qo'llanmaydi. */
  bepul: boolean;
}

/** Joriy so'rovning tenant konteksti: sessiya + tenant + hisoblangan kirish rejimi. */
export interface TenantContext {
  session: Required<SessionData>;
  tenantId: string;
  tenant: TenantInfo;
  access: Access;
}

/**
 * Bir so'rov (request) ichida layout HAM sahifa HAM shu lookup'ni chaqiradi —
 * `cache()` ularni bitta DB so'roviga birlashtiradi (so'rovlararo kesh EMAS).
 */
const tenantByIdCached = requestCache(async (tenantId: string): Promise<TenantInfo | null> =>
  rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      plan: true,
      bepul: true,
    },
  })
);

/**
 * Foydalanuvchining JORIY holati — BAZADAN, har so'rovda (S-1 tuzatishi).
 *
 * Sessiya cookie'si 7 kun yashaydi, shuning uchun undagi rol/tenant huquq
 * manbai sifatida ISHLATILMAYDI: bloklangan xodim yoki roli tushirilgan
 * foydalanuvchi aks holda cookie tugaguncha eski huquqini saqlab qolardi.
 * `superadmin.ts:verifySuperadmin()` shu naqshni allaqachon qo'llaydi.
 *
 * Bu yerda ustiga `requestCache` qo'shiladi: bir so'rovda layout ham, sahifa
 * ham kontekstni quradi — kesh ularni BITTA `findUnique` ga birlashtiradi.
 */
const userLive = requestCache(async (userId: string) =>
  rawPrisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, isActive: true, rol: true, roleId: true },
  })
);

/**
 * So'rov kontekstini quradi. FAIL-CLOSED — quyidagi hollarda `null`:
 * foydalanuvchi topilmasa (o'chirilgan), `isActive=false` (bloklangan),
 * tenantga tegishli bo'lmasa (SUPERADMIN yoki bog'lanmagan), tenant topilmasa.
 *
 * Tenant ham, rol ham BAZADAN olinadi — sessiyadagi qiymatlar eskirgan
 * bo'lishi mumkin (foydalanuvchi boshqa tenantga ko'chirilgan yoki roli
 * o'zgartirilgan).
 */
async function buildContext(session: Required<SessionData>): Promise<TenantContext | null> {
  const user = await userLive(session.userId);
  if (!user || !user.isActive) return null;
  if (!user.tenantId) return null;

  const tenant = await tenantByIdCached(user.tenantId);
  if (!tenant) return null;

  // Sessiya obyekti shu so'rov ichida bazadagi haqiqat bilan sinxronlanadi.
  // `save()` ATAYLAB chaqirilmaydi — cookie'ga yozilmaydi, o'zgarish faqat
  // joriy so'rovga tegishli. Guard'lar (`forbidSeller`, `requireManager`,
  // modul guard'i) aynan `ctx.session.rol` ga qaraydi.
  session.rol = normalizeRol(user.rol);
  session.tenantId = tenant.id;

  return { session, tenantId: tenant.id, tenant, access: computeAccess(tenant) };
}

/** API route'lar uchun: sessiya + tenant bo'lishi shart, aks holda 401/403 xato. STATUS TEKSHIRMAYDI. */
export async function requireTenantApi(): Promise<TenantContext> {
  const session = await getCurrentUser();
  if (!session) throw new UnauthorizedError();
  const ctx = await buildContext(session);
  if (!ctx) {
    // SUPERADMIN (tenantsiz) oddiy tenant-API'laridan foydalana olmaydi — FAZA 5'da alohida panel.
    throw new ForbiddenError("Kompaniya aniqlanmadi — qaytadan tizimga kiring");
  }
  return ctx;
}

/**
 * Server Component/sahifalar uchun: tenant bo'lmasa /login, obuna yopiq bo'lsa
 * (BILLING_ONLY) — /billing sahifasiga redirect. /billing sahifasining o'zi bu
 * funksiyani EMAS, requireBillingPage'ni ishlatadi (aylanma redirect bo'lmasligi uchun).
 */
export async function requireTenantPage(): Promise<TenantContext> {
  const session = await requireUser();
  // SUPERADMIN tenantsiz — unga alohida panel.
  if (session.rol === "SUPERADMIN") {
    redirect("/superadmin");
  }
  const ctx = await buildContext(session);
  if (!ctx) {
    redirect("/login");
  }
  if (ctx.access.mode === "BILLING_ONLY") {
    redirect("/billing");
  }
  return ctx;
}

/** /billing sahifasi uchun: sessiya + tenant kerak, lekin status tekshirilmaydi. */
export async function requireBillingPage(): Promise<TenantContext> {
  const session = await requireUser();
  if (session.rol === "SUPERADMIN") {
    redirect("/superadmin");
  }
  const ctx = await buildContext(session);
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}

export interface WithTenantOptions {
  /**
   * true bo'lsa obuna holati tekshirilmaydi (faqat billing API'lari uchun).
   * Default: false — BILLING_ONLY'da barcha so'rov, READONLY'da yozish bloklanadi.
   */
  billing?: boolean;
  /** true bo'lsa READONLY rejimida ham yozish (POST/PATCH/DELETE) ruxsat — faqat
   *  ma'lumotga tegmaydigan amallar uchun (masalan aktiv biznes cookie'si). */
  readonlyOk?: boolean;
  /** Modul kodi (masalan "OMBOR") — yoqilmagan/rol ruxsatsiz bo'lsa 403. */
  module?: string;
}

type RouteHandler<Ctx> = (
  request: NextRequest,
  routeCtx: Ctx,
  tenant: TenantContext
) => Promise<NextResponse | Response>;

/**
 * API route o'rovi: sessiya/tenant tekshiradi, OBUNA HOLATI guard'ini qo'llaydi,
 * tenant kontekstini o'rnatadi (shundan keyin `prisma` avtomatik shu tenantga
 * cheklanadi) va xatolarni HTTP javobga aylantiradi.
 */
export function withTenant<Ctx = unknown>(handler: RouteHandler<Ctx>, opts: WithTenantOptions = {}) {
  return async (request: NextRequest, routeCtx: Ctx): Promise<NextResponse | Response> => {
    try {
      const ctx = await requireTenantApi();

      if (!opts.billing) {
        if (ctx.access.mode === "BILLING_ONLY") {
          // 402 Payment Required — frontend xabarni ko'rsatadi, sahifa guard'i /billing'ga olib boradi.
          return NextResponse.json({ error: ctx.access.sabab, billing: true }, { status: 402 });
        }
        if (ctx.access.mode === "READONLY" && request.method !== "GET" && !opts.readonlyOk) {
          // Ma'lumot garovga olinmaydi: o'qish/eksport ochiq, faqat yozish bloklanadi.
          return NextResponse.json({ error: ctx.access.sabab, billing: true }, { status: 402 });
        }
      }

      // Aktor kontekstga qo'shiladi — barcha yozish amallari audit jurnaliga
      // shu foydalanuvchi nomidan tushadi (lib/db/tenantDb.ts).
      return await runWithTenant(
        ctx.tenantId,
        async () => {
          if (opts.module) {
            // Dinamik import — aylanma bog'liqlikni oldini oladi (guard -> tenant -> guard).
            const { requireModule } = await import("@/lib/modules/guard");
            await requireModule(ctx, opts.module);
          }
          return handler(request, routeCtx, ctx);
        },
        { userId: ctx.session.userId, ism: ctx.session.ism, ip: clientIp(request) }
      );
    } catch (error) {
      return handleApiError(error);
    }
  };
}
