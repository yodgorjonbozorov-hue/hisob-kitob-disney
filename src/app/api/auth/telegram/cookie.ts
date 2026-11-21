import type { NextResponse } from "next/server";
import { TG_LOGIN_TTL_MS } from "@/lib/auth/telegramLogin";

/**
 * Telegram kirish so'rovini BOSHLAGAN brauzerga bog'lovchi NONCE cookie'si.
 * httpOnly (skript o'qiy olmaydi), faqat `/api/auth/telegram` yo'liga yuboriladi.
 */
export const TG_NONCE_COOKIE = "balansa_tg_login";

export function nonceQoy(res: NextResponse, nonce: string): void {
  res.cookies.set(TG_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/telegram",
    maxAge: Math.floor(TG_LOGIN_TTL_MS / 1000),
  });
}

export function nonceOchir(res: NextResponse): void {
  res.cookies.set(TG_NONCE_COOKIE, "", { path: "/api/auth/telegram", maxAge: 0 });
}
