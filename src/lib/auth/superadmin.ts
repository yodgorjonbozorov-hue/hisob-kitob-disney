import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireUser, type SessionData } from "./session";
import { handleApiError, UnauthorizedError, ForbiddenError } from "./guard";
import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * SUPERADMIN guard'lari. Sessiyadagi rolga ISHONILMAYDI — har so'rovda bazadan
 * qayta tekshiriladi (rol o'zgartirilgan/o'chirilgan superadmin darhol yopiladi).
 */
async function verifySuperadmin(session: Required<SessionData>): Promise<boolean> {
  if (session.rol !== "SUPERADMIN") return false;
  const user = await rawPrisma.user.findUnique({
    where: { id: session.userId },
    select: { rol: true, isActive: true },
  });
  return !!user && user.isActive && user.rol === "SUPERADMIN";
}

/** API route'lar uchun: SUPERADMIN bo'lmasa 401/403. */
export async function requireSuperadminApi(): Promise<Required<SessionData>> {
  const session = await getCurrentUser();
  if (!session) throw new UnauthorizedError();
  if (!(await verifySuperadmin(session))) {
    throw new ForbiddenError();
  }
  return session;
}

/** Sahifalar uchun: SUPERADMIN bo'lmasa asosiy sahifaga redirect. */
export async function requireSuperadminPage(): Promise<Required<SessionData>> {
  const session = await requireUser();
  if (!(await verifySuperadmin(session))) {
    redirect("/");
  }
  return session;
}

type SuperadminHandler<Ctx> = (
  request: NextRequest,
  routeCtx: Ctx,
  session: Required<SessionData>
) => Promise<NextResponse | Response>;

/** Superadmin API route o'rovi: guard + xatolarni HTTP javobga aylantirish. */
export function withSuperadmin<Ctx = unknown>(handler: SuperadminHandler<Ctx>) {
  return async (request: NextRequest, routeCtx: Ctx): Promise<NextResponse | Response> => {
    try {
      const session = await requireSuperadminApi();
      return await handler(request, routeCtx, session);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
