import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("disney_navoiy_session");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * /login, /api/auth, /api/telegram (Telegram webhook), /api/cron (Vercel Cron),
     * statik fayllar (_next, favicon) — bundan mustasno, qolgan barcha sahifalar
     * sessiya cookie talab qiladi. Webhook/cron so'rovlari o'z ichida alohida
     * tekshiruv (secretToken / CRON_SECRET) orqali himoyalangan, sessiya cookie yo'q.
     */
    "/((?!login|api/auth|api/telegram|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
