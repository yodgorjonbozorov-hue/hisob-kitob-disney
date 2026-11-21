import { NextRequest, NextResponse } from "next/server";
import { holat } from "@/lib/auth/telegramLogin";
import { loginUrinishiYoz, webSessiyaOch } from "@/lib/auth/kirish";
import { normalizeRol } from "@/lib/auth/roles";
import { telegramTokenSchema } from "@/lib/validation/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";
import { TG_NONCE_COOKIE, nonceOchir } from "../cookie";

/**
 * Brauzer har ~2 soniyada so'raydi. Bot tasdiqlagan bo'lsa — sessiya shu
 * javobda ochiladi va so'rov yo'q qilinadi (bir martalik).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // 5 daqiqalik so'rov uchun ~150 ta so'rov kerak; zaxira bilan 400.
  const rl = await rateLimit(`tglogin:holat:${ip}`, 400, 5 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ holat: "eskirgan" }, { status: 429 });

  const parsed = telegramTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ holat: "eskirgan" }, { status: 400 });

  const natija = await holat(parsed.data.token, request.cookies.get(TG_NONCE_COOKIE)?.value);
  const user = natija.user;
  if (natija.holat !== "tasdiqlandi" || !user) {
    const res = NextResponse.json({ holat: natija.holat });
    // Yakuniy holatlarda cookie kerak emas.
    if (natija.holat !== "kutilmoqda") nonceOchir(res);
    return res;
  }

  await webSessiyaOch(user);
  await loginUrinishiYoz({
    login: user.login,
    ip,
    ok: true,
    userId: user.id,
    tenantId: user.tenantId,
    amal: "login_telegram",
  });

  const res = NextResponse.json({
    holat: "tasdiqlandi",
    rol: normalizeRol(user.rol),
    mustChangePassword: user.mustChangePassword ?? false,
  });
  nonceOchir(res);
  return res;
}
