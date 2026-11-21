import { NextRequest, NextResponse } from "next/server";
import { boshlash, START_PREFIKS } from "@/lib/auth/telegramLogin";
import { telegramBotNomi } from "@/lib/auth/telegramBot";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";
import { nonceQoy } from "../cookie";

/**
 * Telegram orqali kirishni boshlaydi: bir martalik havola qaytaradi va
 * so'rovni shu brauzerga NONCE cookie bilan bog'laydi.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // Har IP uchun 5 daqiqada 10 ta so'rov — bazani yozuv bilan to'ldirib bo'lmasin.
  const rl = await rateLimit(`tglogin:ip:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Juda ko'p urinish. Birozdan keyin qayta urining.", retryAfter: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { token, nonce, expiresAt } = await boshlash({
    ip: ip === "unknown" ? null : ip,
    userAgent: request.headers.get("user-agent"),
  });
  const bot = await telegramBotNomi();
  const res = NextResponse.json({
    token,
    bot,
    havola: `https://t.me/${bot}?start=${START_PREFIKS}${token}`,
    expiresAt,
  });
  nonceQoy(res, nonce);
  return res;
}
