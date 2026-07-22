import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/business";

/** Admin aktiv biznesni tanlaydi (cookie o'rnatiladi). Kassir o'z biznesiga bog'langan — bu route unga kerak emas. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

    const body = await request.json();
    const businessId = typeof body?.businessId === "string" ? body.businessId : null;
    if (!businessId) {
      return NextResponse.json({ error: "businessId kerak" }, { status: 400 });
    }

    const biz = await prisma.business.findFirst({
      where: { id: businessId, isActive: true },
      select: { id: true },
    });
    if (!biz) {
      return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
