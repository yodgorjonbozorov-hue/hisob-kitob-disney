import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, type SessionData } from "./session";
import { handleApiError, UnauthorizedError, ForbiddenError } from "./guard";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { computeAccess, type Access } from "@/lib/billing/access";

/** Guard uchun kerakli tenant maydonlari. */
export interface TenantInfo {
  id: string;
  name: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  plan: string;
}

/** Joriy so'rovning tenant konteksti: sessiya + tenant + hisoblangan kirish rejimi. */
export interface TenantContext {
  session: Required<SessionData>;
  tenantId: string;
  tenant: TenantInfo;
  access: Access;
}

/**
 * Sessiyadan tenantni yuklaydi. Eski (migratsiyagacha ochilgan) sessiyalarda
 * tenantId bo'lmaydi — bazadan o'qiladi (fail-closed: topilmasa null).
 */
async function loadTenant(session: Required<SessionData>): Promise<TenantInfo | null> {
  let tenantId = session.tenantId ?? null;
  if (!tenantId) {
    const user = await rawPrisma.user.findUnique({
      where: { id: session.userId },
      select: { tenantId: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    tenantId = user.tenantId;
  }
  if (!tenantId) return null;
  return rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true, trialEndsAt: true, currentPeriodEnd: true, plan: true },
  });
}

async function buildContext(session: Required<SessionData>): Promise<TenantContext | null> {
  const tenant = await loadTenant(session);
  if (!tenant) return null;
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

      return await runWithTenant(ctx.tenantId, () => handler(request, routeCtx, ctx));
    } catch (error) {
      return handleApiError(error);
    }
  };
}
