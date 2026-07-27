import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, type SessionData } from "./session";
import { handleApiError, UnauthorizedError, ForbiddenError } from "./guard";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";

/** Joriy so'rovning tenant konteksti: sessiya + tasdiqlangan tenantId. */
export interface TenantContext {
  session: Required<SessionData>;
  tenantId: string;
}

/**
 * Sessiyadan tenantId'ni oladi. Eski (migratsiyagacha ochilgan) sessiyalarda
 * tenantId bo'lmaydi — bazadan bir marta o'qiladi (fail-closed: topilmasa null).
 */
async function resolveTenantId(session: Required<SessionData>): Promise<string | null> {
  if (session.tenantId) return session.tenantId;
  const user = await rawPrisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user.tenantId;
}

/** API route'lar uchun: sessiya + tenant bo'lishi shart, aks holda 401/403 xato. */
export async function requireTenantApi(): Promise<TenantContext> {
  const session = await getCurrentUser();
  if (!session) throw new UnauthorizedError();
  const tenantId = await resolveTenantId(session);
  if (!tenantId) {
    // SUPERADMIN (tenantsiz) oddiy tenant-API'laridan foydalana olmaydi — FAZA 5'da alohida panel.
    throw new ForbiddenError("Kompaniya aniqlanmadi — qaytadan tizimga kiring");
  }
  return { session, tenantId };
}

/** Server Component/sahifalar uchun: tenant bo'lmasa /login'ga redirect. */
export async function requireTenantPage(): Promise<TenantContext> {
  const session = await requireUser();
  const tenantId = await resolveTenantId(session);
  if (!tenantId) {
    redirect("/login");
  }
  return { session, tenantId };
}

type RouteHandler<Ctx> = (
  request: NextRequest,
  routeCtx: Ctx,
  tenant: TenantContext
) => Promise<NextResponse | Response>;

/**
 * API route o'rovi: sessiya/tenant tekshiradi, tenant kontekstini o'rnatadi
 * (shundan keyin `prisma` avtomatik shu tenantga cheklanadi) va xatolarni
 * HTTP javobga aylantiradi.
 *
 * Ishlatish: `export const GET = withTenant(async (request, ctx, { session }) => {...})`
 */
export function withTenant<Ctx = unknown>(handler: RouteHandler<Ctx>) {
  return async (request: NextRequest, routeCtx: Ctx): Promise<NextResponse | Response> => {
    try {
      const tenant = await requireTenantApi();
      return await runWithTenant(tenant.tenantId, () => handler(request, routeCtx, tenant));
    } catch (error) {
      return handleApiError(error);
    }
  };
}
