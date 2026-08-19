import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { ACTIVE_BUSINESS_COOKIE, biznesRuxsatiBormi } from "@/lib/business";

/**
 * Foydalanuvchi aktiv biznesni tanlaydi (cookie o'rnatiladi).
 *
 * Kassir ham tanlay OLADI — lekin faqat O'ZIGA biriktirilgan bizneslar
 * ichidan (ko'p-bizneslik: bir jamoa bir nechta biznesni yuritadi). Bitta
 * biznesga biriktirilgan xodimda tanlashning ma'nosi yo'q — 403.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  const body = await request.json();
  const businessId = typeof body?.businessId === "string" ? body.businessId : null;
  if (!businessId) {
    return NextResponse.json({ error: "businessId kerak" }, { status: 400 });
  }

  // Ruxsat ro'yxati — biriktiruvlar (UserBusiness) asosida (lib/business.ts).
  if (!(await biznesRuxsatiBormi(user, businessId))) {
    throw new ForbiddenError("Bu biznesga ruxsatingiz yo'q");
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
}, { readonlyOk: true });
