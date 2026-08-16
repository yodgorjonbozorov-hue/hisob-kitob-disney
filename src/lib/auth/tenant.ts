import { requestCache } from "@/lib/requestCache";
import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, destroySession, type SessionData } from "./session";
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

const userCached = requestCache(async (userId: string) =>
  rawPrisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, isActive: true },
  })
);

/**
 * Sessiya egasi HALI HAM kirishga haqlimi — har so'rovda BAZADAN tekshiriladi.
 *
 * Sessiyadagi ma'lumotga ishonib bo'lmaydi: cookie 7 kun yashaydi, ya'ni
 * o'chirilgan yoki deaktiv qilingan xodim shu muddat davomida ishlashda davom
 * etardi (audit: Critical #1). `superadmin.ts` dagi `verifySuperadmin` xuddi
 * shu yondashuvni SUPERADMIN uchun allaqachon qo'llaydi — bu esa uni oddiy
 * foydalanuvchilarga ham yoyadi. O'sha fayl o'zgarmadi.
 *
 * Rad etish sabablari:
 *   - foydalanuvchi umuman yo'q (akkaunt o'chirilgan);
 *   - `isActive: false` (deaktiv qilingan).
 *
 * IZOH: `User` modelida `deletedAt` maydoni yo'q — foydalanuvchi butunlay
 * o'chiriladi (`/api/users/[id]` DELETE) yoki deaktiv qilinadi. Ikkala holat
 * ham yuqorida qamrab olingan. Modelga soft-delete qo'shilsa, shu yerga
 * `deletedAt: null` sharti QO'SHILISHI SHART.
 *
 * @returns null — sessiya yaroqsiz; aks holda foydalanuvchining bazadagi tenanti.
 */
export async function verifyUser(userId: string): Promise<{ tenantId: string | null } | null> {
  const user = await userCached(userId);
  if (!user || !user.isActive) return null;
  return { tenantId: user.tenantId };
}

/**
 * Sessiyadan tenantni yuklaydi. Eski (migratsiyagacha ochilgan) sessiyalarda
 * tenantId bo'lmaydi — bazadan o'qiladi (fail-closed: topilmasa null).
 */
async function loadTenant(session: Required<SessionData>): Promise<TenantInfo | null> {
  // Avval foydalanuvchining o'zi tekshiriladi — sessiyada tenantId bo'lsa ham.
  const user = await verifyUser(session.userId);
  if (!user) return null;
  const tenantId = session.tenantId ?? user.tenantId;
  if (!tenantId) return null;
  return tenantByIdCached(tenantId);
}

/**
 * Sessiyadan to'liq tenant kontekstini quradi. null = kirish yopiq
 * (yaroqsiz sessiya yoki topilmagan tenant) — chaqiruvchi guard uni
 * 401/redirect ga aylantiradi.
 */
export async function buildTenantContext(
  session: Required<SessionData>
): Promise<TenantContext | null> {
  const tenant = await loadTenant(session);
  if (!tenant) return null;
  return { session, tenantId: tenant.id, tenant, access: computeAccess(tenant) };
}

/** API route'lar uchun: sessiya + tenant bo'lishi shart, aks holda 401/403 xato. STATUS TEKSHIRMAYDI. */
export async function requireTenantApi(): Promise<TenantContext> {
  const session = await getCurrentUser();
  if (!session) throw new UnauthorizedError();
  // Akkaunt o'chirilgan/deaktiv bo'lsa — sessiya bekor qilinadi va 401 qaytadi
  // (frontend 401'da /login ga olib boradi). Tenant yo'qligidan (403) farqli.
  if (!(await verifyUser(session.userId))) {
    await destroySession();
    throw new UnauthorizedError("Sessiya bekor qilindi — qaytadan tizimga kiring");
  }
  const ctx = await buildTenantContext(session);
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
  // Akkaunt o'chirilgan/deaktiv bo'lsa — sessiya bekor va /login.
  if (!(await verifyUser(session.userId))) {
    await destroySession();
    redirect("/login");
  }
  const ctx = await buildTenantContext(session);
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
  // To'lov sahifasi obuna holatini tekshirmaydi, lekin akkaunt haqiqiyligini —
  // TEKSHIRADI: o'chirilgan xodim bu yerdan ham ichkariga kira olmaydi.
  if (!(await verifyUser(session.userId))) {
    await destroySession();
    redirect("/login");
  }
  const ctx = await buildTenantContext(session);
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
