import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, requireUser, type SessionData } from "./session";
import { handleApiError, UnauthorizedError, ForbiddenError } from "./guard";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { canRuxsat, superRolNormalize, type Ruxsat, type SuperRol } from "@/lib/superadmin/rbac";

/**
 * SUPERADMIN guard'lari (Superadmin 2.0).
 *
 * Uch qatlamli tekshiruv, HAR so'rovda:
 *   1. sessiya bor va roli SUPERADMIN;
 *   2. bazada ham SUPERADMIN va faol — sessiyaga ISHONILMAYDI (rol tortib
 *      olingan yoki hisob o'chirilgan superadmin darhol yopiladi);
 *   3. sessiya avlodi (`sessionEpoch`) bazadagi bilan mos — "barcha
 *      sessiyalarni bekor qilish" shu orqali ishlaydi;
 *   4. so'ralgan RUXSAT superadmin rolida bor (lib/superadmin/rbac.ts).
 *
 * Frontend hech qanday huquq bermaydi: qaror faqat shu yerda.
 */

/** Superadmin so'rovi konteksti — audit uchun IP va qurilma satri ham shu yerda. */
export interface SuperadminCtx {
  session: Required<SessionData>;
  superRol: SuperRol;
  ip: string | null;
  userAgent: string | null;
}

interface TekshiruvNatija {
  ok: boolean;
  superRol: SuperRol;
}

async function verifySuperadmin(session: Required<SessionData>): Promise<TekshiruvNatija> {
  const yoq: TekshiruvNatija = { ok: false, superRol: "READ_ONLY" };
  if (session.rol !== "SUPERADMIN") return yoq;
  const user = await rawPrisma.user.findUnique({
    where: { id: session.userId },
    select: { rol: true, isActive: true, superadminRol: true, sessionEpoch: true },
  });
  if (!user || !user.isActive || user.rol !== "SUPERADMIN") return yoq;
  // Sessiya avlodi: eski cookie'da maydon yo'q -> 0. Bazadagi qiymat oshirilgan
  // bo'lsa (sessiyalar bekor qilingan) bunday cookie o'tmaydi.
  if ((session.sessionEpoch ?? 0) !== user.sessionEpoch) return yoq;
  return { ok: true, superRol: superRolNormalize(user.superadminRol) };
}

/** So'rovdan IP oladi (Vercel `x-forwarded-for` beradi). */
function ipdanOl(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/** API route'lar uchun: SUPERADMIN bo'lmasa 401/403. */
export async function requireSuperadminApi(): Promise<Required<SessionData> & { superRol: SuperRol }> {
  const session = await getCurrentUser();
  if (!session) throw new UnauthorizedError();
  const natija = await verifySuperadmin(session);
  if (!natija.ok) throw new ForbiddenError();
  return Object.assign(session, { superRol: natija.superRol });
}

/** Sahifalar uchun: SUPERADMIN bo'lmasa asosiy sahifaga redirect. */
export async function requireSuperadminPage(): Promise<Required<SessionData> & { superRol: SuperRol }> {
  const session = await requireUser();
  const natija = await verifySuperadmin(session);
  if (!natija.ok) {
    redirect("/app");
  }
  return Object.assign(session, { superRol: natija.superRol });
}

/**
 * Sahifa uchun ruxsat talab qiladi. Ruxsat bo'lmasa Control Center bosh
 * sahifasiga qaytariladi (403 sahifasi emas — foydalanuvchi baribir
 * superadmin, u shunchaki bu bo'limga kirolmaydi).
 */
export async function requireSuperadminRuxsat(
  ruxsat: Ruxsat
): Promise<Required<SessionData> & { superRol: SuperRol }> {
  const session = await requireSuperadminPage();
  if (!canRuxsat(session.superRol, ruxsat)) {
    redirect("/superadmin");
  }
  return session;
}

type SuperadminHandler<Ctx> = (
  request: NextRequest,
  routeCtx: Ctx,
  sa: SuperadminCtx
) => Promise<NextResponse | Response>;

/**
 * Superadmin API route o'rovi: guard + RUXSAT + xatolarni HTTP javobga aylantirish.
 *
 * Har route o'zi talab qiladigan ruxsatni OCHIQ e'lon qiladi — "qaysi rol bu
 * endpointga kira oladi?" degan savolga javob route faylining birinchi
 * satridan ko'rinadi.
 */
export function withSuperadmin<Ctx = unknown>(ruxsat: Ruxsat, handler: SuperadminHandler<Ctx>) {
  return async (request: NextRequest, routeCtx: Ctx): Promise<NextResponse | Response> => {
    try {
      const session = await requireSuperadminApi();
      if (!canRuxsat(session.superRol, ruxsat)) {
        throw new ForbiddenError(
          `Bu amal sizning rolingizga ochiq emas (${ruxsat.resurs}.${ruxsat.amal})`
        );
      }
      return await handler(request, routeCtx, {
        session,
        superRol: session.superRol,
        ip: ipdanOl(request),
        userAgent: request.headers.get("user-agent"),
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/** Server Component ichida audit uchun IP/qurilma (route emas, sahifa konteksti). */
export async function sahifaAktorKonteksti(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return {
    ip: xff ? xff.split(",")[0].trim() : h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}
