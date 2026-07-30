import { NextRequest, NextResponse } from "next/server";

/**
 * Himoyalangan yo'llar uchun erta redirect: sessiya cookie bo'lmasa /login.
 * (Haqiqiy tekshiruv server komponentlarda — requireTenantPage/requireSuperadmin.)
 * Landing (/), /login, /signup ochiq; webhook/cron o'z secret'lari bilan himoyalangan.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("balansa_session");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/billing",
    "/superadmin/:path*",
    "/parol-ozgartirish",
  ],
};
